---
parent: 19-search-engine
seq: 01
title: 검색 시스템 개요 — 검색 vs 조회 vs 분석, Lucene 의 위치, score 의 의미
type: deep
created: 2026-05-03
---

# 01. 검색 시스템 개요

## 1. 검색 vs 조회 vs 분석 — 워크로드 3종

DB 든 검색엔진이든 데이터 작업은 결국 3개의 워크로드 중 하나다. 같은 ES (Elasticsearch) 라도 어떤 워크로드인지에 따라 쿼리 방식·점수 계산·캐시 전략·튜닝 포인트가 모두 다르다.

| 축 | **조회 (Lookup / Filter)** | **검색 (Search)** | **분석 (Analytics)** |
|---|---|---|---|
| 질문 형태 | "id=123 인 것" / "status=active 인 것" | "갤럭시 폴드와 가장 관련도 높은 상품" | "지난 30일 카테고리별 매출 합계" |
| 결과 | 결정적 (있다/없다, 일치 set) | **순위 + score** | 집계 수치 (sum/avg/cardinality) |
| 점수 | ❌ (boolean) | ✅ (BM25, vector, hybrid) | ❌ |
| 캐시 친화 | ✅ (filter cache) | ❌ (점수 매번 계산) | 부분 (segment 단위) |
| RDB 도구 | B-Tree index | Full-text (한계) | OLAP / column store |
| ES 도구 | **filter context** (term, range, exists) | **query context** (match, multi_match, kNN) | **aggregations** (terms, date_histogram) |
| 튜닝 핵심 | 인덱스 적중 | analyzer + 스코어링 + relevance 평가 | shard 크기 + cardinality 추정 정확도 |

**핵심**: ES 는 세 워크로드 모두를 한 엔진에서 처리할 수 있다는 점이 강점이지만, 동시에 **잘못 쓰면 가장 비싼 도구** 가 된다. 예: 단순 조회를 query context 로 보내면 매번 BM25 (Best Match 25) 계산 → CPU 낭비. 분석 워크로드에 cardinality 가 너무 높은 필드를 terms agg 하면 메모리 OOM (Out Of Memory, 메모리 부족).

> 멘탈 모델: **filter 는 "있냐 없냐", query 는 "얼마나 가깝냐", agg 는 "그래서 합치면?"**

## 2. Lucene 의 위치 — ES/OpenSearch 는 분산 래퍼

가장 자주 빠지는 함정: "ES = 검색엔진" 으로 알고 있는 것. 정확히는 **Lucene = 검색엔진, ES/OpenSearch = Lucene 위의 분산 래퍼 + 운영 도구**.

```
    ┌────────────────────────────────────┐
    │  Application (msa search 서비스)    │
    │  └ REST / kNN / aggregation 호출   │
    └─────────────────┬──────────────────┘
                      │ HTTP REST API
    ┌─────────────────▼──────────────────┐
    │  Elasticsearch / OpenSearch         │  ← 분산 / 클러스터 / API 레이어
    │  ├ shard / replica / allocation     │
    │  ├ Query DSL (JSON parser)          │
    │  ├ ingest pipeline / ILM            │
    │  ├ security / kibana 통합           │
    │  └ master / data / coordinating     │
    └─────────────────┬──────────────────┘
                      │ Lucene API (in-process Java)
    ┌─────────────────▼──────────────────┐
    │  Apache Lucene (검색 엔진 코어)       │
    │  ├ inverted index (term/postings)   │
    │  ├ analyzer / tokenizer             │
    │  ├ scoring (BM25Similarity)         │
    │  ├ segment / merge / commit         │
    │  └ kNN / HNSW (since 9.x)           │
    └────────────────────────────────────┘
```

**Lucene 이 책임지는 것** (검색의 본질):
- inverted index 자료구조와 segment 라이프사이클
- analyzer 파이프라인 (tokenizer / filter)
- BM25 / TF-IDF / vector similarity 스코어링
- HNSW 그래프 기반 kNN
- query parser → term query 매칭

