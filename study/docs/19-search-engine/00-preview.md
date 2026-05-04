---
parent: 19-search-engine
type: preview
created: 2026-05-03
---

# 검색엔진 심화 — Preview

> 학습자 수준: 묶음 1=B (기본기 OK / 내부·튜닝 약함) · 2=A (Vector·Hybrid·Re-Rank 첫 학습) · 3=B (운영 일부 / 시니어 의사결정 약함)
> 전체 예상 시간: **32h** · 목표: **C 균형** (면접 35% / msa 코드 grounding 35% / 개념 30%)
> 계획서: [00-plan.md](00-plan.md) · 깊이 패키지: 풀 커버리지 (스킵 없음, 복습용) · 학습 순서: X (Top-down)

---

## 멘탈 모델: "검색엔진의 5층 스택"

검색엔진은 단일 기술이 아니라 **5개 층이 결합된 패키지**다. 면접·실무에서 트러블이 나는 지점은 거의 항상 한 층에 매핑된다.

```
  ┌────────────────────────────────────────────────────────┐
  │  Layer 5: 운영 (Cluster / Monitoring / DR)
  │  - master/data/coordinating 노드 분리, shard 산정 공식
  │  - cluster health, hot threads, slow log, snapshot
  │  - 재색인 RTO = 사실상의 ES 복구 시간 (SoR 가 아님)
  └────────────────────────┬───────────────────────────────┘
                           │ "원본 → 보조 동기화"
  ┌────────────────────────┴───────────────────────────────┐
  │  Layer 4: 동기화 (Sync · Eventual Consistency)
  │  - Outbox + Kafka + ES Sink (msa 현재 패턴)
  │  - Debezium CDC (binlog → Kafka → ES)
  │  - 색인 lag SLA (P99 < N초), version_type=external
  └────────────────────────┬───────────────────────────────┘
                           │ "후보 결정 → 재정렬"
  ┌────────────────────────┴───────────────────────────────┐
  │  Layer 3: 검색 품질 (Retrieval · Ranking)
  │  - Hybrid Search (BM25 + dense vector, RRF)
  │  - Re-Ranking (cross-encoder · LTR · business signal)
  │  - 평가지표 (MRR, nDCG, Recall@k)
  └────────────────────────┬───────────────────────────────┘
                           │ "어떤 문서를 얼마나 점수"
  ┌────────────────────────┴───────────────────────────────┐
  │  Layer 2: 스코어링 + Query (Lexical / Vector)
  │  - TF-IDF → BM25 (k1, b 파라미터)
  │  - Query DSL (term/match/bool/function_score)
  │  - dense_vector + HNSW (M, ef_construction, ef_search)
  └────────────────────────┬───────────────────────────────┘
                           │ "토큰 → 색인"
  ┌────────────────────────┴───────────────────────────────┐
  │  Layer 1: 색인 (Lucene · Analyzer · Inverted Index)
  │  - segment / commit / refresh / flush / merge
  │  - inverted index (term dict / postings / skip list)
  │  - analyzer pipeline (char filter → tokenizer → token filter)
  │  - nori 형태소 (decompound: none / discard / mixed)
  └────────────────────────────────────────────────────────┘
```

**핵심 7문장만 외운다**:

1. **ES (Elasticsearch) "near real-time" 의 정체** = refresh interval (기본 1s) → 가시성과 내구성은 분리. **flush(=commit)** 가 디스크 동기화. translog 가 둘 사이의 안전망.
2. **BM25 (Best Match 25) 의 b 가 핵심 튜닝 변수** = 문서 길이 정규화 강도. 본문 길이 편차 큰 corpus (게시판 vs 상품명) 에서는 b ↓ 검토. k1 은 saturation.
3. **nori decompound 3-mode** = `none` (원형 유지) · `discard` (분해만) · `mixed` (둘 다 색인). 검색어와 색인어가 일치하지 않으면 hit 0 → search_analyzer 분리 필수.
4. **text vs keyword** = analyzed vs not-analyzed. 정확 매칭/sort/aggregation 은 무조건 keyword. multi-field 패턴 (`title` text + `title.raw` keyword) 가 표준.
5. **Hybrid Search 의 RRF (Reciprocal Rank Fusion, 상호 순위 융합) 가 weighted score 보다 안전한 이유** = rank 기반 → 두 시스템 점수 분포 정규화 불필요. ES 8.8+ / OpenSearch 2.10+ 네이티브.
6. **HNSW (Hierarchical Navigable Small World) 3-파라미터** = M (노드당 연결 수, 메모리 ↔ 정확도) · ef_construction (빌드 너비) · ef_search (쿼리 너비, 지연 ↔ 정확도). dense_vector 변경 = 전체 reindex.
7. **Dual Write 절대 금지** = SoR (System of Record, 원본 데이터 시스템) (RDB (Relational Database, 관계형 데이터베이스)) → Outbox/CDC (Change Data Capture, 변경 데이터 캡처) → Kafka → ES 단방향. ES 데이터 손실 시 RDB 에서 재구성 가능해야 함 ("보조 저장소 재구성 가능성" 이 운영 안전망).

---

## 소주제 지도

> 21개 파일로 분할 (00-preview + 01~20). 각 파일 평균 ~50-80분 (전체 32h ÷ 20 ≈ 1.6h 평균, 묶음 2 가 더 두꺼움).

### Phase 1: 기본 개념 (5개) — 묶음 1 (B) 보강 강조

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 01 | 검색 시스템 개요 (검색 vs 조회 vs 분석) | [01-search-overview.md](01-search-overview.md) | Lucene 위치, ES/OS 등장 배경, score 의 의미 |
| 02 | Lucene 내부 (segment / commit / refresh / flush / merge) | [02-lucene-internals.md](02-lucene-internals.md) | 가시성 ≠ 내구성, translog 역할, near real-time 의 정체 |
| 03 | Inverted Index 자료구조 deep | [03-inverted-index-deep.md](03-inverted-index-deep.md) | term dict / postings / skip list, B-Tree 와의 차이 |
| 04 | Analyzer 파이프라인 | [04-analyzer-pipeline.md](04-analyzer-pipeline.md) | char filter → tokenizer → token filter, search_analyzer 분리 |
| 05 | 한국어 형태소 (nori vs mecab-ko vs seunjeon) | [05-korean-morphology-nori.md](05-korean-morphology-nori.md) | decompound 3-mode, 사용자 사전, 검색 품질 디버깅 |

### Phase 2: 심화 (9개) — 묶음 1 보강 + 묶음 2 풀어쓰기 중심

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 06 | TF-IDF → BM25 스코어링 | [06-tf-idf-bm25-scoring.md](06-tf-idf-bm25-scoring.md) | k1/b 직관, function_score, explain breakdown |
| 07 | Query DSL 패턴 | [07-query-dsl-patterns.md](07-query-dsl-patterns.md) | term/match/multi_match/bool/nested/suggest, filter vs query context |
| 08 | Vector Search + HNSW | [08-vector-search-hnsw.md](08-vector-search-hnsw.md) | dense_vector, kNN, M / ef_construction / ef_search |
| 09 | Hybrid Search (BM25 + Vector + RRF) | [09-hybrid-search-rrf.md](09-hybrid-search-rrf.md) | RRF 수식, weighted score, two-stage retrieval |
| 10 | Re-Ranking (cross-encoder + LTR) | [10-reranking-cross-encoder-ltr.md](10-reranking-cross-encoder-ltr.md) | LambdaMART, judgment list, business re-rank |
| 11 | Elasticsearch vs OpenSearch | [11-elasticsearch-vs-opensearch.md](11-elasticsearch-vs-opensearch.md) | 라이선스 분기 (SSPL → AGPLv3), 기능/API 호환성 |
| 12 | 클러스터 토폴로지 + shard 산정 | [12-cluster-topology-shard-sizing.md](12-cluster-topology-shard-sizing.md) | master/data/coordinating, shard 30-50GB 공식 |
| 13 | 인덱싱 파이프라인 + ILM/ISM | [13-indexing-pipeline-ilm.md](13-indexing-pipeline-ilm.md) | ingest pipeline, alias swap, hot-warm-cold |
| 14 | 동기화 (Outbox vs CDC) + 색인 lag SLA | [14-sync-outbox-cdc.md](14-sync-outbox-cdc.md) | Debezium, version_type=external, eventual consistency 보장 |

