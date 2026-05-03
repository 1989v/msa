---
parent: 19-search-engine
seq: 11
title: Elasticsearch vs OpenSearch — 라이선스 분기, 기능 차이, API 호환성, 마이그레이션 비용
type: deep
created: 2026-05-03
---

# 11. Elasticsearch vs OpenSearch

> 매 phase 의 cross-reference 를 종합하는 챕터. 시니어 의사결정 (도구 선택 / 마이그레이션) 의 근거.

## 1. 한 줄 핵심

> **2026 년 시점, 신규 도입은 도메인 / 운영 환경 / 라이선스에 따라 둘 다 합리적 선택이다.**
> 마이그레이션 비용은 8.x 이전 ES 면 작고, 8.x 이상의 ES 신기능 (ESQL, semantic_text, ELSER) 을 쓰면 매우 크다.

## 2. 분기의 역사 (2010 ~ 2026)

| 연도 | 사건 |
|---|---|
| 1999 | Apache Lucene 등장 (Doug Cutting) |
| 2006 | Apache Solr 등장 (Lucene 위 첫 분산 래퍼) |
| 2010 | Elasticsearch 0.4 OSS 출시 (Apache 2.0) |
| 2012 | Elastic 회사 설립, ELK 스택 본격화 |
| 2018-2020 | AWS 가 ES 를 managed service 로 판매 → Elastic 회사와 갈등 |
| **2021-01** | Elastic 이 ES + Kibana 를 SSPL + Elastic License 로 변경 (OSI ❌) |
| **2021-04** | AWS fork → OpenSearch 1.0 출시 (Apache 2.0, ES 7.10 base) |
| 2022-2023 | OpenSearch 2.x — kNN / Neural Search / ML 통합 강화 |
| **2024-08** | Elastic 이 ES 에 AGPLv3 추가 (SSPL/ELv2/AGPLv3 trio) — OSI 진영 복귀 |
| 2025-2026 | ES 8.x ↔ OS 2.x 분기 가속, ES 의 신기능 (ESQL, semantic_text) 미지원 OS |

### 2-1. 핵심 라이선스 정리

| 시점 | ES 라이선스 | OSI 인정? |
|---|---|---|
| ~2021-01 | Apache 2.0 | ✅ |
| 2021-01 ~ 2024-08 | SSPL + Elastic License v2 | ❌ |
| 2024-08 ~ | SSPL + Elastic License v2 + **AGPLv3** | ✅ (AGPLv3) |

OpenSearch: Apache 2.0 (계속).

### 2-2. SSPL 이 왜 OSI 에 거절됐나

- SSPL (Server Side Public License) — MongoDB 가 만든 라이선스
- AGPL 의 일종이지만 "service 로 제공할 때 모든 인프라 코드도 공개" 강제
- 사실상 cloud provider (AWS) 를 겨냥한 조항 → 일반 OSS 정신과 안 맞음
- OSI 가 "OSS 정의에 부합 안 함" 으로 거절

## 3. 현 시점 (2026) 기능 비교

### 3-1. 라이선스

| 영역 | ES | OS |
|---|---|---|
| 기본 라이선스 | AGPLv3 / SSPL / ELv2 (선택) | Apache 2.0 |
| 재배포 | OK (라이선스 준수) | OK 자유 |
| SaaS 제공 | SSPL / AGPL 제약 (소스 공개) | 자유 |
| 일반 자체 운영 | 무료 | 무료 |

→ SaaS / 클라우드 재판매 안 하면 ES 도 사실상 무료.

### 3-2. 핵심 기능

| 기능 | ES (8.x ~ 9.x) | OS (2.x ~ 3.x) |
|---|---|---|
| **검색 엔진 코어 (Lucene)** | 최신 (9.x) | 약간 lag (보통 1 minor 뒤) |
| **kNN / Vector Search** | 8.x 부터 강화 (HNSW 네이티브) | 2.x 초기부터 안정 (HNSW + IVF + multiple engines) |
| **Hybrid Search (RRF)** | retriever 추상화 (8.8+) | search pipeline + normalization (2.10+) |
| **Cross-Encoder Reranker** | text_similarity_reranker (8.14+, native) | application 레이어 또는 plugin |
| **LTR** | LTR plugin (o19s) | OpenSearch LTR plugin (활발) |
| **ML / Anomaly Detection** | Elastic ML (유료 라이선스) | OpenSearch ML Commons (오픈) |
| **ESQL** (Elasticsearch Query Language) | 8.11+ native | ❌ |
| **PPL** (Piped Processing Language) | ❌ | OS native |
| **semantic_text 필드** | 8.13+ native | ❌ |
| **ELSER** (Elastic 자체 sparse encoder) | ES 전용 | ❌ |
| **Frozen / Searchable Snapshot** | 강 (Elastic Cloud 통합) | OS 도 지원 |
| **Cross-Cluster Search** | 둘 다 지원 | 둘 다 지원 |
| **Snapshot to S3 / GCS** | 둘 다 | 둘 다 |
| **Security / RBAC** | ES Security (basic 무료) | OpenSearch Security plugin (기본 번들) |
| **Dashboard / Visualization** | Kibana | OpenSearch Dashboards (Kibana 7.10 fork) |
| **Alerting** | Watcher (유료) / Kibana Alerting | OpenSearch Alerting plugin |
| **SQL** | ES SQL (basic 무료) | OpenSearch SQL plugin |