**ES/OpenSearch 가 추가하는 것** (분산 + 운영):
- 클러스터링 (shard 분산, master 선출, 리밸런싱)
- REST API + Query DSL (JSON ↔ Lucene Query 객체 변환)
- 인덱스 관리 (alias, ILM/ISM, snapshot)
- 보안 / RBAC (Role-Based Access Control, 역할 기반 접근 제어) / 감사
- 관측 (slow log, hot threads, monitoring)
- ingest pipeline / cross-cluster search

→ **시니어 면접 답변**: "ES 의 query syntax 는 결국 Lucene query 의 JSON 표현이고, 본질적인 검색 품질 (analyzer, BM25, kNN) 은 Lucene 이 결정합니다."

> **[OS (OpenSearch) 차이]** OpenSearch 도 정확히 같은 구조 — Lucene 위 분산 래퍼. 그래서 Lucene 의 동작 (segment, BM25, HNSW (Hierarchical Navigable Small World)) 은 ES/OpenSearch 어느 쪽이든 동일하게 적용된다. 분기는 거의 전부 "래퍼 레이어" 에서 발생.

## 3. ES / OpenSearch 등장 배경 (시니어가 알아야 할 맥락)

이 분기를 모르면 "왜 우리 회사는 OpenSearch 를 쓰는가?", "ES 8 으로 갈까?" 같은 질문에 답할 수 없다.

### 3-1. Lucene → Elasticsearch (2010)

- Doug Cutting 이 1999 년부터 만든 **Apache Lucene** = JVM in-process 검색 라이브러리
- Lucene 은 한 JVM 안에서만 동작 → 분산, 복제, REST API 없음
- 2010 Shay Banon 이 Elasticsearch 를 OSS 로 출시 → "Lucene + 분산 + REST API" 패키지로 폭발적 인기
- 당시 대안: Solr (Lucene 위 또 다른 래퍼, 2006~) — Solr 가 먼저였지만 ES 가 schema-less / REST 친화 / 운영 단순함으로 추월
- 2012 Elastic 회사 설립, ELK 스택 (Elasticsearch + Logstash + Kibana) 으로 로그 분석 시장 장악

### 3-2. 라이선스 분기 (2021)

- 2021-01 Elastic 이 ES + Kibana 라이선스를 **Apache License 2.0 → SSPL + Elastic License** 로 변경
- 동기: AWS 가 ES 를 managed service (AWS Elasticsearch Service) 로 판매 → Elastic 회사의 SaaS 와 직접 경쟁
- AWS 의 응답: ES 7.10 fork → **OpenSearch** 출시 (Apache 2.0 유지)
- 같은 시기 Logstash 일부 / Beats 일부도 같이 분기

### 3-3. ES 의 회귀 (2024)

- 2024-08 Elastic 이 ES 라이선스에 **AGPLv3 추가** 발표 — 다시 OSI-approved OSS 진영으로 돌아옴 (SSPL/Elastic License 와 병기)
- 다만 OpenSearch 는 이미 별도 진영으로 독립 진화 → 합쳐지지 않음
- AWS / 일부 클라우드는 OpenSearch 계속 밀고 있음 (managed service 도 OpenSearch Service 로 리브랜딩)

### 3-4. 현 시점 (2026) 의 선택지

| 영역 | ES (8.x ~ 9.x) | OpenSearch (2.x ~ 3.x) |
|---|---|---|
| 라이선스 | AGPLv3 + ELv2 | Apache 2.0 |
| Lucene 버전 | 최신 (9.x) | 약간 lag |
| ML / Anomaly Detection | 강 (유료) | 별도 plugin |
| kNN / Neural Search | 8.x 부터 강화 | 2.x 초기부터 강 (OpenSearch 가 더 빨리 안정화) |
| LTR | plugin 필요 | OpenSearch LTR plugin (커뮤니티 활발) |
| Kibana / Dashboards | Kibana | OpenSearch Dashboards (Kibana 7.10 fork) |
| API 호환성 | 7.x ↔ OS 1.x 거의 호환, **8.x 부터 분기 가속** | 2.x 부터 독자 진화 |
| 클라우드 | Elastic Cloud / 자체 / 모든 대형 cloud | AWS OpenSearch Service / 자체 / 일부 cloud |

