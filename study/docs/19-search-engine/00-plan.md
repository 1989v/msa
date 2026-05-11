---
id: 19
title: 검색엔진 심화 — Elasticsearch · OpenSearch · Hybrid · Re-Ranking · BM25 · nori
status: completed
created: 2026-05-03
updated: 2026-05-12
completed: 2026-05-03
augmented: 2026-05-04 (99-concept-catalog 추가) · 2026-05-12 (42-44 online learning track 추가, ADR-0043)
tags: [elasticsearch, opensearch, lucene, bm25, tf-idf, nori, hybrid-search, vector-search, re-ranking, ltr, search-relevance, mab, thompson-sampling, online-learning, bayesian]
difficulty: advanced
estimated-hours: 36
codebase-relevant: true
---

# 검색엔진 심화

## 1. 개요

검색은 "원본 데이터(SoR (System of Record, 원본 데이터 시스템)) + 워크로드별 보조 저장소" 패턴의 가장 대표적인 적용 사례다. msa 의 `search` 서비스는 product DB 를 SoR 로 두고 Kafka CDC (Change Data Capture, 변경 데이터 캡처) 로 ES (Elasticsearch) 인덱스를 유지하는 read-only 모델이며, batch 모듈은 alias swap 으로 무중단 리인덱싱을 한다 (`search/CLAUDE.md`). 본 주제는 **Lucene 내부 → Analyzer/형태소 → BM25 (Best Match 25) 스코어링 → Vector/Hybrid → Re-Ranking → 운영** 까지 시니어 백엔드 관점으로 깊게 본다.

검색은 백엔드 시니어가 잘못 설계하면 가장 비싸게 갚게 되는 영역이다 — **인덱스 매핑 변경은 곧 전체 reindex**, **스코어링 튜닝은 비즈니스 KPI (Key Performance Indicator, 핵심 성과 지표) 직결**, **Dual Write 정합성 실수는 사용자 신뢰 즉시 손상**. 이 모든 것이 한 주제 안에 묶여 있다.

## 2. 학습 목표

- Lucene segment / commit / refresh / flush / merge 의 동작과 검색 가시성·내구성 모델 설명
- Inverted Index 의 자료구조 (term dictionary, postings list, skip list) + analyzer 파이프라인 추적
- 한국어 형태소 분석 (nori vs mecab-ko vs seunjeon) 의 토크나이징 방식 차이 + 사용자 사전·decompound mode 튜닝
- TF-IDF (Term Frequency – Inverse Document Frequency, 용어 빈도-역문서 빈도) → BM25 의 수식적 차이, BM25 의 k1/b 파라미터가 무엇을 통제하는가, function_score 결합 패턴
- Query DSL (Domain-Specific Language, 도메인 특화 언어) 핵심 패턴 (term/match/multi_match/bool/nested/function_score) 과 score 계산 추적 (`explain: true`)
- Vector Search (dense_vector, HNSW (Hierarchical Navigable Small World) 그래프 + ef_construction/M 파라미터) 의 동작과 비용
- Hybrid Search 통합 전략: Reciprocal Rank Fusion (RRF (Reciprocal Rank Fusion, 상호 순위 융합)) vs weighted score, ES/OpenSearch (OpenSearch — 검색 컨텍스트) 각각의 구현
- Re-Ranking 의 두 갈래: cross-encoder 모델 vs Learning-To-Rank (LTR (Learning to Rank, 랭킹 학습) plugin, business signal 결합)
- 클러스터 토폴로지 설계 (master/data/coordinating/ingest, hot-warm-cold, shard 크기/개수 산정 공식)
- Outbox + Kafka + ES Sink / Debezium CDC 동기화 패턴 + eventual consistency 의 색인 lag SLA (Service Level Agreement, 서비스 수준 협약) 정의
- Elasticsearch ↔ OpenSearch 분기의 라이선스/기능/호환성/마이그레이션 비용 정리 → ADR (Architecture Decision Record, 아키텍처 결정 기록) 후보
- 운영 노하우: cluster health 모니터링, hot threads, slow log, snapshot/restore, 재색인 RTO (Recovery Time Objective, 복구 시간 목표) 측정