### Phase 3: 실전 적용 (msa) (4개) — 묶음 3 (B) 시니어 의사결정

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 15 | msa search 서비스 grounding | [15-msa-search-grounding.md](15-msa-search-grounding.md) | 4-모듈 (domain/app/consumer/batch), 매핑 분석, 변동성 필드 점검 |
| 16 | 운영 — 모니터링 + 재색인 RTO | [16-operations-monitoring-rto.md](16-operations-monitoring-rto.md) | cluster health, hot threads, snapshot, RTO 측정 |
| 17 | k3d 장애 시뮬레이션 시나리오 | [17-k8s-failure-simulation.md](17-k8s-failure-simulation.md) | ES 노드 죽이기, shard 리밸런싱, yellow→red 진단 절차서 |
| 18 | Hybrid Search PoC (search 한 endpoint) | [18-hybrid-search-poc.md](18-hybrid-search-poc.md) | product 검색에 BM25+dense+RRF 부분 적용 코드 |

### 산출물 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 19 | ADR 4건 통합 초안 | [19-improvements.md](19-improvements.md) | (1) ES vs OS 일원화 · (2) 변동성 필드 금지 · (3) 색인 lag SLA · (4) Hybrid 도입 |
| 20 | 면접 Q&A 카드 (17 질문 + 꼬리 + 악마의 변호인) | [20-interview-qa.md](20-interview-qa.md) | Phase 별 핵심 질문 + 모범답변 + STAR 결합 |

---

## 개념 관계도

```
                  ┌──────────────────────────┐
                  │  Document (RDB SoR)      │
                  └──────────┬───────────────┘
                             │ Outbox / CDC
                             ▼
                  ┌──────────────────────────┐
                  │  Kafka (event stream)    │
                  └──────────┬───────────────┘
                             │ ES Sink (consumer)
                             ▼
            ┌────────────────────────────────────┐
            │  Analyzer (nori, char/token filter)│
            └────────────────┬───────────────────┘
                             │ tokens
                             ▼
            ┌────────────────────────────────────┐
            │  Inverted Index (Lucene segment)   │
            │  refresh 1s → searchable           │
            │  flush → durable (commit)          │
            └────────────────┬───────────────────┘
                             │ ←──────── Query (사용자)
                             │           │
                             │           ▼
                             │  ┌────────────────────┐
                             │  │  Query DSL         │
                             │  │  (analyzer 적용)   │
                             │  └─────────┬──────────┘
                             ▼            ▼
                  ┌──────────────────────────┐
                  │  Scoring                 │
                  │  ├ BM25 (lexical)        │
                  │  └ HNSW kNN (vector)     │
                  └──────────┬───────────────┘
                             │ 두 결과
                             ▼
                  ┌──────────────────────────┐
                  │  Hybrid Fusion (RRF)     │
                  └──────────┬───────────────┘
                             │ top-N
                             ▼
                  ┌──────────────────────────┐
                  │  Re-Ranking              │
                  │  ├ cross-encoder         │
                  │  ├ LTR (LambdaMART)      │
                  │  └ business signal       │
                  └──────────┬───────────────┘
                             │ top-K
                             ▼
                  ┌──────────────────────────┐
                  │  ID 후보 → RDB fetch     │ ← Two-Phase Lookup
                  │  (변동성 필드는 ES 외부)  │
                  └──────────────────────────┘
```