→ **선택 기준 (시니어 의사결정)**:
- 라이선스에 민감 (재배포·SaaS) → OpenSearch
- ML / Anomaly Detection 적극 활용 → ES (유료 라이선스 OK)
- AWS 환경 + managed service → OpenSearch (정합성 ↑)
- 멀티 클라우드 / 자체 운영 → 둘 다 가능, 팀 운영 경험으로 결정
- **마이그레이션 결정 변수**: 8.x 이상에서 ES 신기능 (예: ESQL, semantic_text) 을 안 쓰면 OS 로 전환 비용 작음. 쓰면 매우 큼.

## 4. Score 의 의미 — 왜 검색에서 핵심인가

조회는 "있다/없다" 가 답이지만 검색은 **"얼마나 관련 있는가"** 가 답. 이것이 RDB (Relational Database, 관계형 데이터베이스) 와 결정적으로 다른 점.

### 4-1. score 의 정체

ES query 결과의 `_score` 필드는 **이 문서가 쿼리와 얼마나 일치하는지의 상대 점수**. 절대값이 아니라:

- **상대값** — 같은 쿼리 내에서만 비교 의미가 있음
- 다른 쿼리의 score 와 비교 ❌ (BM25 의 idf, dl 가 corpus 의존이므로 정규화 안 됨)
- 1.0 이 만점이 아님, 5.0 이 0.5 의 "10배" 도 아님

### 4-2. 기본 스코어링: BM25

ES/OpenSearch 의 default similarity = `BM25Similarity` (Lucene 내장).

```
score(q, d) = Σ_t∈q [ idf(t) × (tf(t,d) × (k1+1)) / (tf(t,d) + k1 × (1 - b + b × |d|/avgdl)) ]
```

요점만:
- **idf** — 흔한 단어일수록 가중치 ↓ (정보량 적음)
- **tf** — 문서 내 term 빈도가 높을수록 ↑ 단, k1 으로 saturation
- **|d|/avgdl** — 문서 길이가 평균보다 길면 패널티, b 가 강도 조절

→ 자세한 수식은 §06.

### 4-3. function_score 로 비즈니스 시그널 결합

순수 BM25 만으로는 이커머스 검색이 안 됨 (관련도 ≠ 매출). 따라서:

```json
{
  "function_score": {
    "query": { "match": { "name": "갤럭시" } },     // BM25 score
    "functions": [
      { "field_value_factor": { "field": "popularity", "modifier": "log1p" } },
      { "gauss": { "created_at": { "scale": "30d" } } }   // 신상품 가산
    ],
    "boost_mode": "multiply"
  }
}
```

→ 비즈니스 시그널 (인기도 / 신상도 / 광고) 을 BM25 와 결합. 자세한 패턴은 §06.

### 4-4. 평가 — score 는 어떻게 "옳은가" 를 검증하나

검색 품질의 객관 지표:
- **MRR (Mean Reciprocal Rank)** — 정답이 처음 나타나는 rank 의 역수 평균. "첫 클릭" 위치 측정.
- **nDCG@k** — 상위 k 결과의 누적 이득 (정답 가까울수록 ↑). 다중 정답이 있을 때 표준.
- **Recall@k** — 상위 k 안에 정답이 들어있는가
- **Precision@k** — 상위 k 중 정답 비율

**시니어 함정**: 개발자 직관으로 "이게 1등이어야지" 만 따져서는 안 됨 — judgment list (정답 라벨) 를 운영 데이터로 확보해야 검색 품질을 객관 측정 가능. (자세한 LTR + judgment 는 §10)

## 5. 검색 시스템의 일반적 아키텍처 (high-level)

```
[원본 데이터 (RDB SoR)]
        │ binlog / app event
        ▼
[Outbox 테이블 / Debezium]
        │
        ▼
[Kafka — 이벤트 스트림]
        │ consumer (멱등 처리)
        ▼
[ES / OS 인덱싱 파이프라인]
        │ (analyzer 적용 → segment 추가)
        ▼
[ES / OS 인덱스]
        ▲
        │ 검색 쿼리 (Query DSL)
[검색 API 서버]
        ▲
        │ HTTP / RPC
[프론트 / 모바일]
```