## 3. 선수 지식

- 자료구조 (inverted index, B-tree, skip list, graph)
- TF-IDF / cosine similarity 기본
- HTTP / JSON / REST
- Kafka 컨슈머 + 멱등성 (`#6`)
- Spring Data 기본 (Repository / Page / Pageable)
- 분산 시스템 기본 (`#7` — eventual consistency (EC, Eventual Consistency, 최종 일관성), CAP (Consistency / Availability / Partition tolerance, 일관성·가용성·분할 내성))
- 임베딩 모델 (text-embedding-ada / sentence-transformers) 의 개념적 이해

## 4. 학습 로드맵

### Phase 1: 기본 개념
- 검색 vs 조회 (filter vs query, score 의 의미)
- Lucene 의 위치 — ES/OpenSearch 는 Lucene 위의 분산 래퍼
- Index / Type(deprecated) / Document / Field
- Mapping (dynamic vs explicit, text vs keyword 의 결정적 차이)
- Analyzer 파이프라인: Char filter → Tokenizer → Token filter
- 표준 analyzer / whitespace / keyword / english / korean 계열 비교
- Inverted Index 자료구조 (term dictionary, postings, position, payload)
- ES vs OpenSearch 의 등장 배경 (라이선스 분기, 2021 ALv2 → SSPL/Elastic License → 2024 AGPLv3)
- 클러스터 / 노드 / 샤드 / 레플리카 기본
- 기본 Query DSL: match / term / range / bool

### Phase 2: 심화

#### 2-1. Lucene 내부 (검색 엔진의 토대)
- **Segment**: 불변 inverted index 단위 — append-only 모델
- **Commit**: segment 를 디스크에 동기화 (durable)
- **Refresh** (default 1s): in-memory segment → searchable (가시성 ≠ 내구성!)
- **Flush**: in-memory buffer + translog → 디스크 segment
- **Merge**: 작은 segment 들을 큰 segment 로 병합 (background)
- **Translog**: durability 보장 (refresh 와 독립)
- **Searcher**: snapshot 기반 — refresh 시점의 segment 집합을 본다
- 결론: ES 의 "near real-time" 은 refresh interval 의 산물 — 1s 미만 검색 가시성 = 비싼 트레이드오프

#### 2-2. Analyzer / 한국어 형태소
- Char filter (HTML strip, mapping)
- Tokenizer (standard, whitespace, ngram, edge_ngram, pattern)
- Token filter (lowercase, stop, synonym, stemmer, asciifolding)
- **한국어 형태소 비교**:
  - **nori** (Lucene 공식, ES/OpenSearch 모두 번들): mecab-ko-dic 기반, decompound_mode (none / discard / mixed)
  - **seunjeon**: 과거 엘라스틱 한국 커뮤니티 표준, 현재 maintenance 약함
  - **mecab-ko**: 외부 plugin
  - **arirang**: 또 다른 옵션
- 사용자 사전 (user_dictionary): 신조어/브랜드명 처리
- 검색용 analyzer ≠ 인덱싱용 analyzer (search_analyzer 분리 패턴)
- 검색 품질 디버깅: `_analyze` API

#### 2-3. 스코어링 (TF-IDF → BM25)
- **TF-IDF**: tf × idf, 길이 정규화 약함
- **BM25** (ES default): `score = idf * (tf * (k1+1)) / (tf + k1 * (1 - b + b * dl/avgdl))`
  - k1: term frequency saturation (default 1.2)
  - b: 문서 길이 정규화 강도 (default 0.75)
  - 튜닝 시점: 도메인 문서 길이 분포가 균일하지 않을 때 b 조정
- BM25F (multi-field BM25) — ES 에서는 multi_match 의 most_fields/best_fields 로 근사
- function_score: 비즈니스 시그널 (인기도, recency, boost) 을 BM25 와 결합
- script_score: 임의 수식
- `explain: true` 로 score breakdown 추적