### 3-3. 한국어 분석기

- nori — 둘 다 동일 (Lucene 공식)
- 사용자 사전 / decompound mode — 동일
- → 한국어 분석은 분기 무관

### 3-4. Client 라이브러리

| 언어 | ES Client | OS Client |
|---|---|---|
| Java | `co.elastic.clients:elasticsearch-java` | `org.opensearch.client:opensearch-java` |
| Python | `elasticsearch` | `opensearch-py` |
| Go | `github.com/elastic/go-elasticsearch` | `github.com/opensearch-project/opensearch-go` |
| Node | `@elastic/elasticsearch` | `@opensearch-project/opensearch` |
| Spring Boot | `spring-data-elasticsearch` | `spring-data-opensearch` (커뮤니티) |

→ ES 8 client 는 OS 2.x 와 호환 ❌ (인증 방식 / API 차이). 분리 필요.

## 4. API 호환성

### 4-1. ES 7.x ↔ OS 1.x (거의 호환)

OS 1.0 = ES 7.10 fork. 대부분의 기존 코드 그대로 작동.

### 4-2. ES 8.x ↔ OS 2.x (분기 가속)

| 영역 | 호환 |
|---|---|
| 기본 CRUD / Query DSL | ✅ |
| Aggregation | ✅ |
| Bulk API | ✅ |
| Mapping (text, keyword, date, long, ...) | ✅ |
| **dense_vector / knn_vector** | ❌ (필드명 다름) |
| **kNN search 문법** | ❌ (top-level vs query 안) |
| **Security API** | ❌ (개념은 비슷, 구체 다름) |
| **ML / Inference** | ❌ |
| **ESQL / semantic_text** | ES 전용 |
| **PPL** | OS 전용 |
| Index settings | 거의 |
| ILM ↔ ISM | 개념 비슷, 설정 다름 |

### 4-3. 마이그레이션 작업량 (대략)

ES 7.x → OS 2.x:
- 기본 검색 / 인덱싱: 거의 무수정
- vector search 사용 중: 매핑 / 쿼리 수정
- security 설정: 재구성
- Kibana → OpenSearch Dashboards: 거의 호환
- 클라이언트 라이브러리: 교체

ES 8.x (신기능 사용) → OS 2.x:
- ESQL / semantic_text / ELSER 사용 중: **대대적 재설계**
- 결정 변수: 신기능 의존도

## 5. 운영 환경 차이

### 5-1. 클라우드 managed service

| 클라우드 | ES | OS |
|---|---|---|
| AWS | Elastic Cloud (AWS 위), Elastic Cloud on Kubernetes | **OpenSearch Service** (네이티브) |
| GCP | Elastic Cloud (GCP), 자체 | 자체 운영 또는 Aiven |
| Azure | Elastic Cloud (Azure), 자체 | 자체 또는 Aiven |
| 자체 (K8s) | ECK (Elastic Cloud on K8s) Operator | OpenSearch Operator (Kubernetes Operator) |

→ AWS = OpenSearch 가 정합성 ↑ (managed 더 저렴, 통합 쉬움).

### 5-2. K8s Operator

ES: ECK (Elastic 공식) — 매우 성숙, helm chart, monitoring 통합.
OS: OpenSearch Operator (Apache 2.0) — 발전 중, 커뮤니티 + AWS.

### 5-3. 모니터링 / 관측

ES: Stack Monitoring (Kibana 통합) / Elastic APM
OS: OpenSearch Dashboards 의 Index Management / OpenTelemetry 통합

## 6. 비용

### 6-1. 자체 운영

- 둘 다 무료 (라이선스 기본)
- 인프라 비용 (CPU / RAM / 디스크) 동일

### 6-2. Managed

| 클라우드 | ES (Elastic Cloud) | OS (AWS) |
|---|---|---|
| 1 노드 (4vCPU 16GB RAM) | 약 $250/월 | 약 $200/월 |
| 3 노드 + 1 master | 약 $1,000/월 | 약 $800/월 |

→ AWS OS 가 보통 10~20% 저렴.

