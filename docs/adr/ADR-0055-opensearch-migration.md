# ADR-0055 검색 엔진 Elasticsearch → OpenSearch 전면 전환

## Status

Accepted (2026-06-13)

**Date**: 2026-06-13
**Authors**: TBD
**Related**:
- **ADR-0043** (Search Online Bandit) / **ADR-0050** (Search Quality Roadmap) / **ADR-0051**
  (Contextual Bandit·LTR·Vector) — 검색 랭킹 결정은 모두 유지. 본 ADR 은 **저장소/클라이언트 교체만**
  다루며 랭킹 알고리즘·평가 인프라 결정을 변경하지 않는다.
- **ADR-0019** (K8s Migration) — 인프라 매니페스트 구조를 따름.

**Supersedes / Extends**: 없음 (스토리지 엔진 교체 결정 신규).

---

## Context

### 1. 현재 상태 — 단일 Elasticsearch 에 두 서비스 결합

| 사용처 | 클라이언트 | 비고 |
|---|---|---|
| `search:app` | Spring Data Elasticsearch (`ElasticsearchOperations` + `NativeQuery`) | 랭킹 검색, suggest, debug |
| `search:consumer` | Spring Data ES + `BulkIngester` (co.elastic) | 스코어 부분 업데이트, bulk 인덱싱 |
| `search:batch` | `ElasticsearchClient` (raw) | alias swap 리인덱스, NDCG 평가 |
| `code-dictionary:app` | `ElasticsearchClient` (raw, Boot 자동구성) | 개념 검색/자동완성/동의어 |
| 인프라 | `k8s/infra/local/elasticsearch/` (ES 9.0.0 + nori), `k8s/infra/prod/eck/` (ECK 8.15.3) | |

주의: CLAUDE.md 와 code-dictionary 문서가 "OpenSearch" 로 표기해 왔으나 **실제 코드와 인프라는
전부 Elasticsearch** 였다 (문서 drift — 본 ADR 구현으로 표기와 실체가 일치하게 된다).

### 2. 전환 동기

1. **라이선스**: ES 7.11+ 는 SSPL/Elastic License (비 OSI). OpenSearch 는 Apache-2.0 —
   포트폴리오 공개 레포 + 향후 운영 배포에서 라이선스 제약 없음.
2. **운영 비용**: AWS OpenSearch Service 등 managed 옵션과의 정합 (prod-k8s 모드의 현실적 대안).
3. **문서-실체 일치**: 플랫폼 문서가 이미 OpenSearch 를 표방 — 실체를 문서에 맞춘다.

---

## Decision

### D1. 클라이언트 — raw `opensearch-java` 로 통일 (Spring Data 제거)

`org.opensearch.client:opensearch-java:3.8.0` + `ApacheHttpClient5Transport`.

| 옵션 | 평가 |
|---|---|
| spring-data-opensearch | ✗ — Spring Boot 4.x 호환 보장 없음 (Boot 3 대상). 커뮤니티 유지보수 리스크 |
| **raw opensearch-java** | ✓ — Boot 버전 비결합. code-dictionary 가 이미 raw 클라이언트 패턴 (ES) → 전 서비스 클라이언트 패턴 단일화 |

결과적으로 `spring-boot-starter-data-elasticsearch` 의존이 4개 모듈에서 제거되고,
`@Document`/`ElasticsearchOperations`/`NativeQuery` 가 모두 사라진다.

### D2. 인덱스 정의 — typed analysis builder 대신 JSON 파일 (`withJson`)

nori 등 플러그인 분석기의 typed builder 지원 여부에 결합되지 않도록, 인덱스
settings/mappings 는 클래스패스 JSON 리소스로 정의하고 `CreateIndexRequest.Builder.withJson`
으로 적용한다. 매핑 변경 이력이 JSON diff 로 남는 부수 효과.

### D3. 인프라 — OpenSearch 3.3.0 (+analysis-nori), ES 인스턴스 폐기

- local: `k8s/infra/local/opensearch/` 신설 (single-node, security plugin disabled,
  initContainer 로 `opensearch-plugin install analysis-nori` — 기존 ES nori 패턴 답습).
  `k8s/infra/local/elasticsearch/` 삭제.
- prod: `k8s/infra/prod/eck/` → `k8s/infra/prod/opensearch/` (OpenSearch k8s Operator,
  `OpenSearchCluster` CRD) 로 교체.
- 설정 키: `spring.elasticsearch.uris` → **`opensearch.uris`** (`OPENSEARCH_URIS`,
  기본 `http://opensearch:9200`). Spring 자동구성 키와의 혼동 제거.

### D4. 데이터 마이그레이션 — 백필 불필요

ES 인덱스는 전부 **파생 데이터** (SSOT: product DB / code-dictionary DB). 신규 OpenSearch 기동 후
기존 full-reindex 배치(`search:batch`, code-dictionary reindex)를 1회 실행하면 끝.
스냅샷 이전/리모트 리인덱스 불필요.

### API 호환성 메모

OpenSearch 의 search/bulk/aliases API 와 nori 플러그인은 ES 7.10 fork 계보로 본 코드베이스가
쓰는 기능 (function_score, match_bool_prefix, gauss decay, alias atomic swap, partial update,
synonym_graph) 을 전부 지원한다. 단 클라이언트 레벨에서:

- `BulkIngester` (co.elastic 전용 헬퍼) 는 opensearch-java 에 없음 → 크기/시간 기반 자체 버퍼링으로 대체.
- `explain` / typed query DSL 은 패키지만 다르고 빌더 시그니처 거의 동일 (fork).

---

## Consequences

### Positive
- Apache-2.0 단일 라이선스. 클라이언트 패턴 단일화 (search + code-dictionary 동일).
- Spring Data 추상 레이어 제거 → Boot 메이저 업그레이드 시 검색 스택 비결합.
- 문서 표기와 실체 일치.

### Negative
- Spring Boot 자동구성 (헬스체크 포함) 상실 → 클라이언트 빈 + 헬스 수동 구성.
- `BulkIngester` 수준의 backpressure 헬퍼 부재 → 자체 배칭 코드 유지보수.
- ES 전용 고급 기능 (ELSER, ES|QL 등) 사용 불가 — 현재 미사용이라 영향 없음.

### Migration 절차 (구현 순서)
1. toml + 모듈 deps 교체 → search:app (config/document/query/adapter/debug)
2. search:consumer (bulk 배칭 재구현, score 부분 업데이트) / search:batch (alias manager JSON 화, 평가 executor)
3. code-dictionary (클라이언트 빈 신설 + 어댑터 3종 + alias manager)
4. k8s local/prod 인프라 + env 키 교체 + ci.yml kustomize 목록
5. 문서 동기화 (search/CLAUDE.md, root CLAUDE.md, code-dictionary 표기)
6. 배포 후 full reindex 1회 (search:batch reindex job + code-dictionary reindex)

### Rollback
ES StatefulSet/매니페스트는 git 이력으로 복원 가능. 코드 롤백 = revert. 데이터는 파생이라 무손실.

---

## References

- opensearch-java: https://github.com/opensearch-project/opensearch-java (3.8.0)
- OpenSearch 3.x: https://docs.opensearch.org/latest/ (서버 3.3.0 + analysis-nori)
- 코드 인용: `search/app/.../elasticsearch/*`, `search/consumer/.../indexing/EsBulkDocumentProcessor.kt`,
  `search/batch/.../indexing/IndexAliasManager.kt`, `code-dictionary/app/.../elasticsearch/*`