#### 2-4. Query DSL 패턴
- **leaf queries**: term / terms / range / exists / prefix / wildcard / regexp / fuzzy
- **compound**: bool (must / should / must_not / filter), function_score, dis_max
- **full-text**: match / match_phrase / match_phrase_prefix / multi_match
- **nested / parent-child**: 객체 배열의 정확한 매칭
- **suggest**: term suggester (오타) / completion suggester (자동완성) / phrase suggester
- **하이라이트**: unified / plain / fast vector
- **aggregation**: bucket (terms / histogram / range / nested), metric (sum / avg / cardinality), pipeline
- **filter context vs query context**: filter 는 캐시되고 score 미계산 → 성능 결정적

#### 2-5. Vector / Semantic Search
- dense_vector field type (ES 8 / OpenSearch 2)
- 거리 함수: cosine / dot_product / l2_norm
- **HNSW 그래프**: 다층 그래프 기반 ANN (Approximate Nearest Neighbor, 근사 최근접 이웃)
  - M: 노드당 연결 수 (메모리 ↔ 정확도)
  - ef_construction: 인덱싱 시 탐색 너비
  - ef_search: 쿼리 시 탐색 너비 (정확도 ↔ 지연)
- 인덱싱 비용: dense_vector 는 segment 단위 그래프 빌드 → reindex 매우 비쌈
- 쿼리: kNN (K-Nearest Neighbors, K-최근접 이웃) search (top-k 근접 이웃)
- 임베딩 파이프라인: text → embedding model (OpenAI / sentence-transformers / KoSimCSE) → ES bulk
- 임베딩 모델 변경 = 전체 reindex (모델 버전을 mapping 에 박을 것)

#### 2-6. Hybrid Search
- 동기: BM25 는 정확한 키워드, Vector 는 의미 유사 — 둘이 보완적
- **Reciprocal Rank Fusion (RRF)**: `score = Σ 1/(k + rank_i)` (k 보통 60)
  - 점수 분포가 다른 두 시스템을 rank 만으로 결합 → 정규화 불필요
  - ES 8.8+, OpenSearch 2.10+ 네이티브 지원
- **Weighted score**: BM25 + α × cosine — 정규화 필요, 도메인 튜닝 필수
- **Two-stage**: BM25 후보 추출 → vector 로 re-rank
- 평가 지표: MRR / nDCG / Recall@k

#### 2-7. Re-Ranking
- **Two-stage retrieval**: 1차 retriever (BM25 / vector) → 2차 re-ranker
- **Cross-encoder**: query+document 동시 입력, 정확도↑ 비용↑ — top-N (보통 50-200) 만 적용
- **Learning-To-Rank (LTR)**:
  - ES LTR plugin / OpenSearch LTR
  - feature 추출: BM25 score / 클릭률 / 가격 / 재고 / freshness
  - 모델: LambdaMART / XGBoost
  - 학습 데이터: 클릭 로그 (judgment list 변환)
- **Business re-rank**: 광고/프로모션/카테고리 부스트 — 별도 layer 로 분리

#### 2-8. 클러스터 토폴로지 / 운영
- **노드 역할**: master / data / coordinating / ingest / ML / transform
  - master 는 3개 (split-brain 방지), 전용 인스턴스
  - coordinating-only 노드로 fan-out 분리 (대규모에서)
- **샤드 산정 공식**: 인덱스 크기 / 30~50GB per shard, 노드당 shard ≤ 20 × heap_GB
- **Replica**: 가용성 + 읽기 처리량 (search 는 모든 replica 에서 실행)
- **Hot-warm-cold**: ILM (Index Lifecycle Management, 인덱스 생명주기 관리) (ES) / ISM (OpenSearch) — 시계열 데이터에 유리
- **Allocation awareness**: rack/zone 분산
- 모니터링: cluster health (green/yellow/red), pending tasks, hot threads, indexing/search rate, GC pause