---

## Phase 1 치트시트 (학습 시작 전 한 장)

### 자주 헷갈리는 용어

| 용어 | 의미 | 한 줄 |
|---|---|---|
| Index | RDB 의 "테이블" 에 가까운 단위 | document 들의 논리적 묶음 |
| Document | JSON 객체 = 한 행 | `_id` + `_source` |
| Mapping | 스키마 (text/keyword/date/long/dense_vector) | dynamic vs explicit, 변경하면 reindex |
| Shard | Lucene index 의 분산 단위 | 변경 시 reindex |
| Replica | shard 복제본 | 가용성 + 읽기 처리량 |
| Segment | Lucene 의 불변 inverted index 파일 | append-only, merge 로 정리 |
| Refresh | in-memory segment → searchable | 기본 1s, 가시성 |
| Flush | translog + buffer → 디스크 segment | 내구성 (= Lucene commit) |
| Translog | 안전망 — 디스크에 sequential write | refresh 와 독립, 복구용 |
| Term | 토큰화된 단어 단위 | inverted index 의 키 |
| Postings | term → doc id 리스트 | inverted index 의 값 |

### text vs keyword (가장 많이 틀리는 부분)

| 용도 | text | keyword |
|---|---|---|
| 형태소/토큰 분석 | ✅ | ❌ (그대로) |
| 정확 매칭 (term query) | ❌ | ✅ |
| 정렬 (sort) | ❌ | ✅ |
| 집계 (aggregation) | ❌ | ✅ |
| full-text 검색 (match) | ✅ | ❌ |
| 표준 매핑 패턴 | `title` | `title.raw` (multi-field) |

### filter vs query context (성능 결정)

| context | 점수 계산 | 캐시 | 용도 |
|---|---|---|---|
| query | O (BM25 등) | ❌ | 관련도 매칭 (match, multi_match) |
| filter | ❌ (boolean) | ✅ (filter cache) | 조건 필터 (status=active, price 1만~3만) |

→ **상수성 조건 (status, category, type) 은 무조건 filter 로**.

### nori decompound 3-mode

| mode | "한국어형태소분석기" 색인 결과 | 용도 |
|---|---|---|
| `none` | `한국어형태소분석기` (1 token) | 정확 매칭만 |
| `discard` | `한국어` `형태소` `분석기` (3) | 부분 검색 위주 |
| `mixed` | 위 4개 모두 | 가장 일반적 (검색 hit ↑, 인덱스 ↑) |

### BM25 파라미터 직관

```
score = idf(term) × (tf × (k1+1)) / (tf + k1 × (1 - b + b × dl/avgdl))
```

| 파라미터 | default | 의미 | 튜닝 시점 |
|---|---|---|---|
| k1 | 1.2 | tf saturation 속도 (작을수록 빨리 saturate) | tf 가 너무 영향 크다 → ↓ |
| b | 0.75 | 문서 길이 정규화 강도 (1=풀, 0=무시) | 짧은 문서에 불리 → ↓, 긴 문서 가산 → ↑ |

### HNSW 3-파라미터

| 파라미터 | 영향 | 트레이드오프 |
|---|---|---|
| M (노드당 연결) | 그래프 밀도 | 메모리 ↑ ↔ 정확도 ↑ |
| ef_construction | 빌드 시 탐색 너비 | 인덱싱 시간 ↑ ↔ 그래프 품질 ↑ |
| ef_search | 쿼리 시 탐색 너비 | 검색 지연 ↑ ↔ recall ↑ |

### 절대 하지 말 것