**핵심 원칙 4개** (영상 요약 자료에서 그대로 가져옴):
1. **SoR (System of Record, 원본 데이터 시스템) ≠ ES** — RDB 가 원본, ES 는 파생. 손실 시 재구성 가능해야.
2. **단방향 동기화** — 원본 → 보조. 역방향 ❌.
3. **Two-Phase Lookup** — ES 는 ID + 점수만, 본문은 RDB. 변동성 큰 필드 (가격/재고) ES 색인 ❌.
4. **Eventual Consistency** — 색인 lag SLA (P99 < N초) 명시.

이 4원칙은 본 학습 전체를 관통한다. §14 (Sync) / §15 (msa grounding) / §19 (ADR) 모두 여기로 돌아옴.

## 6. msa 현재 상태

- **search 서비스**: 4-모듈 구조 (`search/CLAUDE.md`)
  - `search:domain` — Pure Kotlin 검색 모델, 포트
  - `search:app` — REST API (port 8083)
  - `search:consumer` — Kafka → ES 인덱싱 (port 8084)
  - `search:batch` — 전체 리인덱싱, **alias swap 무중단** (port 8085)
- **인덱싱 토픽**: `product.item.created` / `product.item.updated`
- **컨슈머 그룹**: `search-indexer`
- **멱등성**: ADR-0012 / `docs/conventions/idempotent-consumer.md` 적용
- **인프라**: ES + OpenSearch 모두 k3d local 에 존재 (`k8s/infra/local/`) — 일원화는 ADR 후보 (§19)

→ msa 는 위 §5 의 일반 아키텍처를 거의 그대로 따른다. 깊은 grounding 은 §15.

## 7. 자주 듣는 오해 정정

> **"ES 는 RDB 를 대체할 수 있다"**

- ❌ ES 는 SoR 가 아니다. 트랜잭션 / 정합성 / referential integrity 보장 없음. RDB 의 **읽기 모델 / 검색 모델** 일 뿐.

> **"전체 텍스트 검색은 무조건 ES 가 필요하다"**

- ❌ Postgres FTS / pgvector 로 충분한 규모가 많다 (영상의 "Just Use Postgres"). 병목 증명 후 분리.

> **"score 는 절대값으로 0~1 사이"**

- ❌ 상대값. BM25 score 는 corpus / 쿼리에 따라 0.5 ~ 50+ 범위 다양. 절대 임계값 비교 ❌.

> **"Solr 와 ES 는 같다"**

- ⚠ 둘 다 Lucene 래퍼지만 운영 모델 / API / 분산 모델이 다름. 2010 년대 후반 ES 가 시장 압승 → 신규 도입은 ES/OS 가 거의 전부.

> **"ES 와 OpenSearch 는 호환된다"**

- ⚠ 7.x ↔ OS 1.x 까지 거의 호환. 8.x 부터 분기 가속. client 라이브러리도 분기 (elasticsearch-java vs opensearch-java).

> **"검색 잘하려면 BM25 만 잘 튜닝하면 된다"**

- ❌ analyzer (특히 한국어 nori) 가 1차, BM25 는 2차, business signal (function_score) 이 3차, re-rank 가 4차. **하단부터** 잡아야 함.

## 8. 다음 학습

- [02-lucene-internals.md](02-lucene-internals.md) — Lucene segment / commit / refresh / flush / merge — 가시성 ≠ 내구성의 핵심
- [03-inverted-index-deep.md](03-inverted-index-deep.md) — inverted index 자료구조 (term dict / postings / skip list)
- [11-elasticsearch-vs-opensearch.md](11-elasticsearch-vs-opensearch.md) — ES vs OS 분기의 종합 정리
- [15-msa-search-grounding.md](15-msa-search-grounding.md) — msa search 4-모듈 직접 분석

> **§01 회독 체크리스트**:
> - [ ] 검색 / 조회 / 분석 워크로드 차이를 한 줄씩 설명할 수 있다
> - [ ] Lucene 과 ES/OS 의 책임 분리를 다이어그램으로 그릴 수 있다
> - [ ] ES vs OS 라이선스 분기 타임라인 (2021 분기 → 2024 ES 회귀) 을 답할 수 있다
> - [ ] score 가 절대값이 아닌 이유를 설명할 수 있다
> - [ ] 검색 시스템 4원칙 (SoR / 단방향 / Two-Phase / EC) 을 외운다