#### 2-9. 동기화 / Dual Write 방어
- 안티패턴: app 트랜잭션 안에서 RDB + ES 동시 write → 부분 실패 시 부정합
- **Outbox + Kafka + ES Sink** (msa 현재 패턴): RDB 트랜잭션 내 outbox 테이블 기록 → relay → Kafka → consumer → ES bulk
- **Debezium CDC**: binlog → Kafka → ES sink connector
- 멱등성: document `_id` 를 SoR PK 로 고정 + version_seq 비교 (`version_type=external`)
- 색인 lag SLA: 변경 → 검색 가시성까지 P99 (예: 5s)
- 재색인 (reindex):
  - alias swap 패턴 (msa search:batch 모듈)
  - reindex API vs 외부 reindexer (large-scale)
  - 임베딩 모델 변경 시 dual indexing 기간

#### 2-10. ES vs OpenSearch 분기
- 2021: Elastic 라이선스 변경 (ALv2 → SSPL/Elastic License v2)
- AWS fork → OpenSearch
- 2024: ES 가 AGPLv3 추가 → 다시 OSS 진영
- 기능 차이: ML/Anomaly Detection (ES 우위), kNN/LTR plugin (OpenSearch 빠른 기본 탑재)
- API 호환성: 2.x 까지는 거의 호환, 8.x 부터 분기 가속
- 마이그레이션 비용: client 라이브러리 / dashboard / 보안 설정 / RBAC 모두 다름

#### 2-11. 보안 / 운영
- 인증/인가: ES Security (basic 이후 무료) / OpenSearch Security plugin
- snapshot/restore (S3, GCS)
- index lifecycle (hot → warm → cold → frozen → delete)
- slow log / search profiler
- circuit breaker (parent / fielddata / request)

### Phase 3: 실전 적용 (msa 코드베이스 grounding)

- `search/CLAUDE.md` 4-모듈 구조 (`domain` / `app` / `consumer` / `batch`) 의 책임 분리 검증
- `search:consumer` 의 Kafka 구독 토픽 (`product.item.created` / `product.item.updated`) → ES 인덱싱 흐름 추적
  - 멱등성 패턴 (`docs/conventions/idempotent-consumer.md`, ADR-0012/0029) 이 어떻게 적용됐는가
  - bulk indexing batch size / refresh interval 튜닝 여지
- `search:batch` 의 alias swap reindex 코드 분석 — RTO 측정 가능 여부
- ES 매핑 정의 (text vs keyword 분리, nori 적용 위치, multi-field 패턴) 검토
- product 가격/재고 같은 변동성 큰 필드를 ES 에 넣고 있는가 — Two-Phase Lookup 원칙 위반 여부
- ES 와 OpenSearch 가 모두 인프라에 존재 (CLAUDE.md `local Dev` 섹션) → 일원화 ADR 후보 평가
- ADR-0025 latency budget 에 **색인 lag P99 SLA** 항목 추가 검토
- 임베딩 기반 hybrid search PoC 시나리오: product 카테고리 검색에 KoSimCSE 적용 가정
- LTR 적용 시나리오: 클릭 로그 (analytics 서비스의 ClickHouse) → judgment list → LambdaMART
- 입력 자료: `study/notes/2026-05-03-원본데이터-보조저장소-패턴-검색엔진.md` (영상 요약) 의 7개 액션 아이템을 ADR 후보로 승격

### Phase 4: 면접 대비

- "RDB 의 LIKE 검색 대신 ES 를 쓰는 이유는?"
- "Inverted Index 가 어떻게 빠른가? B-Tree 인덱스와의 차이는?"
- "ES 의 refresh / flush / commit 차이는? near real-time 이 무슨 뜻인가?"
- "TF-IDF 와 BM25 의 차이는? BM25 의 k1, b 는 무엇을 통제하는가?"
- "한국어 형태소 분석기 nori 의 decompound mode 3가지 차이는?"
- "text 와 keyword 타입의 차이는? 언제 어느 것을 써야 하나?"
- "filter context 와 query context 의 차이는?"
- "샤드 개수는 어떻게 정하나?"
- "Hybrid Search 의 RRF 가 weighted score 보다 나은 점은?"
- "HNSW 그래프의 M, ef_construction, ef_search 파라미터는 무엇인가?"
- "Re-Ranking 을 왜 별도로 하는가? cross-encoder 와 LTR 의 차이는?"
- "RDB 와 ES 의 정합성은 어떻게 맞추는가? Dual Write 의 위험은?"
- "Outbox 패턴과 CDC (Debezium) 의 차이는? 어떤 상황에서 어느 것을 쓰는가?"
- "ES 와 OpenSearch 중 어떤 것을 선택하겠는가? 왜?"
- "검색 품질을 어떻게 측정하는가? (MRR, nDCG, Recall@k)"
- "운영 중 ES 클러스터가 yellow → red 가 됐다. 진단 순서는?"
- "임베딩 모델을 바꾸면 어떤 비용이 드는가?"