- **ES 트랜잭션 안에서 직접 호출** (Dual Write) → Outbox/CDC 단방향만
- **가격/재고 같은 변동성 큰 필드 ES 색인** → 변경 폭증 + 재색인 코스트 / Two-Phase Lookup 으로 RDB fetch
- **text 필드에 정확 매칭/sort/aggregation** → keyword multi-field 분리
- **mapping 직접 변경** (특히 dense_vector) → alias swap 으로 reindex
- **임베딩 모델 silent 변경** → mapping 에 model version 명시, dual indexing 기간 두기
- **field number 의 ES 매핑 idempotency 무시** → version_type=external + version_seq 비교
- **shard 100개 이상 단일 노드** → 노드당 shard ≤ 20 × heap_GB 공식 위반
- **모든 노드를 master-eligible 로** → split-brain 위험, master 전용 3개 분리

### ES vs OpenSearch 한 줄

| 영역 | ES | OS |
|---|---|---|
| 라이선스 (2024+) | AGPLv3 + ELv2 | Apache 2.0 |
| ML / Anomaly Detection | 강 (유료) | 별도 plugin |
| kNN / Neural Search | 8.x 네이티브 | 2.x 네이티브 (먼저 안정) |
| LTR | plugin | plugin (OpenSearch LTR 더 활발) |
| API 호환성 | 7.x 까지 거의 호환, 8.x 분기 가속 | OS 1.x = ES 7.10 fork |
| 보안/RBAC | ES Security (basic 무료) | OpenSearch Security plugin |

---

## 학습 진행 가이드

- 권장 순서: **01 → 02 → ... → 20** (Top-down 직진)
- **Phase 1 (01-05)** 은 의존성 큼 → 순서대로. 묶음 1 (B) 로 빠르게 통과 가능하지만 **§2 Lucene + §5 nori decompound 는 무조건 정독** (시니어가 자주 틀리는 곳).
- **Phase 2 (06-14)** 는 묶음 2 (A) 영역이 많음:
  - 06 (BM25) → 09 (Hybrid) → 10 (Re-Rank) 가 새 개념의 핵심 line
  - 08 (HNSW) 은 그래프 알고리즘 배경 도움 (소요 시간 ↑)
  - 11 (ES vs OS) 는 매 phase cross-ref 의 종합 정리 → 후반부에 둠
  - 12 (클러스터/shard) 는 묶음 3 진입 다리
- **Phase 3 (15-18)** 은 msa 코드 (`search/{domain,app,consumer,batch}/`) 동시 grep 권장
  - 18 (PoC) 은 한 endpoint 만 — `product` 검색을 hybrid 로 부분 구현
  - 17 (k3d 시뮬레이션) 은 절차서 작성, 실행은 선택
- **19-improvements.md** = 4 ADR Proposed 초안. 학습 종료 후 별도 리뷰로 `docs/adr/` 승격 결정
- **20-interview-qa.md** = 회독용. 학습 종료 후 1주 간격 2-3회 회독, 묶음 2 의 질문은 **꼬리 3단계** 까지 자가 점검

각 파일 호출:
```
/study:start 19           # 다음 deep file 자동 선택
/study:start 19 06        # 06-tf-idf-bm25-scoring.md 직접 지정
```

---

## 입력 자료

학습 진행 시 다음 자료를 grounding 소스로 활용:

- `study/notes/2026-05-03-원본데이터-보조저장소-패턴-검색엔진.md` — 영상 요약 (코딩하는기술사)
  - **Phase 3 §15** 와 §14 (Sync) 에서 직접 인용
  - 영상 제시 7개 액션 아이템 → §19 ADR 후보 4건과 매핑
- `search/CLAUDE.md` — search 4-모듈 구조, 알리어스 스왑, 멱등성
- `docs/conventions/idempotent-consumer.md` (ADR-0012/0029) — §14 와 직결
- `docs/conventions/transactional-usage.md` — Dual Write 금지 원칙 근거
- `docs/adr/ADR-0025-latency-budget.md` — §14 색인 lag SLA 추가 후보
