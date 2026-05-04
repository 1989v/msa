---
parent: 19-search-engine
seq: 99
title: ES / OpenSearch 개념 카탈로그 — Full-Coverage Index + 심화 템플릿
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
related:
  - 00-plan.md
  - 00-preview.md
  - 01-search-overview.md
sources:
  - https://www.elastic.co/docs/reference (Elasticsearch reference)
  - https://docs.opensearch.org/3.5 (OpenSearch 3.5 docs)
---

# 99. ES / OpenSearch 개념 카탈로그

> **목적** — 19-search-engine 의 22개 deep file 이 이미 다룬 개념과, 공식 레퍼런스 트리 기준으로 **빠져 있는 영역(예: percolate, geo, span, ELSER, ES|QL, 검색 파이프라인 등)** 을 한 표에 모은다. 새 보강 학습이 필요할 때 이 파일에서 후보를 꺼내 표준 템플릿(§4)으로 작성한다.
>
> **이 파일의 위치** — 정적 인덱스가 아니라 **living doc**. 새 개념이 ES/OS major release 에 추가되면 본 파일에 행을 추가하고, 심화 노트가 만들어지면 `심화 파일` 컬럼을 채운다.
>
> **소스 기준** — Elasticsearch (ES) 공식 reference (8.19 / 9.x 현재 docs) + OpenSearch (OS) 3.5 docs (2026-05 기준). context7 MCP (Model Context Protocol) 로 cross-check.

---

## 0. 사용법

### 새 개념을 발견했을 때

1. 이 파일의 §2 카테고리 표에 행 추가 (1-2 줄 소개 + 공식 링크 + 상태=`★ 신규`)
2. 학습 우선순위가 높으면 §3 Top-N 후보에 승격
3. 심화 노트가 만들어지면 `심화 파일` 컬럼에 파일명 기록 + 상태=`✅ 커버`
4. 어차피 안 다룰 것이면 상태=`skip` + 사유 (예: `비활성 (deprecated)`, `Elastic 전용 라이선스`)

### 기존 학습을 복습할 때

- §1 의 매핑 표로 이미 어떤 deep file 이 어디까지 커버하는지 확인
- §2 카테고리 트리에서 인접 개념을 같이 훑어 누락 점검

### 면접/실무 직전 점검

- §3 Top-N 후보 = 시니어 면접에서 "ES 공식 docs 뒤져본 사람" 신호 줄 수 있는 영역
- §4 템플릿으로 30분짜리 mini-deep-dive 즉석 작성 가능

### 상태(Status) 표기 범례

| 표기 | 의미 |
|---|---|
| ✅ 커버 | 19-search-engine 내 deep file 에 충분히 다룸 |
| 🟡 부분 | 언급은 됐지만 별도 절·심화 없음 → 보강 후보 |
| ★ 신규 | 본 카탈로그에서 발굴, 아직 다루지 않음 → 심화 후보 |
| skip | 의도적 비커버 (사유 명시) |

---

## 1. 이미 커버한 영역 매트릭스

기존 22개 deep file 이 다룬 핵심 개념을 카테고리별로 묶어 본다. 누락 점검의 출발점.