## 5. 코드베이스 연관성

**높음** — msa 에 dedicated `search` 서비스 존재:

| 위치 | 역할 |
|---|---|
| `search/CLAUDE.md` | 4-모듈 구조, 읽기 전용 ES 모델, alias swap |
| `search/domain/` | 검색 모델, 포트 (Pure Kotlin) |
| `search/app/` | REST API (port 8083) |
| `search/consumer/` | Kafka → ES 인덱싱 (port 8084) |
| `search/batch/` | 전체 리인덱싱 (port 8085, alias swap) |
| `docs/conventions/idempotent-consumer.md` | ES Sink 의 재처리 안전성과 직결 (ADR-0012/0029) |
| `docs/conventions/transactional-usage.md` | "외부 IO 분리" → Dual Write 방지 원칙 |
| `docs/adr/ADR-0025-latency-budget.md` | 색인 lag SLA 추가 검토 대상 |
| `k8s/infra/local/` | ES + OpenSearch 동시 운영 → 일원화 ADR 후보 |
| `analytics/` (ClickHouse) | LTR judgment list 의 클릭 로그 source |

## 6. 참고 자료

- Elasticsearch 공식 docs (elastic.co/guide)
- OpenSearch 공식 docs (opensearch.org/docs)
- Lucene 공식 (lucene.apache.org)
- "Elasticsearch: The Definitive Guide" (구버전이지만 Lucene/Inverted Index 설명 우수)
- "Relevant Search" — Doug Turnbull, John Berryman (BM25, function_score, LTR)
- "AI-Powered Search" — Trey Grainger 외 (semantic + hybrid + re-ranking)
- BM25 원논문: "Okapi at TREC-3" (Robertson et al., 1995)
- HNSW 원논문: "Efficient and robust approximate nearest neighbor search using HNSW graphs" (Malkov & Yashunin, 2018)
- nori 공식: lucene.apache.org/core/9_x/analysis/nori
- ES LTR plugin: github.com/o19s/elasticsearch-learning-to-rank
- OpenSearch Neural Search / RRF docs

## 7. 미결 사항 / 브레인스토밍 결정 로그

### 7-A. 학습 정책 (확정 — 2026-05-03)

> **모든 서브토픽 풀 커버리지** — 14개 서브토픽 + Phase 1 기본 개념까지 모두 글로 남긴다. **스킵 없음**. 목적은 복습용 자료(future-self 가 다시 읽을 때 빈 곳이 없도록).

이 정책은 분량 산정에 직접 영향:
- estimated-hours: 20 → **26** 으로 상향
- 묶음 2 (Vector·Hybrid·Re-Rank) 가 자가평가 A → 개념을 더 풀어 써야 함 → 분량 가중

### 7-B. 사용자 자가평가 (확정 — 2026-05-03)

| 묶음 | 범위 | 레벨 | 작성 무게 |
|---|---|---|---|
| 1. 인덱싱·스코어링 기본기 | Lucene segment/refresh, Inverted Index, Analyzer, nori, BM25/TF-IDF, Query DSL | **B** (실무 경험 O, 내부/튜닝 약함) | 기본 개념 + **심화·튜닝 보강** (BM25 k1/b 수식 직관, refresh vs flush 명확화, nori decompound 3-mode 비교) |
| 2. Vector·Hybrid·Re-Ranking | dense_vector, HNSW, RRF, cross-encoder, LTR | **A** (처음 다수) | **개념부터 풀어쓰기**, ES/OpenSearch API 예제로 grounding, 임베딩 모델 학습/배포는 개념까지만 (실 학습 X) |
| 3. 클러스터·동기화·운영 | master/data 노드, shard 산정, Outbox/CDC, alias swap, ILM, snapshot | **B** (운영 경험 일부, 시니어 의사결정 약함) | 기본 + **시니어 의사결정 영역 강조** (shard 산정 공식, CDC vs Outbox 선택 기준, 재색인 RTO 측정 방법) |