### 6-3. ML / Premium 기능

- ES: ML / Anomaly Detection / SAML / Field Level Security 등은 **Platinum 라이선스** ($$$)
- OS: 모두 무료 plugin

## 7. 시니어 의사결정 매트릭스

### 7-1. 기존 ES 7.x 운영 중 → 어디로?

| 신기능 의존도 | 권장 |
|---|---|
| ES 7 만 씀, 8 의 신기능 안 씀 | **OS 마이그레이션 검토** (라이선스 + 비용 + AWS 통합) |
| 8.x ML / ESQL / ELSER 사용 | **ES 유지** (마이그레이션 비용 큼) |
| AWS 환경 + managed service | **OS** (AWS 통합) |
| 멀티 클라우드 | **둘 다 가능** |
| SaaS 제공 (재판매) | **OS** (라이선스 자유) |

### 7-2. 신규 도입

- 라이선스 자유 / 명확함 → **OS**
- ML / Anomaly Detection 적극 활용 → **ES**
- AWS managed → **OS**
- 한국 / 일반 이커머스 (라이선스 무관) → **둘 다 OK**, 팀 경험으로

### 7-3. 운영 / 학습 곡선

- 둘 다 비슷. 차이는 plugin / 신기능 위주.
- 팀 경험 (어느 쪽이 익숙한가) 이 단기 결정 변수.

## 8. msa 시사점

### 8-1. 현 상태

- `k8s/infra/local/` 에 ES + OS 둘 다 존재
- search 서비스가 어느 쪽을 쓰는지 코드 확인 필요 (§15)

### 8-2. 일원화 ADR 후보

운영 부담 (학습 / 모니터링 / 백업 / 보안) 이 2배 → 일원화 가치 큼:

ADR 결정 변수:
- 현재 어느 쪽이 주력인가
- 신기능 (ML, ESQL) 사용 여부
- 클라우드 환경 (자체 K8s / AWS / GCP)
- 라이선스 우려
- 팀 경험

→ §19 의 ADR 4건 중 1건.

### 8-3. 마이그레이션 비용 (예시)

만약 OS → ES 또는 그 반대:
- 매핑 일부 수정 (vector / kNN 사용 중이면)
- 클라이언트 라이브러리 교체
- 보안 / RBAC 재설정
- snapshot / restore 검증
- 정합성 테스트
- Kibana → OS Dashboards (또는 반대) 의 시각화 마이그레이션
- 전체 약 1~2 sprint (작은 인덱스), 1~2 분기 (대규모)

## 9. 흔한 오해 정정

> **"ES 가 라이선스 변경 후 무료가 아니다"**

- ❌ 자체 운영 / 일반 SaaS 제외하면 무료. 2024 AGPLv3 추가로 OSI 인정 OSS.

> **"OS 는 AWS 만의 도구다"**

- ❌ Linux Foundation 산하 (2024). AWS 가 주도지만 다른 contributor 도 다수.

> **"ES 와 OS 는 코드가 같다"**

- ❌ 분기 후 독립 진화. 8.x / 2.x 부터 차이 큼.

> **"OS 는 ES 의 단순 fork 다"**

- ❌ 초기 fork 였으나 vector search / ML / SQL / PPL 등 독자 기능 다수.

> **"OS 가 ES 보다 항상 부족하다"**

- ❌ vector search / multi-engine kNN / 라이선스 자유 / AWS 통합은 OS 우위.

> **"마이그레이션은 쉽다"**

- ⚠ 7.x ↔ 1.x 면 쉽지만, 8.x 신기능 사용 중이면 매우 어려움.

## 10. 다음 학습

- [12-cluster-topology-shard-sizing.md](12-cluster-topology-shard-sizing.md) — 클러스터 / shard 산정 (둘 다 적용)
- [13-indexing-pipeline-ilm.md](13-indexing-pipeline-ilm.md) — ILM (ES) vs ISM (OS) 비교
- [15-msa-search-grounding.md](15-msa-search-grounding.md) — msa 가 어느 쪽 쓰는지 확인
- [19-improvements.md](19-improvements.md) — 일원화 ADR

> **§11 회독 체크리스트**:
> - [ ] 라이선스 분기 타임라인 (2021 / 2024) 을 답할 수 있다
> - [ ] SSPL 이 OSI 에 거절된 이유
> - [ ] ES vs OS 의 핵심 기능 차이 5가지 이상
> - [ ] API 호환성: 7.x ↔ 1.x 가능, 8.x ↔ 2.x 분기 가속
> - [ ] AWS managed service 에서의 비용 차이
> - [ ] 마이그레이션 비용 결정 변수 (신기능 의존도)
> - [ ] msa 의 일원화 ADR 결정 변수 4가지