| 카테고리 | 핵심 개념 | 다룬 파일 |
|---|---|---|
| Lucene 내부 | segment / commit / refresh / flush / merge / translog | [02-lucene-internals.md](02-lucene-internals.md), [21-followup-qa.md](21-followup-qa.md) |
| Inverted Index | term dictionary / postings / skip list / B-Tree 비교 / doc_id | [03-inverted-index-deep.md](03-inverted-index-deep.md) |
| Analyzer | char filter / tokenizer / token filter / built-in / custom / `_analyze` API / search_analyzer 분리 | [04-analyzer-pipeline.md](04-analyzer-pipeline.md) |
| 한국어 형태소 | nori / mecab-ko / seunjeon / decompound mode (none/discard/mixed) / 사용자 사전 / nori_part_of_speech / nori_readingform / synonym | [05-korean-morphology-nori.md](05-korean-morphology-nori.md) |
| 스코어링 | TF-IDF / BM25 (k1, b) / function_score / script_score / similarity 모델 / `explain: true` | [06-tf-idf-bm25-scoring.md](06-tf-idf-bm25-scoring.md) |
| Query DSL 패턴 | leaf / compound / bool / multi_match / nested / parent-child / suggester / highlight / aggregations / filter vs query context | [07-query-dsl-patterns.md](07-query-dsl-patterns.md) |
| Vector Search | dense_vector / cosine·dot·l2 / HNSW (M, ef_construction, ef_search) / kNN / ANN (Approximate Nearest Neighbor, 근사 최근접 이웃) / 임베딩 파이프라인 / 인덱싱 비용 | [08-vector-search-hnsw.md](08-vector-search-hnsw.md) |
| Hybrid Search | BM25 + dense / RRF (Reciprocal Rank Fusion, 상호 순위 융합) / weighted score / Two-Stage / 평가지표 (MRR / nDCG / Recall@k) | [09-hybrid-search-rrf.md](09-hybrid-search-rrf.md) |
| Re-Ranking | Cross-Encoder / LTR (Learning-To-Rank, 학습 기반 랭킹) plugin / Business Re-Rank | [10-reranking-cross-encoder-ltr.md](10-reranking-cross-encoder-ltr.md) |
| ES vs OpenSearch | 라이선스 변천 / 기능 격차 / API 호환성 / 마이그레이션 비용 / 운영 환경 차이 | [11-elasticsearch-vs-opensearch.md](11-elasticsearch-vs-opensearch.md) |
| 클러스터 토폴로지 | master/data/coordinating/ingest 노드 / shard sizing 공식 / replica / allocation awareness / routing | [12-cluster-topology-shard-sizing.md](12-cluster-topology-shard-sizing.md) |
| 인덱싱 파이프라인 | bulk API / ingest pipeline / alias swap / reindex / ILM (Index Lifecycle Management) / ISM (Index State Management) | [13-indexing-pipeline-ilm.md](13-indexing-pipeline-ilm.md) |
| 동기화 | Outbox / CDC (Change Data Capture, 변경 데이터 캡처) Debezium / 멱등성 (version_type=external) / 색인 lag SLA (Service Level Agreement, 서비스 수준 협약) | [14-sync-outbox-cdc.md](14-sync-outbox-cdc.md) |
| msa grounding | search 4-모듈 / ProductEsDocument / EsBulkDocumentProcessor / Alias Swap | [15-msa-search-grounding.md](15-msa-search-grounding.md) |
| 운영 모니터링 | cluster health (green/yellow/red) / hot threads / slow log / snapshot/restore / 4 Golden Signals / 재색인 RTO (Recovery Time Objective, 복구 시간 목표) / Prometheus | [16-operations-monitoring-rto.md](16-operations-monitoring-rto.md) |
| 장애 시뮬레이션 | data node 죽이기 / master quorum / disk flood / thread pool exhaust / network partition / snapshot restore | [17-k8s-failure-simulation.md](17-k8s-failure-simulation.md) |
| Hybrid PoC | msa search 부분 PoC (Proof of Concept, 개념 증명) / 임베딩 클라이언트 추상화 / RRF endpoint | [18-hybrid-search-poc.md](18-hybrid-search-poc.md) |
| 개선 후보 | ADR-XXXX-1~4 (lag SLA / Two-Phase Lookup / OS 일원화 / Hybrid 도입) | [19-improvements.md](19-improvements.md) |
| 면접 카드 | Q1~Q17 + 꼬리질문 + 악마의 변호인 | [20-interview-qa.md](20-interview-qa.md) |
| 보강 Q&A | Two-Phase 가격 필터 / Refresh-Translog 단계별 / Segment 증가 패턴 | [21-followup-qa.md](21-followup-qa.md) |
| 평가 메트릭 | Precision / Recall / F1 / MRR / MAP / DCG / IDCG / nDCG — judgment list + ES `_rank_eval` API | [34-eval-metrics-precision-recall-ndcg.md](34-eval-metrics-precision-recall-ndcg.md) |
| function_score modifier | NONE / SQRT / LN1P / LN2P / LOG1P / LOG2P / SQUARE / RECIPROCAL — 수식·0 처리·featureScore 분포·msa 적용 점검 | [35-field-value-factor-modifiers.md](35-field-value-factor-modifiers.md) |
| 자동완성 | ngram / edge_ngram / search_as_you_type / completion suggester (FST) / `_terms_enum` / 한국어 자모 분리 (ICU NFD) / msa 단계적 도입 | [36-autocomplete-ngram-edgengram.md](36-autocomplete-ngram-edgengram.md) |
| Index/Component Template | 8.x composable templates / resolution 알고리즘 / `index.codec` / `index.sort.*` / `refresh_interval` / `translog.*` / msa 분해 도입 | [37-index-templates.md](37-index-templates.md) |
| Mapping Power Features | numeric/scaled_float / object 4-패턴 / copy_to / runtime fields / dynamic_templates / subobjects / doc_values / norms / index_options / ignore_above / null_value / _routing / combined_fields (BM25F) / terms-lookup / dis_max | [38-mapping-power-features.md](38-mapping-power-features.md) |
| 검색 운영 API | _msearch / _count / _field_caps / _validate / _search/template / _async_search / _update_by_query / _delete_by_query / _split / _shrink / _clone / _tasks / _cluster/allocation/explain / _cat/* | [39-search-ops-apis.md](39-search-ops-apis.md) |
| 시계열 / Data Streams | Data Streams / DSL (8.x) vs ILM / Rollover / Downsampling / histogram·aggregate_metric_double / Transforms / SLM / Searchable Snapshots / TSDS | [40-data-streams-downsampling.md](40-data-streams-downsampling.md) |
| 벡터 고급 | kNN with filter (pre/post) / num_candidates / similarity 4종 / ES BBQ·INT8·INT4 quantization / OS k-NN engines (faiss/nmslib/lucene) / 메모리 비용 모델 | [41-vector-advanced.md](41-vector-advanced.md) |

### 1-A. 한눈에 보는 갭 진단

위 매트릭스에 비춰 **명백히 빠진 영역**(공식 docs 에는 한 챕터씩 있는데 19 시리즈엔 없는 것):

1. **Specialized Queries** — percolate / more_like_this / pinned / distance_feature / rank_feature / wrapper / rule / script
2. **Geo Queries / Geo Aggregations** — geo_distance / geo_shape / geo_bounding_box / geohash_grid / geotile_grid
3. **Joining Queries 디테일** — has_child / has_parent / parent_id (nested 만 다룸)
4. **Span Queries 전체** — span_term / span_near / span_first / span_or / span_within / span_containing / field_masking_span
5. **Full-text 추가** — combined_fields / intervals / query_string / simple_query_string / match_bool_prefix
6. **Pagination & 일관성** — Point in Time (PIT) / search_after / Scroll (legacy) / Async Search
7. **Field Collapsing + Inner Hits + Rescore** — group-by 검색
8. **Search Templates (Mustache) / Render API**
9. **Profile API / Validate / Explain / Field Caps / Terms Enum / Search Shards / Vector Tile**
10. **Aggregations 풀 카탈로그** — composite / significant_terms / rare_terms / sampler / cardinality(HLL) / top_metrics / geo_centroid / pipeline aggs (10여 종)
11. **Mapping 필드 타입 풀 카탈로그** — flattened / wildcard / match_only_text / search_as_you_type / completion / range types / version / ip / shape / point / histogram / aggregate_metric_double / counted_keyword / percolator / token_count / join field
12. **Mapping 파라미터** — index_options / store / norms / copy_to / fields(multi-field) / dynamic_templates / runtime_fields / subobjects / similarity / eager_global_ordinals
13. **Index Templates / Component Templates / Data Streams / Downsampling / Transforms**
14. **Ingest Processors 풀 카탈로그** — enrich / inference / redact / fingerprint / community_id / network_direction / reroute / circle / dot_expander 등
15. **Cross-Cluster Search (CCS) / Cross-Cluster Replication (CCR)** + remote clusters mode
16. **Searchable Snapshots / Frozen Tier / SLM (Snapshot Lifecycle Management)** — Elastic 전용
17. **Update by Query / Delete by Query / Reindex from Remote / Shrink/Split/Clone**
18. **보안** — Native realm / SAML / OIDC / API keys / Service accounts / DLS-FLS / Audit logs / TLS-mTLS
19. **ES 8.x 신규 시맨틱 스택** — Inference API / **ELSER** (Elastic Learned Sparse EncodeR) / **E5** / **semantic_text** field / kNN with filter / 벡터 양자화 (BBQ / INT8 / INT4)
20. **Retrievers API (8.14+)** — RRF / linear / text_similarity_reranker / knn — top-level 재정렬
21. **Query Languages 분기** — **EQL** (Event Query Language) / **ES|QL** (Elasticsearch Query Language) / **SQL API**
22. **Watcher (Elastic) / Anomaly Detection ML / Categorization ML / Transform / Rollup→Downsampling**
23. **OpenSearch 고유 스택** — Search Pipeline (request/response/search-phase processors) / **Hybrid 쿼리 + normalization-processor** / Neural / Neural Sparse + 2-phase / k-NN engines (faiss / nmslib / lucene) + 양자화 / **ML Commons** / Conversational Search / **PPL** (Piped Processing Language) / Alerting / Anomaly Detection (RCF) / Security Analytics / Notifications

→ 본 카탈로그 §2 가 위 23 영역을 카테고리별로 펼친다.

---

## 2. 카테고리별 개념 트리

각 카테고리는 (a) 공식 docs 의 챕터 구조를 반영하고 (b) 1-2 줄 핵심 + 공식 링크 + 상태 + 매핑 파일(있으면)을 한 행으로 묶는다. 링크는 안정 docs 트리 (`elastic.co/docs/reference`, `docs.opensearch.org/3.5`) 기준.

### A. Mapping — Field Types

| 개념 | 1-줄 정의 | 공식 링크 | 상태 |
|---|---|---|---|
| `text` / `keyword` | analyzed text vs exact keyword. multi-field 패턴(`title.raw`)이 표준 | [text](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/text), [keyword](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/keyword) | ✅ 커버 (#04, #15) |
| `constant_keyword` | 모든 doc 가 같은 값을 갖는 keyword (data stream tier 분류 등) | [constant_keyword](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/keyword) | ★ 신규 |
| `wildcard` | 비정형 텍스트 (로그·URL 등) prefix/wildcard 효율 검색용 | [wildcard](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/keyword) | ★ 신규 |
| `match_only_text` | 점수 계산용 통계 비저장, 디스크 ↓ — 로그 분석 워크로드용 | [match-only-text](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/match-only-text) | ★ 신규 |
| `search_as_you_type` | edge_ngram + shingle 자동, prefix·infix 검색 빠름 | [search-as-you-type](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/search-as-you-type) | ✅ 커버 ([36](36-autocomplete-ngram-edgengram.md)) |
| `completion` | suggester 전용 FST (Finite State Transducer) 기반 자동완성 | [suggesters/completion](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-suggesters) | ✅ 커버 ([36](36-autocomplete-ngram-edgengram.md)) |
| numeric (`long`/`integer`/`short`/`byte`/`double`/`float`/`half_float`/`scaled_float`/`unsigned_long`) | 정밀도 vs 디스크 트레이드오프. `scaled_float` = 정수 저장 + scale 분리 → 가격 필드에 유용 | [numeric](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/number) | ✅ 커버 ([38](38-mapping-power-features.md) numeric/scaled_float) |
| `date` / `date_nanos` | epoch_millis vs ns 정밀도. APM/관측에선 nanos 필수 | [date](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/date), [date_nanos](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/date_nanos) | ★ 신규 |
| `boolean` / `binary` | 단순 타입 | docs/reference/elasticsearch/mapping-reference | ✅ 일반 |
| `ip` / `version` | IP 주소·SemVer 정렬 인식 | [ip](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/ip), [version](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/version) | ★ 신규 |
| range types (`integer_range`/`float_range`/`long_range`/`double_range`/`date_range`/`ip_range`) | 도큐먼트가 범위를 들고 있는 케이스 (예: 이벤트 유효기간) | [range](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/range) | ★ 신규 |
| `object` / `nested` / `flattened` / `join` | 객체 표현 4 패턴 — 평탄화 / 정확매칭 / dynamic key / parent-child | [nested](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/nested), [flattened](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/flattened), [join](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/parent-join) | ✅ 커버 ([38](38-mapping-power-features.md) object 4-패턴) |
| `geo_point` / `geo_shape` / `point` / `shape` | 지리 vs 평면 좌표 + Lat-Lon vs polygon | [geo-point](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/geo-point), [geo-shape](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/geo-shape) | ★ 신규 |
| `dense_vector` | 고정 차원 벡터 (HNSW + ANN). 양자화·차원·similarity 옵션 | [dense-vector](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/dense-vector) | ✅ 커버 (#08) |
| `sparse_vector` | ELSER 출력 같은 sparse 가중치. token weight 기반 BM25-like 점수 | [sparse-vector](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/sparse-vector) | ✅ 커버 ([27](27-mapping-field-types.md), [28](28-elser-semantic-text.md)) |
| `semantic_text` | ES 8.13+ — 자동 chunking + inference endpoint 호출, 매핑만 선언하면 임베딩 자동 | [semantic-text](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/semantic-text) | ✅ 커버 ([27](27-mapping-field-types.md), [28](28-elser-semantic-text.md)) |
| `rank_feature` / `rank_features` | 사전 계산된 numeric 가중치를 rank-only 색인 — pagerank·인기도 효율 결합 | [rank-features](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/rank-features) | ✅ 커버 ([27](27-mapping-field-types.md), [32](32-specialized-queries.md)) |
| `token_count` | 다른 필드의 토큰 수를 정수 색인 — 길이 기반 필터/정렬 | [token-count](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/token-count) | ✅ 커버 ([38](38-mapping-power-features.md)) |
| `histogram` / `aggregate_metric_double` | 사전 집계된 분포·통계 저장 → downsampling/롤업 | [histogram](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/histogram), [aggregate-metric-double](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/aggregate-metric-double) | ✅ 커버 ([40](40-data-streams-downsampling.md)) |
| `percolator` | **stored query** 를 색인하는 특별 타입 — `percolate` 쿼리의 짝 | [percolator field](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/percolator) | ✅ 커버 ([22](22-percolate.md), [27](27-mapping-field-types.md)) |
| `alias` field | 필드 alias — 마이그레이션·ECS 호환 | [alias](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/field-alias) | ★ 신규 |
| meta fields (`_id`, `_source`, `_index`, `_routing`, `_ignored`, `_meta`, `_doc_count`) | 시스템 메타. `_source` disable, `_routing` 로 shard 고정 등 운영 결정 직결 | [meta-fields](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/mapping-meta-field) | 🟡 부분 (`_routing` 만) |

### B. Mapping — 파라미터

| 개념 | 1-줄 정의 | 공식 링크 | 상태 |
|---|---|---|---|
| `analyzer` / `search_analyzer` / `search_quote_analyzer` | 색인용 vs 쿼리용 분리, phrase 전용 분리 | [analyzer params](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/analyzer) | ✅ 커버 (#04) |
| `normalizer` (keyword 전용) | keyword 에 lowercase·asciifolding 같은 token filter 만 적용 | [normalizer](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/normalizer) | ★ 신규 |
| `index` (true/false) | 색인 여부 — false 시 검색 불가, _source 만 저장 | [index param](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/mapping-index) | ★ 신규 |
| `store` | _source 와 별개 stored field — `_source` disable 시 의미 | [store](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/mapping-store) | ★ 신규 |
| `doc_values` / `norms` / `index_options` | 정렬·집계 효율 / 점수 계산 통계 저장 / postings 상세도 | [doc-values](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/doc-values), [norms](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/norms), [index-options](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/index-options) | ✅ 커버 ([38](38-mapping-power-features.md)) |
| `fields` (multi-field) | 한 source → 여러 색인 (`title` text + `title.raw` keyword) | [multi-fields](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/multi-fields) | ✅ 커버 (#04) |
| `copy_to` | 여러 필드 값을 합쳐 가상 필드 생성 — `multi_match` 대안 | [copy-to](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/copy-to) | ✅ 커버 ([38](38-mapping-power-features.md)) |
| `dynamic` / `dynamic_templates` | 동적 매핑 정책, 패턴별 타입 자동 매핑 | [dynamic-templates](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/dynamic-templates) | ✅ 커버 ([38](38-mapping-power-features.md)) |
| `runtime` fields (schema-on-read) | 색인 없이 query/agg 시점 계산 | [runtime](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/runtime) | ✅ 커버 ([38](38-mapping-power-features.md)) |
| `subobjects: false` | dot-notation 필드명을 평탄화 (`a.b.c` 한 leaf 로) | [subobjects](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/subobjects) | ✅ 커버 ([38](38-mapping-power-features.md)) |
| `similarity` (BM25/boolean/scripted/dfr/dfi/ib/lmd/lmj) | 필드별 점수 모델 교체 | [similarity](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/similarity) | ✅ 커버 (#06) |
| `eager_global_ordinals` | terms agg/parent-child 첫 쿼리 latency ↓ — refresh 마다 빌드 | [eager-global-ordinals](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/eager-global-ordinals) | ✅ 커버 ([38](38-mapping-power-features.md)) |
| `ignore_above` / `ignore_malformed` / `null_value` | keyword 길이 cut / 잘못된 값 무시 / null 치환 | docs/reference/elasticsearch/mapping-reference | ✅ 커버 ([38](38-mapping-power-features.md)) |
| `term_vector` | offsets·payloads 색인 — fast vector highlighter / MLT 가속 | [term-vector](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/term-vector) | ★ 신규 |

### C. Index Templates / Settings

| 개념 | 1-줄 정의 | 공식 링크 | 상태 |
|---|---|---|---|
| **Index template** / **Component template** (composable) | 인덱스 생성 시 mapping/settings 자동 적용. 8.x 표준 = composable | [index-templates](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/index-templates) | ✅ 커버 ([37](37-index-templates.md)) |
| `number_of_shards` / `number_of_replicas` | 샤드/레플리카 — sizing 공식 | [index settings](https://www.elastic.co/docs/reference/elasticsearch/index-settings) | ✅ 커버 (#12) |
| `refresh_interval` | NRT (Near Real-Time, 준실시간) 가시성 주기 | [refresh interval](https://www.elastic.co/docs/reference/elasticsearch/index-settings) | ✅ 커버 (#02) |
| `index.codec` (default / best_compression) | 디스크 ↔ CPU 트레이드오프, ZSTD 옵션 (8.x) | [codec](https://www.elastic.co/docs/reference/elasticsearch/index-settings) | ✅ 커버 ([37](37-index-templates.md)) |
| `index.sort.*` | segment 내부 정렬 — early termination 가능 (`sort + size` 빠른 응답) | [index-sort](https://www.elastic.co/docs/reference/elasticsearch/index-settings/index-modules-index-sorting) | ✅ 커버 ([37](37-index-templates.md)) |
| `routing.allocation.*` | shard allocation filtering / awareness | [allocation](https://www.elastic.co/docs/reference/elasticsearch/index-settings/index-modules-allocation) | ✅ 커버 (#12) |
| **Data streams** + **Data Stream Lifecycle (DSL)** | 시계열 append-only 인덱스 추상 + 8.x DSL 자동 rollover | [data-streams](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/data-streams) | ✅ 커버 ([40](40-data-streams-downsampling.md)) |
| **Downsampling** (rollups 후속) | 시계열 metric을 더 큰 interval 로 사전 집계 | [downsampling](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/downsampling) | ✅ 커버 ([40](40-data-streams-downsampling.md)) |

### D. Query DSL — Term-level Queries

| 개념 | 1-줄 정의 | 공식 링크 | 상태 |
|---|---|---|---|
| `term` / `terms` / `terms_set` / `ids` | 정확 매칭. `terms_set` 은 최소 N 개 매치 조건 | [term-level](https://www.elastic.co/docs/reference/query-languages/query-dsl/term-level-queries) | ✅ 커버 (#07) |
| `range` (date math 포함) | 숫자/날짜 범위. `now-1d/d` 같은 date math | [range](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-range-query) | 🟡 부분 (date math 별도 안 다룸) |
| `exists` / `prefix` / `wildcard` / `regexp` / `fuzzy` | 존재성·접두·와일드·정규식·퍼지 | [term-level](https://www.elastic.co/docs/reference/query-languages/query-dsl/term-level-queries) | ✅ 커버 (#07) |
| `terms` lookup | 다른 인덱스의 doc 에서 terms 동적 fetch | [terms-lookup](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-terms-query) | ✅ 커버 ([38](38-mapping-power-features.md)) |

### E. Query DSL — Full-text Queries

| 개념 | 1-줄 정의 | 공식 링크 | 상태 |
|---|---|---|---|
| `match` / `match_phrase` / `match_phrase_prefix` / `multi_match` | 기본 풀텍스트 4종. `multi_match` types: `best_fields`/`most_fields`/`cross_fields`/`phrase`/`phrase_prefix`/`bool_prefix` | [full-text](https://www.elastic.co/docs/reference/query-languages/query-dsl/full-text-queries) | ✅ 커버 (#07) |
| `match_bool_prefix` | tokens 를 should + 마지막 token prefix — autocomplete 대체재 | [match-bool-prefix](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-match-bool-prefix-query) | ★ 신규 |
| `combined_fields` | BM25F 진짜 구현. cross-field 매칭의 정확한 idf 계산 | [combined-fields](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-combined-fields-query) | ✅ 커버 ([38](38-mapping-power-features.md)) |
| `intervals` | 위치/거리 조건의 정밀 풀텍스트 ("X 와 Y 가 5 단어 이내") | [intervals](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-intervals-query) | ★ 신규 |
| `query_string` (Lucene syntax) / `simple_query_string` | 사용자 입력 raw query — operator 파싱 | [query-string](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-query-string-query) | ★ 신규 |

### F. Query DSL — Compound

| 개념 | 1-줄 정의 | 공식 링크 | 상태 |
|---|---|---|---|
| `bool` (must / should / must_not / filter) | 가장 흔한 조합. `filter` 는 캐시 + 점수 미계산 | [bool](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-bool-query) | ✅ 커버 (#07) |
| `dis_max` | should 매칭 점수의 max + tie_breaker — multi_match best_fields 의 내부 | [dis-max](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-dis-max-query) | ✅ 커버 ([38](38-mapping-power-features.md)) |
| `function_score` / `script_score` | 점수 변형 — gauss/linear/exp decay, field_value_factor, random_score | [function-score](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-function-score-query) | ✅ 커버 (#06, [35](35-field-value-factor-modifiers.md) modifier 풀 카탈로그) |
| `field_value_factor.modifier` (NONE/SQRT/LN1P/LN2P/LOG1P/LOG2P/RECIPROCAL/SQUARE) | raw 필드 값의 비선형 압축 — saturation 함수 카탈로그. 0 처리·곱연산 안전성·featureScore 분포 | [field-value-factor](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-function-score-query#function-field-value-factor) | ✅ 커버 ([35](35-field-value-factor-modifiers.md)) |
| `boosting` (positive + negative_boost) | 매칭은 시키되 점수 깎기 — 광고 차단/품절 강등 | [boosting](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-boosting-query) | ✅ 커버 ([32](32-specialized-queries.md)) |
| `constant_score` | 매칭만 보고 점수는 상수 → filter 캐싱 효과 | [constant-score](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-constant-score-query) | ✅ 커버 ([32](32-specialized-queries.md)) |

### G. Query DSL — Joining / Geo / Span / Specialized

| 개념 | 1-줄 정의 | 공식 링크 | 상태 |
|---|---|---|---|
| `nested` | nested 필드의 정확 매칭 + inner_hits | [nested-query](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-nested-query) | ✅ 커버 (#07) |
| `has_child` / `has_parent` / `parent_id` | join 필드 기반 부모-자식 검색 | [joining](https://www.elastic.co/docs/reference/query-languages/query-dsl/joining-queries) | 🟡 부분 |
| `geo_distance` / `geo_bounding_box` / `geo_shape` | 위치 반경·박스·임의 도형 | [geo](https://www.elastic.co/docs/reference/query-languages/query-dsl/geo-queries) | ✅ 커버 ([30](30-geo-queries.md)) |
| `shape` (cartesian) | 평면 좌표 (x,y) 도형 검색 — 도면·게임 | [shape](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-shape-query) | ✅ 커버 ([30](30-geo-queries.md)) |
| `span_term` / `span_first` / `span_near` / `span_or` / `span_not` / `span_within` / `span_containing` / `field_masking_span` / `span_multi` | Lucene span — 정밀한 위치 조건. 법률·표절·의료 도메인 | [span-queries](https://www.elastic.co/docs/reference/query-languages/query-dsl/span-queries) | ★ 신규 |
| `percolate` | "stored query 에 새 doc 매칭" — alerting / saved search / 실시간 분류 | [percolate](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-percolate-query) | ✅ 커버 ([22](22-percolate.md)) |
| `more_like_this` (MLT) | 주어진 doc 와 유사한 doc 검색 — "관련 상품" 단순 추천 | [more-like-this](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-mlt-query) | ✅ 커버 ([32](32-specialized-queries.md)) |
| `pinned` | 특정 doc id 를 강제 상위 — 광고/큐레이션 | [pinned](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-pinned-query) | ✅ 커버 ([32](32-specialized-queries.md)) |
| `distance_feature` | numeric/date/geo 거리 기반 부스트 — recency·근접도 효율 결합 | [distance-feature](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-distance-feature-query) | ✅ 커버 ([32](32-specialized-queries.md)) |
| `rank_feature` | rank_features 필드 가중치 기반 부스트 (script_score 보다 빠름) | [rank-feature-query](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-rank-feature-query) | ✅ 커버 ([32](32-specialized-queries.md)) |
| `script` query | Painless 임의 조건 (expensive query 군) | [script-query](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-script-query) | ★ 신규 |
| `wrapper` | Base64 wrapped JSON query — 동적 query 위임 | [wrapper](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-wrapper-query) | ★ 신규 |
| `rule_query` | Search Application 의 query rule 적용 (조건부 pinned/exclude) | [rule-query](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-rule-query) | ★ 신규 |
| `knn` (top-level + 쿼리) | dense_vector ANN top-k. 8.x 부터 query DSL 안에서도 가능 | [knn-query](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-knn-query) | ✅ 커버 (#08) |
| `sparse_vector` | ELSER token weight 기반 검색 | [sparse-vector-query](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-sparse-vector-query) | ★ 신규 |
| `semantic` | semantic_text 필드 자동 inference 검색 | [semantic-query](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-semantic-query) | ★ 신규 |
| `text_expansion` | (deprecated, → sparse_vector) | docs | skip (대체됨) |

> ★ "expensive queries" — `search.allow_expensive_queries: false` 시 차단되는 군: `script`, fielddata 미보장 필드 query, `fuzzy`/`regexp`/`prefix`/`wildcard`/text·keyword `range`, joining queries, `script_score`, `percolate`. 운영에서 의도적으로 막을 결정.

### H. Search APIs

| 개념 | 1-줄 정의 | 공식 링크 | 상태 |
|---|---|---|---|
| `_search` (POST/GET) | 표준 검색. `query` + `aggs` + `sort` + ... | [search](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-your-data) | ✅ 커버 |
| `_msearch` (multi-search) | 여러 검색을 NDJSON 으로 묶어 round-trip ↓ | [msearch](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/multi-search) | ✅ 커버 ([39](39-search-ops-apis.md)) |
| `_count` | doc 수만 반환 | docs/reference/elasticsearch/rest-apis | ★ 신규 |
| `_explain` | 특정 doc 의 매칭/점수 trace | [explain-api](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/explain-api) | 🟡 부분 (explain:true 만) |
| `_field_caps` | 인덱스 패턴 전체 필드 메타 — Kibana data view 핵심 | [field-caps](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/field-caps) | ✅ 커버 ([39](39-search-ops-apis.md)) |
| `_terms_enum` | keyword 필드의 prefix-기반 빠른 자동완성 (suggester 보다 단순) | [terms-enum](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/terms-enum) | ✅ 커버 ([36](36-autocomplete-ngram-edgengram.md)) |
| `_search_shards` | 어느 shard 가 hit 될지 사전 검사 — 캐시 워밍/디버깅 | docs | ✅ 커버 ([39](39-search-ops-apis.md)) |
| `_validate/query` | 쿼리 문법 검증 only | docs | ✅ 커버 ([39](39-search-ops-apis.md)) |
| `_search/template` (Mustache) + `_render/template` | 파라미터화된 search template — 클라이언트와 쿼리 분리 | [search-template](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-template) | ✅ 커버 ([39](39-search-ops-apis.md)) |
| `_search?profile=true` | per-shard query/agg 비용 분석 | [profile](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-profile) | 🟡 부분 (#16 언급) |
| `_search/scroll` (legacy) | snapshot pagination — deep pagination 용. 8.x 부터 PIT 권장 | [scroll](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/paginate-search-results) | ★ 신규 (deprecated 경로) |
| **Point in Time (PIT)** + **search_after** | snapshot id 기반 일관 pagination — 현재 권장 | [paginate](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/paginate-search-results) | ✅ 커버 ([24](24-pit-search-after.md)) |
| `_async_search` | long-running search — 비동기 제출, ID 로 polling | [async-search](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/async-search) | ✅ 커버 ([39](39-search-ops-apis.md)) |
| `_mvt` (Mapbox Vector Tile) | geo 검색 결과를 vector tile binary 로 — 지도 UI 직결 | [vector-tile](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/vector-tile-search) | ★ 신규 |
| **Field collapsing** + `inner_hits` | group-by + 그룹 내 top-N | [collapse](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/collapse-search-results) | ✅ 커버 ([25](25-field-collapsing-rescore.md)) |
| **Rescore** | top-N window 만 secondary query 로 재점수 — Two-Stage retrieval 의 ES 네이티브 | [rescore](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/filter-search-results) | ✅ 커버 ([25](25-field-collapsing-rescore.md)) |
| **Retrievers API** (8.14+) | top-level 재정렬 트리: `standard` / `knn` / `rrf` / `linear` / `text_similarity_reranker` / `rule` | [retrievers](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers) | ✅ 커버 ([23](23-retrievers-api.md)) |
| **Search Application API** (8.x) | endpoint·template·query rule 묶음 — relevance 운영 추상 | [search-application](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-application) | ★ 신규 |
| **Behavioral Analytics** | 클릭/로그 수집 → relevance tuning 입력 | [behavioral-analytics](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/behavioral-analytics) | ★ 신규 |
| **`_rank_eval`** (Ranking Evaluation API) | judgment list + metric (precision/recall/MRR/DCG/nDCG/ERR) 으로 검색 품질 자동 측정 | [rank-eval](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/ranking-evaluation) | ✅ 커버 ([34](34-eval-metrics-precision-recall-ndcg.md)) |

### I. Aggregations

| 카테고리 | 종류 | 공식 링크 | 상태 |
|---|---|---|---|
| **Bucket** | `terms` / `multi_terms` / `significant_terms` / `significant_text` / `rare_terms` / `sampler` / `diversified_sampler` / `histogram` / `date_histogram` / `auto_date_histogram` / `variable_width_histogram` / `range` / `date_range` / `ip_range` / `geo_distance` / `geohash_grid` / `geotile_grid` / `geohex_grid` / `filter` / `filters` / `adjacency_matrix` / `nested` / `reverse_nested` / `parent` / `children` / `composite` (pagination) / `missing` | [bucket-aggs](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket) | ✅ 커버 ([26](26-aggregations-catalog.md)) |
| **Metric** | `avg` / `sum` / `min` / `max` / `value_count` / `stats` / `extended_stats` / `cardinality` (HyperLogLog++) / `percentile` (TDigest/HDR) / `percentile_ranks` / `top_hits` / `top_metrics` / `scripted_metric` / `geo_bounds` / `geo_centroid` / `geo_line` / `weighted_avg` / `median_absolute_deviation` / `matrix_stats` / `string_stats` / `t_test` / `boxplot` / `rate` | [metric-aggs](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics) | ✅ 커버 ([26](26-aggregations-catalog.md)) |
| **Pipeline** | `avg_bucket` / `sum_bucket` / `min_bucket` / `max_bucket` / `stats_bucket` / `extended_stats_bucket` / `percentiles_bucket` / `moving_fn` (legacy `moving_avg`) / `derivative` / `cumulative_sum` / `cumulative_cardinality` / `serial_diff` / `bucket_script` / `bucket_selector` / `bucket_sort` / `normalize` / `inference` (ML) | [pipeline-aggs](https://www.elastic.co/docs/reference/aggregations/pipeline) | ✅ 커버 ([26](26-aggregations-catalog.md)) |
| **Composite** + `after_key` | aggregation 의 keyset pagination — 대규모 GROUP BY | [composite](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-composite-aggregation) | ✅ 커버 ([26](26-aggregations-catalog.md)) |
| **Significant terms / text** | uncommonly common — 트렌드/이상 탐지 | docs | ✅ 커버 ([26](26-aggregations-catalog.md)) |
| **Top hits / Top metrics** | 그룹별 대표 doc / 가장 최신 metric 하나 | docs | ✅ 커버 ([26](26-aggregations-catalog.md)) |

### J. Ingest / 데이터 변환

| 개념 | 1-줄 정의 | 공식 링크 | 상태 |
|---|---|---|---|
| Ingest pipeline 기본 | coordinating·ingest 노드에서 `_doc` 색인 직전 변환 | [ingest](https://www.elastic.co/docs/reference/ingestion-tools/enrich-processor) | ✅ 커버 (#13) |
| `simulate` API | 파이프라인 dry-run | [simulate](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/simulate-pipeline) | ★ 신규 |
| `on_failure` 핸들러 | 실패 시 fallback 처리 — DLQ (Dead Letter Queue, 데드 레터 큐) 패턴 | docs | ★ 신규 |
| **Processors** (40+ 종) | `append`/`attachment`/`bytes`/`circle`/`community_id`/`convert`/`csv`/`date`/`date_index_name`/`dissect`/`dot_expander`/`drop`/`enrich`/`fail`/`fingerprint`/`foreach`/`geoip`/`geo_grid`/`grok`/`gsub`/`html_strip`/`inference`/`join`/`json`/`kv`/`lowercase`/`network_direction`/`pipeline`/`redact`/`remove`/`registered_domain`/`rename`/`reroute`/`script`/`set`/`set_security_user`/`sort`/`split`/`terminate`/`trim`/`uppercase`/`uri_parts`/`urldecode`/`user_agent` | [processors](https://www.elastic.co/docs/reference/enrich-processor) | 🟡 부분 (grok/date/set 정도) |
| **Enrich processor** + Enrich policy | DB-style join at ingest — IP→geo, domain→category 같은 lookup | [enrich](https://www.elastic.co/docs/reference/ingestion-tools/enrich-processor/enrich-processor) | ★ 신규 |
| **Inference processor** | ML 모델 출력 (embedding/classification) 을 색인 시 주입 | [inference-processor](https://www.elastic.co/docs/reference/enrich-processor/inference-processor) | ★ 신규 |
| **Redact / Fingerprint** | PII (Personally Identifiable Information, 개인 식별 정보) 마스킹 / 결정적 해시 | docs | ★ 신규 |

### K. 인덱스 운영 / 라이프사이클

| 개념 | 1-줄 정의 | 공식 링크 | 상태 |
|---|---|---|---|
| **ILM** (ES) / **ISM** (OS) | Hot-Warm-Cold-Frozen-Delete 단계 자동 전이 | [ilm](https://www.elastic.co/docs/reference/elasticsearch/index-lifecycle-management) | ✅ 커버 (#13) |
| **Data Stream Lifecycle (DSL)** (8.x) | data stream 전용 단순 라이프사이클 (rollover + retention) | [data-stream-lifecycle](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/data-stream-lifecycle) | ★ 신규 |
| **Snapshot/Restore** | 외부 repo (S3/GCS/Azure/HDFS) 로 백업 | [snapshot-restore](https://www.elastic.co/docs/reference/elasticsearch/snapshot-restore) | ✅ 커버 (#16) |
| **Snapshot Lifecycle Management (SLM)** | snapshot 자동 스케줄·보관 — Elastic | [slm](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/snapshot-lifecycle-management) | ✅ 커버 ([40](40-data-streams-downsampling.md)) |
| **Searchable Snapshots** | snapshot 을 마운트해 직접 검색 — 스토리지 비용 ↓ (Elastic) | [searchable-snapshots](https://www.elastic.co/docs/reference/elasticsearch/searchable-snapshots) | ✅ 커버 ([31](31-ccs-ccr-snapshots.md)) |
| **Frozen tier** | searchable snapshot 기반 cold 단계 이후 — 거의 무한 보존 | docs | ✅ 커버 ([31](31-ccs-ccr-snapshots.md)) |
| `_reindex` | 인덱스 → 인덱스 복사 + transform | [reindex](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reindex) | ✅ 커버 (#13) |
| `_update_by_query` / `_delete_by_query` | 쿼리 매칭 doc 일괄 update/delete (script 가능) | [update-by-query](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/update-by-query) | ✅ 커버 ([39](39-search-ops-apis.md)) |
| `_split` / `_shrink` / `_clone` index | shard 수 변경 (split=증가, shrink=감소, clone=동일 복제) | [split](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/split-index) | ✅ 커버 ([39](39-search-ops-apis.md)) |
| `_forcemerge` / `_refresh` / `_flush` | segment 병합 강제 / 가시성 즉시 / disk sync | docs | 🟡 부분 (#02 개념만) |
| **Transforms** (continuous / batch) | entity-centric pivot — "user 별 last 30d 합계" 같은 materialized view | [transforms](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/transforms) | ✅ 커버 ([40](40-data-streams-downsampling.md)) |
| **Rollups** (deprecated → Downsampling) | 시계열 사전 집계 | docs | skip (deprecated) |

### L. 분산 / 멀티 클러스터 / 보안

| 개념 | 1-줄 정의 | 공식 링크 | 상태 |
|---|---|---|---|
| **Cross-Cluster Search (CCS)** | 여러 클러스터 인덱스를 한 검색으로. `cluster_one:index*` syntax | [ccs](https://www.elastic.co/docs/reference/elasticsearch/cross-cluster-search) | ✅ 커버 ([31](31-ccs-ccr-snapshots.md)) |
| **Cross-Cluster Replication (CCR)** | leader → follower 단방향 복제. DR (Disaster Recovery, 재해 복구) / 지역 분산 (Elastic 전용) | [ccr](https://www.elastic.co/docs/reference/elasticsearch/ccr) | ✅ 커버 ([31](31-ccs-ccr-snapshots.md)) |
| Remote clusters (sniff vs proxy) | CCS/CCR 의 연결 모드 — 노드 발견 vs proxy 단일 endpoint | docs | ★ 신규 |
| **Authentication realms** — native / file / LDAP / AD / SAML / OIDC / Kerberos / PKI | 인증 백엔드 분리 | [auth realms](https://www.elastic.co/docs/reference/elasticsearch/security-roles-and-privileges) | ★ 신규 |
| **API keys** + **Service accounts** | machine-to-machine 인증 | [api-keys](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/security-apis) | ★ 신규 |
| **RBAC** (roles + role mapping) | 인덱스/쿼리/cluster privilege 조합 | docs | ★ 신규 |
| **DLS / FLS** (Document/Field Level Security) | 사용자별 doc·field 마스킹 (Elastic Platinum / OS 기본) | [dls-fls](https://www.elastic.co/docs/reference/elasticsearch/security-roles-and-privileges) | ★ 신규 |
| **Audit logs** | 보안 감사 로그 | docs | ★ 신규 |
| **TLS / mTLS** in cluster | transport·HTTP 양 layer 암호화 | docs | ★ 신규 |
| Encryption at rest | 디스크 암호화는 외부, snapshot 은 repo 옵션으로 | docs | ★ 신규 |

### M. ML / Inference / Semantic Stack (Elastic 8.x)

| 개념 | 1-줄 정의 | 공식 링크 | 상태 |
|---|---|---|---|
| **Inference API** | 모델 등록 (HF / OpenAI / Cohere / Azure / Vertex / ELSER / E5 / Watsonx) → endpoint 단위 호출 | [inference](https://www.elastic.co/docs/reference/elasticsearch/inference) | ✅ 커버 ([28](28-elser-semantic-text.md)) |
| **ELSER** (Elastic Learned Sparse EncodeR) | 사전학습된 sparse retrieval 모델 — token weight 출력 | [elser](https://www.elastic.co/docs/reference/elasticsearch/inference/elser) | ✅ 커버 ([28](28-elser-semantic-text.md)) |
| **E5 multilingual** | dense embedding (multilingual) 모델 — text-embedding | docs | ✅ 커버 ([28](28-elser-semantic-text.md)) |
| **semantic_text 필드** + 자동 chunking | 매핑 한 줄로 chunk + embedding 자동 — 8.13+ 권장 | [semantic-text](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/semantic-text) | ✅ 커버 ([28](28-elser-semantic-text.md)) |
| **kNN with filter** (pre-filter) | ANN 후보 좁히기 — 정확도/지연 트레이드오프 | docs | ✅ 커버 ([41](41-vector-advanced.md)) |
| **Vector quantization** (BBQ / INT8 / INT4 / scalar) | dense_vector 메모리 ↓. **BBQ** = Better Binary Quantization (8.x 신기능) | [dense-vector quantization](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/dense-vector) | ✅ 커버 ([41](41-vector-advanced.md)) |
| **Anomaly Detection ML jobs** | 시계열 이상 탐지 (SMV/HMM/RCF 계열) | [ml-anomaly](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/ml-anomaly-apis) | ★ 신규 (Elastic 전용) |
| **Categorization ML** | 비정형 로그 자동 카테고리화 | docs | ★ 신규 (Elastic 전용) |
| **Watcher** | 주기적 query → 조건 → action (email/webhook/slack) | [watcher](https://www.elastic.co/docs/reference/elasticsearch/watcher) | ★ 신규 (Elastic 전용) |

### N. Query Languages 분기

| 개념 | 1-줄 정의 | 공식 링크 | 상태 |
|---|---|---|---|
| **Query DSL** (JSON) | 가장 풍부한 표현, 본 카탈로그 §D~G | docs | ✅ 커버 |
| **EQL** (Event Query Language) | 시퀀스/threat hunting 도메인 언어 — security 워크로드 | [eql](https://www.elastic.co/docs/reference/query-languages/eql) | ✅ 커버 ([33](33-query-languages.md)) |
| **ES\|QL** (Elasticsearch Query Language) | piped 표현식 (`FROM ... \| WHERE ... \| STATS ... \| LIMIT`) — 8.11+ Kibana Discover 차세대 | [esql](https://www.elastic.co/docs/reference/query-languages/esql) | ✅ 커버 ([33](33-query-languages.md)) |
| **SQL API** | JDBC + REST SQL — BI 도구 호환 | [sql](https://www.elastic.co/docs/reference/query-languages/sql) | ✅ 커버 ([33](33-query-languages.md)) |
| **PPL** (Piped Processing Language, OS 전용) | OpenSearch 의 piped query 언어 — 로그 분석 | [ppl](https://docs.opensearch.org/3.5/search-plugins/sql/ppl/index) | ✅ 커버 ([33](33-query-languages.md)) |

### O. 스크립팅

| 개념 | 1-줄 정의 | 공식 링크 | 상태 |
|---|---|---|---|
| **Painless** | ES 전용 안전 스크립트 언어. script_score / runtime fields / ingest script / update | [painless](https://www.elastic.co/docs/reference/scripting-languages/painless) | 🟡 부분 (#06 script_score 언급) |
| Stored scripts | 등록한 script id 로 호출 — 캐시 + 보안 | docs | ★ 신규 |
| Script contexts | search / aggs / ingest / update / rescore / score / runtime — context 별 노출 변수 다름 | docs | ★ 신규 |

### P. 관측 / Cat APIs / 진단

| 개념 | 1-줄 정의 | 공식 링크 | 상태 |
|---|---|---|---|
| `_cat/*` (indices/shards/nodes/allocation/recovery/master/health/tasks/pending_tasks/...) | 사람이 보는 cluster 상태 | [cat](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/cat-apis) | ✅ 커버 ([39](39-search-ops-apis.md)) |
| `_nodes/stats` / `_cluster/stats` | 노드/클러스터 상세 통계 | docs | ✅ 커버 (#16) |
| `_tasks` 관리 + cancel | long-running task 취소 (reindex/by_query) | [tasks](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/task-management) | ✅ 커버 ([39](39-search-ops-apis.md)) |
| `_nodes/hot_threads` | thread dump — 병목 식별 | docs | ✅ 커버 (#16) |
| `_cluster/allocation/explain` | 왜 이 shard 가 unassigned 인지 설명 | docs | ✅ 커버 ([39](39-search-ops-apis.md)) |
| Search Slow Log / Index Slow Log | 임계값 초과 쿼리 로깅 | docs | ✅ 커버 (#16) |
| Profile API | 쿼리/aggs 의 per-shard 비용 분석 | docs | 🟡 부분 |

### Q. OpenSearch 고유 스택

| 개념 | 1-줄 정의 | 공식 링크 | 상태 |
|---|---|---|---|
| **Search Pipeline** (request / response / search-phase processors) | 검색 요청·응답 변환 파이프라인 — ES 의 ingest 의 검색 버전 | [search-pipelines](https://docs.opensearch.org/3.5/search-plugins/search-pipelines/index) | ✅ 커버 ([29](29-os-search-pipeline-neural.md)) |
| **normalization-processor** | hybrid query 의 score normalize (`min_max` / `l2` / `rrf`) + combination (`arithmetic_mean` / `geometric_mean` / `harmonic_mean`) | [normalization](https://docs.opensearch.org/3.5/search-plugins/search-pipelines/normalization-processor) | ✅ 커버 ([29](29-os-search-pipeline-neural.md)) |
| **Hybrid query** (top-level) | OS 의 hybrid 검색 표준 — search pipeline 과 한 쌍 | [hybrid](https://docs.opensearch.org/3.5/query-dsl/compound/hybrid) | ✅ 커버 ([29](29-os-search-pipeline-neural.md)) |
| **Neural search** plugin | text → embedding → kNN 자동화 (model_id 지정) | [neural](https://docs.opensearch.org/3.5/search-plugins/neural-text-search) | ✅ 커버 ([29](29-os-search-pipeline-neural.md)) |
| **Neural Sparse search** + 2-phase processor | sparse retrieval (BM25-like 토큰 가중치) + 가속 처리 | [neural-sparse](https://docs.opensearch.org/3.5/search-plugins/neural-sparse-search) | ✅ 커버 ([29](29-os-search-pipeline-neural.md)) |
| **k-NN engines** (faiss / nmslib / lucene) | OS 는 3-엔진 선택 가능. faiss = HNSW + IVF/PQ, nmslib = HNSW (legacy), lucene = ES 호환 | [k-nn](https://docs.opensearch.org/3.5/vector-search/k-nn) | ✅ 커버 ([41](41-vector-advanced.md)) |
| **k-NN 양자화** (FP16 / INT8 / Binary) + disk-based vectors | 메모리·디스크 절약 옵션 — Elastic BBQ 와 비교 가능 | [k-nn quantization](https://docs.opensearch.org/3.5/vector-search/optimizing-storage) | ★ 신규 |
| **ML Commons** | 범용 모델 등록·서빙 plugin — neural 의 토대 | [ml-commons](https://docs.opensearch.org/3.5/ml-commons-plugin/index) | ✅ 커버 ([29](29-os-search-pipeline-neural.md)) |
| **Conversational Search** / RAG (Retrieval-Augmented Generation, 검색 증강 생성) | LLM 연계 답변 생성 endpoint | [conversational](https://docs.opensearch.org/3.5/search-plugins/conversational-search) | ★ 신규 |
| **Anomaly Detection plugin** (RCF) | Random Cut Forest 기반 시계열 이상 탐지 — Elastic ML 의 OSS 대안 | [anomaly-detection](https://docs.opensearch.org/3.5/observing-your-data/ad/index) | ★ 신규 |
| **Alerting plugin** + **Notifications** | trigger 기반 알람 — Watcher 의 OSS 대안 | [alerting](https://docs.opensearch.org/3.5/observing-your-data/alerting/index) | ★ 신규 |
| **Security Analytics** | SIEM (Security Information and Event Management, 보안 정보 이벤트 관리) plugin | [security-analytics](https://docs.opensearch.org/3.5/security-analytics/index) | ★ 신규 |
| **Index State Management (ISM)** | OS 의 ILM 동치 | [ism](https://docs.opensearch.org/3.5/im-plugin/ism/index) | ✅ 커버 (#13) |
| **PPL** (Piped Processing Language) | 로그 분석용 piped query — `source=logs | where status=500 | stats count() by host` | [ppl](https://docs.opensearch.org/3.5/search-plugins/sql/ppl/index) | ★ 신규 |
| **OpenSearch Observability** | trace / metric / log 통합 UI + APM (Application Performance Monitoring, 앱 성능 모니터링) 연계 | [observability](https://docs.opensearch.org/3.5/observing-your-data/index) | ★ 신규 |
| **Async Search** plugin | ES 의 async search 와 동일 컨셉 | [async-search](https://docs.opensearch.org/3.5/search-plugins/async/index) | ★ 신규 |

---

## 3. 우선 심화 후보 Top-12

위 카탈로그에서 **시니어 백엔드 / msa 코드베이스 관련도 / 면접 임팩트** 3축으로 가중치를 매긴 다음 단계 deep-dive 후보:

| 우선 | 주제 | 왜 (한 줄) | 관련 카테고리 |
|---|---|---|---|
| 1 | **percolate 쿼리 + percolator field** | 사용자 명시. 알람·실시간 분류 패턴 — msa 의 alerting 후보로 직결 | G |
| 2 | **Retrievers API + RRF / linear / text_similarity_reranker** (ES 8.14+) | 9에서 다룬 RRF 의 **현 표준 표현법**. 향후 PoC 코드도 retrievers 기반으로 갈 가치 | H |
| 3 | **Point in Time + search_after / scroll deprecation** | scroll 대체 표준. analytics/배치 reindexer 가 자주 쓰는 패턴 | H |
| 4 | **Field collapsing + inner_hits + Rescore** | 카테고리별 top-N + Two-Stage rerank 의 ES 네이티브 — #10 의 실제 구현 채움 | H |
| 5 | **Aggregations 풀 카탈로그** (특히 composite / significant_terms / cardinality / top_hits / pipeline) | #07 에서 한 줄로 끝낸 영역. 분석/대시보드 기여 큼 | I |
| 6 | **Mapping 필드 풀 카탈로그** (semantic_text / sparse_vector / rank_features / wildcard / flattened / range / scaled_float) | 신규 필드 타입이 search relevance/비용 직결 | A |
| 7 | **Inference API + ELSER + semantic_text** (Elastic 8.x) | 기존 #08 dense_vector 와 직교하는 sparse retrieval 트랙 | M |
| 8 | **OpenSearch Search Pipeline + Hybrid + Neural / Neural Sparse / ML Commons** | #11 ES vs OS 비교 챕터의 기술 디테일. msa OpenSearch 일원화 ADR 검토에 필수 | Q |
| 9 | **Geo Queries + Geo Aggregations** (geo_distance / geohash_grid / geotile_grid / `_mvt`) | 매장·배송·지도 도메인 들어오면 즉시 필요 | G, I, H |
| 10 | **Cross-Cluster Search / Replication + Searchable Snapshots** | 멀티 리전 / DR 시나리오 시니어 결정 영역 | L, K |
| 11 | **Specialized queries 보강** (more_like_this / pinned / distance_feature / rank_feature / boosting / constant_score) | 비즈니스 시그널 효율 결합 — function_score 보다 가벼운 옵션들 | F, G |
| 12 | **ES\|QL + EQL + SQL + PPL** | 검색 외 분석 워크로드를 같은 클러스터에서 — 운영자 도구 선택 | N |

> 우선순위 1~4는 다음 보강 round (`/study:exec 19 --phase X` 또는 별도 NN 파일)에서 가장 먼저 다룰 후보.

---

## 4. 표준 심화 스터디 템플릿

이 카탈로그에서 후보 하나를 골라 새 deep file (`study/docs/19-search-engine/{NN}-{slug}.md`)로 풀어쓸 때 사용할 skeleton. **그대로 복사 → 채우기**.

````markdown
---
parent: 19-search-engine
seq: <NN>
title: <한글 주제> — <영문 키워드>
type: deep-dive
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
status: in-progress | completed
related:
  - 99-concept-catalog.md
  - <인접 deep file>
sources:
  - <공식 docs URL #1>
  - <공식 docs URL #2>
catalog-row: "§<카테고리 letter>.<row>"
---

# <NN>. <한글 주제> — <영문 키워드>

> 카탈로그 매핑: §99 §<카테고리>.<row> (`상태: ★ 신규` → `✅ 커버`로 갱신)
> 학습 시간 예상: <N>h · 자가평가 입구 레벨: A/B/C

---

## 1. 한 줄 핵심

<한 문장으로 이 주제가 왜 존재하고 무엇을 해결하는지>

## 2. 공식 정의 + 등장 배경

- ES/OS 에서 언제·왜 추가됐는지 (release note, 문제의식)
- 이전 대안 (있었다면) + 왜 부족했는지

## 3. 동작 원리 (핵심 메커니즘)

- 자료구조·알고리즘 / 호출 흐름 / 인덱싱·쿼리 시점 비용
- ASCII 다이어그램 1개 권장
- 핵심 파라미터 표 (이름 / 기본값 / 의미 / 트레이드오프)

## 4. 사용 예제

### 4-1. 가장 단순한 사례 (curl/JSON)

```json
// 공식 docs 의 가장 작은 예시. 줄 마다 주석 권장
```

### 4-2. 실전 패턴 (msa-like 시나리오)

> "msa 의 product 검색에 적용한다면…" 또는 "이 도메인에 들어오면 어떻게 쓰나"

```json
// 도메인 시나리오에 맞춘 변형
```

## 5. 트레이드오프 / 안티패턴

| 측면 | 장점 | 비용 / 주의 |
|---|---|---|
| 메모리 |  |  |
| 인덱싱 시간 |  |  |
| 쿼리 latency |  |  |
| 매핑 변경 비용 |  |  |
| 라이선스 / 가용성 |  |  |

- **언제 쓴다**: …
- **언제 쓰지 않는다**: …
- **자주 듣는 오해**: …

## 6. ES vs OpenSearch (해당될 때)

- 라이선스 / API / 기본값 / 성숙도 차이
- 마이그레이션 시 함정

## 7. 운영 / 모니터링

- 관측 지표 (어떤 metric / slow log 패턴 / `_cat`·`_nodes/stats` 어디 봐야)
- circuit breaker / fielddata / heap 영향
- 재색인·매핑 변경 비용

## 8. msa 코드베이스 grounding

> 99 카탈로그가 가리킨 카테고리에서 msa 의 search/product/analytics 등에 매핑되는 지점이 있나?
> 없다면 "현 시점 미적용 — 적용 시 ADR 필요" 형태로 정리.

| 위치 | 파일 | 현재 상태 | 개선 가능성 |
|---|---|---|---|
| search/app | … | … | … |

## 9. 적용 후보 / ADR 후보

- 적용 전제 (인프라·라이선스·팀 학습 비용)
- 적용 시 영향 범위 (인덱스·매핑·쿼리·클라이언트)
- ADR 초안 1개: 제안 / 이유 / 대안 / 결정

## 10. 면접 카드 + 꼬리질문

| 질문 | 핵심 답변 1-2 줄 | 꼬리질문 |
|---|---|---|
| Q1. <개념의 정의는?> | … | <왜 그렇게 만들었나?> |
| Q2. <대체 가능한 방법은?> | … | <성능 비교는 어떻게 할까?> |
| Q3. <안티패턴 한 가지> | … | <자주 보는 실수 시나리오?> |

## 11. 자주 듣는 오해 정정

| 오해 | 실제 |
|---|---|

## 12. 다음 학습

- 인접 카탈로그 행 (`§99 §<카테고리>.<인접row>`)
- 공식 reference 의 인접 챕터
- 관련 ADR / msa improvements 후보

````

### 4-A. 작성 워크플로우 (체크리스트)

심화 노트를 새로 만들 때 다음을 순서대로 따른다:

- [ ] §99 카탈로그에서 행을 찾고 카테고리·상태 메모
- [ ] 공식 docs 링크 1차 정독 (반드시 reference 트리, 블로그 X)
- [ ] context7 MCP 으로 보강 (`/websites/elastic_co_reference` 또는 `/websites/opensearch_3_5`)
- [ ] 위 템플릿 §1~12 까지 채움 (msa grounding §8 은 grep/Read 로 검증)
- [ ] §99 카탈로그의 해당 행 상태 `★ 신규` → `✅ 커버` 변경 + `심화 파일` 컬럼에 파일명 추가
- [ ] `00-INDEX.md` 의 19 주제 카드 deep file 카운트 갱신
- [ ] `temp.md` 학습 현황 표 갱신
- [ ] 약어 첫 등장 풀스펠링 + 한글 풀이 ([00-ABBREVIATIONS.md](../00-ABBREVIATIONS.md) 규칙)

### 4-B. 단축 변형 (mini deep-dive, 30 분)

전체 12 섹션이 부담되면 다음 5 섹션만 채우는 mini 형식 사용 가능 (catalog row 의 `🟡 부분` → `✅ 커버` 정도 목적):

1. 한 줄 핵심
2. 동작 원리
3. 1 예제 (json)
4. 트레이드오프 / 안티패턴
5. 면접 카드 1개

mini 형식은 파일명 끝에 `-mini` 를 붙이지 말고 일반 NN 으로 동일 처리하되, frontmatter 에 `depth: mini` 를 추가.

---

## 5. 참고 자료

### 공식 reference (1차 sources)

- Elasticsearch reference: https://www.elastic.co/docs/reference
  - Query DSL: https://www.elastic.co/docs/reference/query-languages/querydsl
  - Search APIs: https://www.elastic.co/docs/reference/elasticsearch/rest-apis
  - Mapping: https://www.elastic.co/docs/reference/elasticsearch/mapping-reference
  - Aggregations: https://www.elastic.co/docs/reference/aggregations
  - Ingest processors: https://www.elastic.co/docs/reference/enrich-processor
- OpenSearch docs: https://docs.opensearch.org/3.5
  - Query DSL: https://docs.opensearch.org/3.5/query-dsl/index
  - Search pipelines: https://docs.opensearch.org/3.5/search-plugins/search-pipelines/index
  - Vector search: https://docs.opensearch.org/3.5/vector-search/index
  - ML Commons: https://docs.opensearch.org/3.5/ml-commons-plugin/index

### 부가 (2차 sources)

- Lucene 공식: https://lucene.apache.org/core
- "Elasticsearch: The Definitive Guide" (구버전, Lucene·Inverted Index 설명)
- "Relevant Search" (Doug Turnbull, John Berryman) — function_score / LTR
- "AI-Powered Search" (Trey Grainger 외) — semantic + hybrid + re-ranking
- BM25 원논문: "Okapi at TREC-3" (Robertson et al., 1995)
- HNSW 원논문: Malkov & Yashunin, 2018

### 본 카탈로그 갱신 정책

- ES/OS major release (예: ES 9 GA, OS 4) 시 본 파일에 신규 행 추가
- 새 deep file 작성 시 catalog 행 `상태` 와 `심화 파일` 동기화
- 폐기된 기능 (예: rollups, scroll, text_expansion) 은 `skip (사유)` 로 남겨 역사 기록

> 이 카탈로그는 19 시리즈의 `00-INDEX.md` 의 산출물 카드에 cross-link 된다. 변경 시 카드 갱신 잊지 말 것.