### 7-C. 학습 목표 가중 (확정 — 2026-05-03, 라운드 2)

> **C — 균형 (면접 + 실무 둘 다)** 선택. 모든 Phase 풀 커버리지, 면접·실무 모두 1급 자료.

산출물 무게: **면접 카드 35% / 코드 grounding 35% / 개념 30%**

- Phase 4 (면접): 17개 질문 모두 모범답안 + 꼬리질문 + 악마의 변호인 시나리오까지 작성
- Phase 3 (코드 grounding): msa search 서비스 4-모듈 직접 분석 + 개선 후보 도출 + ADR 후보 승격
- Phase 1·2 (개념·심화): 14개 서브토픽 풀 커버리지 (학습 정책 §7-A 와 결합)

estimated-hours: 26 → **32** 으로 재상향 (균형 + 풀 커버리지 결합 효과)

### 7-D. 잔여 미결 일괄 결정 (확정 — 2026-05-03, 라운드 2)

C 선택과 모순되지 않는 방향으로 5건 일괄 처리:

| 항목 | 결정 |
|---|---|
| **PoC 코드 작성** | ✅ **부분 PoC** — msa search 서비스에서 한 endpoint (예: product 검색) 만 hybrid search (BM25 + dense_vector + RRF) 로 PoC 코드 작성. 나머지는 plan 수준. |
| **ES vs OpenSearch 비교 비중** | ✅ **이중 트랙** — 매 phase 마다 cross-reference 한 줄씩 (`> [OS 차이]: ...`) + Phase 2 §11 단일 종합 챕터. |
| **ADR 작성 범위** | ✅ **4건 모두 Proposed 단계까지** — `19-improvements.md` 한 파일에 4 ADR 초안 (gRPC #18 의 `19-improvements.md` 패턴 차용). 승격 여부는 학습 후 별도 판단. |
| **k3d 운영 시뮬레이션** | ✅ **시나리오 절차서 작성** — 실제 실행은 선택, 절차/예상결과/디버깅 체크리스트는 운영 챕터에 포함 (ES 노드 죽이기 / shard 리밸런싱 관찰 / yellow→red 진단). |
| **Phase D 학습 전략** | ✅ **자동 결정** — 풀 커버리지 + C 선택 → 노트 + Q&A 카드 둘 다, PoC 코드 실습 포함 (위 항목으로 충족). |

### 7-E. 산출물 구조 (확정)

플랜 실행 시 다음 deep file 들이 `19-search-engine/` 하위에 생성될 예정:

```
00-plan.md                                  (본 파일)
00-preview.md                               (소주제 지도, /study:exec 19)
01-search-overview.md                       (검색 vs 조회, ES/OS 등장 배경)
02-lucene-internals.md                      (segment/refresh/flush/merge)
03-inverted-index-deep.md                   (term dictionary/postings/skip list)
04-analyzer-pipeline.md                     (char filter/tokenizer/token filter)
05-korean-morphology-nori.md                (nori vs mecab-ko, decompound, 사용자 사전)
06-tf-idf-bm25-scoring.md                   (수식·k1/b 직관·function_score)
07-query-dsl-patterns.md                    (term/match/multi_match/bool/nested/suggest)
08-vector-search-hnsw.md                    (dense_vector, HNSW, M/ef_construction)
09-hybrid-search-rrf.md                     (BM25+vector, RRF vs weighted)
10-reranking-cross-encoder-ltr.md           (cross-encoder, LTR plugin)
11-elasticsearch-vs-opensearch.md           (라이선스·기능·마이그레이션)
12-cluster-topology-shard-sizing.md         (master/data/coordinating, shard 산정 공식)
13-indexing-pipeline-ilm.md                 (ingest pipeline, alias swap, ILM/ISM)
14-sync-outbox-cdc.md                       (Outbox vs Debezium CDC, 색인 lag SLA)
15-msa-search-grounding.md                  (search 4-모듈 직접 분석)
16-operations-monitoring-rto.md             (cluster health, hot threads, snapshot, 재색인 RTO)
17-k8s-failure-simulation.md                (k3d ES 노드 죽이기 시나리오 절차서)
18-hybrid-search-poc.md                     (msa search 서비스 부분 PoC 코드)
19-improvements.md                          (ADR 4건 Proposed 초안 통합)
20-interview-qa.md                          (17 면접 질문 + 꼬리질문 + 악마의 변호인)
21-followup-qa.md                           (보강 Q&A — Two-Phase 가격 필터 / Refresh-Translog 단계별 / Segment 증가 패턴)
42-bayesian-beta-thompson.md                (★ 2026-05-12 추가 — Bayesian update + Beta(α,β) + Thompson Sampling 원리)
43-mab-algorithms.md                        (★ 2026-05-12 추가 — ε-greedy/UCB1/Thompson/LinUCB/Neural Bandit 비교)
44-msa-bandit-grounding.md                  (★ 2026-05-12 추가 — msa ThompsonReranker grounding + ADR-0043 매핑)
99-concept-catalog.md                       (★ 2026-05-04 추가 — ES/OS 공식 reference 기준 풀 개념 카탈로그 + 심화 템플릿. percolate/ELSER/PIT/retrievers/geo/span/MLT 등 누락 영역 발굴)
```

총 **26 deep files** (00-plan + 00-preview + 01~21 + 42~44 online learning + 99 catalog).

### 7-F. 모든 미결 종결

> 본 plan 의 미결 사항은 모두 종결됐습니다. 추가 조정 필요 시 `/study:bs 19` 재호출.

## 8. 원본 메모

```
19. 검색엔진 심화 (Elasticsearch · OpenSearch · Hybrid Search · Re-Ranking)
  19-1. Lucene 기반 내부 (segment / commit / refresh / flush / merge)
  19-2. Inverted Index + Analyzer/Tokenizer/Filter pipeline
  19-3. 한국어 형태소 분석기 (nori vs mecab-ko vs seunjeon, 사용자 사전, decompound mode)
  19-4. 스코어링 알고리즘 (TF-IDF → BM25, BM25 파라미터 k1/b 튜닝, function_score)
  19-5. Query DSL 패턴 (term/match/multi_match/bool/nested/function_score, 하이라이트, suggest)
  19-6. Vector / Semantic Search (dense_vector, HNSW, kNN, 임베딩 파이프라인)
  19-7. Hybrid Search (BM25 + dense, RRF · Reciprocal Rank Fusion, weighted score)
  19-8. Re-Ranking (cross-encoder, LTR · Learning To Rank, business signal 결합)
  19-9. Cluster 토폴로지 (master/data/coordinating/ingest 노드, shard/replica, allocation awareness)
  19-10. 인덱싱 파이프라인 (ingest pipeline, processor, reindex, alias, ILM/ISM)
  19-11. Elasticsearch vs OpenSearch 분기 (라이선스 변천, 기능 차이, 호환성, 마이그레이션 비용)
  19-12. 동기화 전략 (Outbox + Kafka + ES Sink, Debezium CDC, eventual consistency, 색인 lag SLA)
  19-13. msa search 서비스 grounding (실제 인덱스 설계, 가격/재고 같은 변동성 큰 필드 분리 원칙)
  19-14. 운영 — 모니터링 (cluster health, hot threads, slow log), 재색인 RTO, 백업/스냅샷
  > 입력 자료: study/notes/2026-05-03-원본데이터-보조저장소-패턴-검색엔진.md (코딩하는기술사 영상 요약 — 원본 + 보조 저장소 패턴 + 2단계 조회 + Polyglot Persistence)
```
