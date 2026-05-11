---
parent: 19-search-engine
seq: 20
title: 면접 Q&A — 17 질문 + 꼬리 질문 + 악마의 변호인 + msa 경험 결합
type: deep
created: 2026-05-03
---

# 20. 면접 Q&A

> 묶음 1/2/3 의 모든 학습을 면접 답변으로 결정화. 모범답변 + 꼬리질문 (3단계까지) + 악마의 변호인 (반박 패턴) + msa 경험 결합 (Phase 3 grounding).

## 답변 구조 (모든 질문 공통)

각 답변:
- **핵심 답변** (1-2 문장) — 면접관이 원하는 직접적 답변
- **설명** (2-3 문장) — 왜 / 어떻게
- **실무 경험 연결** — msa 의 search 서비스에서 ~ 했습니다
- **+α** — 추가로 언급하면 좋은 포인트
- **꼬리 질문 트리** + 답변
- **악마의 변호인** — 반박 / 함정 패턴

---

## Q1. RDB 의 LIKE 검색 대신 ES 를 쓰는 이유는?

### 답변

**핵심**: B-Tree 인덱스가 prefix 정렬이라 `'%foo%'` 같은 suffix wildcard 는 인덱스 사용 불가하고, 한국어 형태소 / 동의어 / 오타 / 자동완성 기능을 RDB (Relational Database, 관계형 데이터베이스) FTS 만으로는 못 합니다.

**설명**: ES (Elasticsearch) 는 Lucene 기반 inverted index 로 term 단위 매칭, BM25 (Best Match 25) 스코어링, nori 형태소 분석, fuzzy / completion suggester 등 검색 워크로드에 특화. RDB 는 OLTP 트랜잭션 / 정합성에 특화.

**실무**: msa 의 product 검색을 ES 로 분리. RDB 는 SoR (System of Record, 원본 데이터 시스템), ES 는 read 모델 — Kafka 로 비동기 인덱싱.

**+α**: 단, "Just Use Postgres" — 작은 규모는 Postgres FTS / pgvector 로 충분. 병목 증명 후 분리.

### 꼬리 Q1-1: 그러면 왜 LIKE '%foo%' 가 인덱스를 못 쓰나요?

→ B-Tree 인덱스는 정렬된 키 트리. prefix (`'foo%'`) 는 트리 traversal 가능하지만, suffix wildcard 는 어디서 시작해야 할지 모르므로 Full Table Scan.

#### 꼬리 Q1-1-1: prefix wildcard 는 빠른가요?

→ ES 의 `prefix` query 는 FST (term dictionary) traversal 로 빠릅니다 (O(log n)). RDB 는 `LIKE 'foo%'` 도 인덱스 사용 가능.

### 꼬리 Q1-2: ES 가 RDB 보다 항상 빠른가요?

→ 단순 PK lookup 은 RDB 가 빠릅니다. ES 는 검색 / 분석 / 자유로운 query 에 강함. 워크로드별 trade-off.

### 악마의 변호인

> "MySQL 8 의 InnoDB FTS 도 한국어 됩니다."

→ 됩니다 (mecab plugin). 단, 분산 / 정밀 스코어링 / vector / aggregation / 자동완성 같은 검색 종합 기능은 ES 가 우월. 트래픽 규모에 따라.

---

## Q2. ES 의 refresh / flush / commit 차이는?

### 답변

**핵심**: refresh = 메모리에 새 segment 만들어 검색 가능 (가시성). flush = 디스크 fsync + translog clear (내구성). flush 가 Lucene 의 commit 입니다.

**설명**: ES 의 "near real-time" 은 default 1초 refresh interval 의 산물. translog 가 fsync 안 한 segment 의 안전망.

**실무**: msa search:consumer 는 default refresh (1s) 그대로. search:batch 는 reindex 중 `refresh_interval=-1` + `replica=0` 으로 throughput 최적화 후 alias swap.

**+α**: ES 의 flush 가 Lucene 의 commit. 같은 거. 용어 헷갈림 주의.

### 꼬리 Q2-1: translog 가 없으면 어떤 일이 벌어지나요?

→ refresh (메모리만) 와 flush (디스크) 사이 윈도우가 위험. 노드가 죽으면 메모리 segment 손실. translog 가 모든 인덱싱을 sequential append 로 기록 → 재기동 시 replay.

#### 꼬리 Q2-1-1: translog durability=async 와 request 의 차이는?

→ async = sync_interval (5s default) 마다 fsync, 5초 윈도우 손실 가능. request = 매 request 마다 fsync, 안전하지만 약간 느림. 사용자 데이터는 request, 로그는 async 검토.

### 꼬리 Q2-2: refresh_interval 을 100ms 로 줄이면 어떻게 되나요?

→ segment 폭증 → background merge 부하 ↑ → 검색 latency 악화. **1s 미만은 안티패턴**. lag 가 정말 짧아야 하면 `?refresh=wait_for` 명시 사용.

### 악마의 변호인

> "refresh 자주 하면 검색 결과가 더 빨리 보이니까 좋은 거 아닌가요?"

→ 가시성은 좋아지지만 segment 폭증 / merge 부하로 전반 검색 latency ↑. 사용자 lag 1초가 인지되는 도메인이 거의 없음. 트레이드오프 고려.

---

## Q3. TF-IDF 와 BM25 의 차이는? BM25 의 k1, b 는 무엇을 통제하나요?

### 답변

**핵심**: BM25 = TF-IDF 에 (1) tf saturation (k1), (2) 문서 길이 정규화 (b) 를 추가. TF-IDF 는 tf 가 무한정 증가, 길이 정규화 약함.

**설명**:
- k1 = tf saturation 속도 (default 1.2). 작으면 tf=1 과 tf=10 의 점수 차이 작음.
- b = 길이 정규화 강도 (default 0.75). 0=무시, 1=풀 정규화.
- 짧은 문서 (상품명) 는 k1 ↓, 긴 문서는 default 또는 ↑.

**실무**: msa 의 product `name` 은 평균 30자 짧음. default BM25 사용 중. corpus 길이 분포 측정 후 b 튜닝 고려.

**+α**: BM25 score 는 절대값 아님. 같은 쿼리 내에서만 비교 의미. 임계값 직접 비교 ❌.

### 꼬리 Q3-1: BM25 만으로 이커머스 검색에 부족한 이유는?

→ 인기도 / 신상도 / 재고 / 광고 같은 비즈니스 시그널 미반영. function_score 로 결합 또는 LTR.

#### 꼬리 Q3-1-1: function_score 의 boost_mode 와 score_mode 의 차이는?

→ score_mode = 함수들끼리 결합 방식 (sum/multiply/avg). boost_mode = 함수 결과와 query (BM25) 의 결합 방식. 도메인 의도에 따라 결정.

### 꼬리 Q3-2: BM25 의 효과를 어떻게 측정하나요?

→ MRR (첫 정답 위치 평균), nDCG@k (상위 k 의 누적 이득, 정답 가까울수록 ↑), Recall@k, Precision@k. ES 의 Rank Eval API 활용.

### 악마의 변호인

> "score 가 높으면 상위로 올리면 되는 거 아닌가요?"

→ score 는 상대값. 다른 쿼리의 score 와 비교 불가. 절대 임계값으로 필터링 ❌. 도메인 상위 N 개를 보여주거나 score 를 percentile 로 변환.

---

## Q4. 한국어 형태소 분석기 nori 의 decompound mode 3가지 차이는?

### 답변

**핵심**: none = 원형 유지, discard = 분해만, mixed = 둘 다 색인.

**설명**: "한국어형태소분석기" 가:
- none: `[한국어형태소분석기]` (1 token, 정확 매칭만)
- discard: `[한국어, 형태소, 분석기]` (3, 부분 검색만)
- mixed (default): 위 4개 모두 (검색 hit ↑, 인덱스 ↑)

**실무**: msa product 매핑은 nori analyzer (default mixed) 적용. user_dictionary 로 브랜드명 ("갤럭시폴드") 추가 권장.

**+α**: 검색용 analyzer 와 인덱싱용 analyzer 는 일치해야 함. 다르면 토큰이 안 맞아서 hit ❌.

### 꼬리 Q4-1: 사용자 사전 (user_dictionary) 가 왜 필요한가요?

→ mecab-ko-dic 은 일반 사전. 도메인 신조어 / 브랜드명 ("당근마켓") 누락 → 음절 단위 분해. user_dictionary 로 명시.

#### 꼬리 Q4-1-1: 사용자 사전 변경 시 reindex 필요한가요?

→ default 적용은 노드 재시작 또는 인덱스 close → open. 새 사전을 적용한 doc 만 새 토큰으로 색인 → 일관성 위해 alias swap reindex 권장.

### 꼬리 Q4-2: nori_part_of_speech 가 무엇인가요?

→ 토큰의 품사 정보 활용 token filter. 조사 (J), 어미 (E), 감탄사 (IC) 등을 stop. "갤럭시를 검색했다" → 조사/어미 제거 → "갤럭시 검색" 으로 색인.

### 악마의 변호인

> "한국어도 standard analyzer 로 충분하지 않나요? 띄어쓰기로 분리되니까."

→ "한국어형태소분석기" 같은 복합어는 1 토큰. "한국어" 검색 → 매칭 ❌. 한국어는 nori 가 사실상 표준.

---

## Q5. text 와 keyword 타입의 차이는? 언제 어느 것을 써야 하나요?

### 답변

**핵심**: text = analyzer 적용 (토큰화), keyword = not analyzed (그대로). 정확 매칭 / sort / aggregation 은 무조건 keyword.

**설명**: 표준 패턴 = multi-field. `name` (text + nori) + `name.raw` (keyword) 동시 색인. 검색 (match) 은 `name`, 정렬 / 집계 / 정확 매칭은 `name.raw`.

**실무**: msa ProductEsDocument 는 `name` 만 text — `name.raw` keyword 추가가 점검 후보 (§15 §19).

**+α**: status / category / tag 같은 enum 류는 무조건 keyword. text 로 두면 정확 매칭이 안 맞음.

### 꼬리 Q5-1: term query 와 match query 의 차이는?

→ term = analyzer 미적용, raw lookup. match = analyzer 적용 후 토큰 매칭 + BM25. text 필드에 term 쓰면 거의 안 맞음.

#### 꼬리 Q5-1-1: keyword 필드에 match 를 쓰면?

→ 작동은 함. 단, term 이 더 명시적이고 효율적 (내부적으로도 같음). keyword = term, text = match 가 표준.

### 꼬리 Q5-2: filter context 와 query context 의 차이는?

→ query = score 계산 + 캐시 ❌. filter = score X + 캐시 O. 정확 매칭 / range / status 는 filter, 관련도 매칭은 query.

### 악마의 변호인

> "모든 필드를 text + keyword 로 다 두면 되는 거 아닌가요?"

→ 인덱스 크기 ↑ (저장공간 / 메모리). 단순 정렬 / agg 만 필요한 enum 은 keyword only.

---

## Q6. ES 의 Hybrid Search 의 RRF 가 무엇이고 weighted score 보다 좋은 점은?

### 답변

**핵심**: RRF (Reciprocal Rank Fusion) = 두 시스템 (BM25, vector) 의 **순위만** 사용해서 결합. score 정규화가 필요 없어 안정적.

**설명**:
```
score_RRF(d) = Σ_i [ 1 / (k + rank_i(d)) ]   (k 보통 60)
```
BM25 score 는 corpus / query 의존, vector cosine 은 0~1 정규화. score 분포가 달라서 weighted sum (α × BM25 + (1-α) × vector) 은 α 튜닝 어려움. RRF 는 순위만 보니 정규화 무관.

**실무**: msa 는 현재 hybrid 미적용. §18 의 PoC 로 product 검색에 hybrid (BM25 + dense_vector + RRF) 부분 적용 검증 가능.

**+α**: ES 8.8+ 에서 retriever / RRF native 지원. OpenSearch 는 search pipeline + normalization processor.

### 꼬리 Q6-1: 왜 BM25 와 vector 를 단순 합산하면 안 되나요?

→ BM25 score 는 0.5~50+ (corpus / query 의존), vector cosine 은 0~1 (정규화). 분포가 달라서 한쪽이 압도하기 쉽고, 쿼리마다 BM25 range 가 변해서 가중치 정규화가 매우 어려움.

#### 꼬리 Q6-1-1: 그래도 weighted sum 이 가능한 시나리오는?

→ 도메인이 한정적 (BM25 score range 가 안정) + score 정규화 (min-max / z-score) 를 매 쿼리마다 적용하면 가능. 하지만 RRF 가 단순하고 안정적.

### 꼬리 Q6-2: HNSW 의 M / ef_construction / ef_search 는 무엇인가요?

→ HNSW (Hierarchical Navigable Small World) 의 그래프 파라미터.
- M = 노드당 연결 수 (메모리 ↔ 정확도)
- ef_construction = 인덱싱 시 탐색 너비 (인덱싱 시간 ↔ 그래프 품질)
- ef_search = 쿼리 시 탐색 너비 (검색 latency ↔ recall)

### 악마의 변호인

> "kNN 만 쓰면 되지 BM25 까지 결합할 필요가 있나요?"

→ kNN 은 의미 매칭 강함. 정확 키워드 (제품 코드 "SM-F926N") 는 BM25 가 우월. 둘 다 활용이 best of both worlds.

---

## Q7. RDB 와 ES 의 정합성은 어떻게 맞추나요? Dual Write 의 위험은?

### 답변

**핵심**: 트랜잭션 안에서 ES 직접 호출 금지 (Dual Write 안티패턴). Outbox + Kafka + Consumer 가 표준.

**설명**: Dual Write 시 (1) RDB 성공 + ES 실패 → 부정합, (2) RDB 성공 + ES 성공 + 트랜잭션 commit 실패 → 부정합, (3) 외부 IO 가 트랜잭션 길게 → DB 락 영향.

**실무**: msa 는 product 트랜잭션 + outbox 테이블 + Kafka (`product.item.updated`) + search:consumer → ES bulk. 멱등성 패턴 (ADR-0012, version_type=external) 결합.

**+α**: ES 가 SoR 가 아님. 손실 시 RDB 에서 재구성 가능 = search:batch 의 alias swap reindex.

### 꼬리 Q7-1: Outbox 와 Debezium CDC 의 차이는?

→ Outbox = app 이 outbox 테이블에 명시적 INSERT (RDB 트랜잭션 같음) → relay 가 Kafka 발행. CDC = Debezium 이 binlog 직접 read → Kafka. 둘 다 atomicity 보장.

#### 꼬리 Q7-1-1: 어떤 상황에서 어느 것을 쓰나요?

→ Outbox: 신규 / 도메인 이벤트 명시적. CDC: legacy / app 코드 변경 어려움. msa 는 Outbox 우선 (도메인 이벤트 명확화).

### 꼬리 Q7-2: 멱등성은 어떻게 보장하나요?

→ ES 의 `version_type=external` + 도메인 version (예: updated_at epoch). 옛 버전 메시지가 새 doc 덮어쓰지 못하게.

### 악마의 변호인

> "Outbox 테이블 / relay 운영이 부담스러우니 그냥 트랜잭션에서 ES 호출하면 안 되나요?"

→ 비용 (인프라) vs 부정합 위험 (사용자 신뢰). Outbox 운영 부담은 1회성, Dual Write 의 부정합은 영구적 + 디버깅 매우 어려움.

---

## Q8. 색인 lag SLA 가 무엇이고 어떻게 측정하나요?

### 답변

**핵심**: lag = (RDB commit) → (ES 검색 가능) 시간. SLA 는 P99 < 5초 같은 정량 기준. doc 의 indexed_at 메타필드로 측정.

**설명**: lag 의 구성:
- Outbox polling: 0~1s
- Kafka: ~10ms
- Consumer 처리: ~100ms~1s
- ES bulk + refresh: ~100ms~1s
- 총 P99 ≈ 5초

측정: doc 인덱싱 시 server timestamp 추가 → 도메인 이벤트 timestamp 와 비교 → Prometheus histogram.

**실무**: §19 ADR-XXXX-1 로 색인 lag SLA 추가 제안. msa 의 ADR-0025 (latency budget) 보강.

**+α**: lag SLA 가 있어야 운영 알람 / 사용자 UX 설계 / 변경 영향 평가 가능.

### 꼬리 Q8-1: lag 를 줄이려면 어떻게 하나요?

→ Outbox polling interval ↓ (1s → 100ms 또는 push 방식 LISTEN/NOTIFY) / consumer batch 최적화 / refresh_interval default 유지 / wait_for 즉시 노출 시 (특수 케이스).

#### 꼬리 Q8-1-1: refresh_interval 을 줄이면 lag 가 줄어드나요?

→ ES 색인 가시성 lag 는 줄어듦. 단 1s 미만은 segment 폭증 / merge 부하로 안티패턴. 사용자 lag 1초 인지 안 됨.

### 꼬리 Q8-2: 사용자가 결제 직후 검색 결과에 안 보이는 시나리오는?

→ lag 5초 이내면 일반적으로 문제 없음. 즉시 노출 필요하면 ES `?refresh=wait_for` (다음 refresh 까지 대기). `?refresh=true` 는 segment 폭증 → ❌.

### 악마의 변호인

> "5초 lag 면 사용자가 새로고침할 텐데, 1초 이내가 표준 아닌가요?"

→ 도메인 의존. 일반 검색 (이커머스) 은 5초 OK, 결제 직후 / 본인 작성 직후는 wait_for / 즉시 노출 별도 처리.

---

## Q9. ES 와 OpenSearch 의 차이와 선택 기준은?

### 답변

**핵심**: 2021 년 라이선스 분기 (ES → SSPL/Elastic License, OpenSearch → Apache 2.0). 2024 ES 는 AGPLv3 추가로 OSS 진영 복귀.

**선택 기준**:
- 라이선스 자유 / SaaS 재판매 → OpenSearch
- ML / Anomaly Detection 적극 활용 → ES
- AWS managed → OpenSearch (네이티브)
- 8.x 신기능 (ESQL, semantic_text) 의존 → ES
- 기존 7.x 그대로 → 둘 다 OK (호환)

**실무**: msa search 는 ES 8.x client 사용 (`co.elastic.clients`). OpenSearch 도 인프라에 있지만 사용 안 됨 → §19 ADR-XXXX-3 (일원화) 검토.

**+α**: 라이선스 두려워서 OpenSearch 가던 분위기에서 2024 ES AGPLv3 추가로 다시 흐름 변화 중.

### 꼬리 Q9-1: API 호환성은 어느 정도인가요?

→ ES 7.x ↔ OS 1.x 거의 호환. ES 8.x ↔ OS 2.x 부터 분기 가속 (vector / kNN 매핑 / API 다름).

#### 꼬리 Q9-1-1: 마이그레이션 비용 결정 변수는?

→ 8.x 신기능 의존도. ESQL / semantic_text / ELSER 사용 중이면 매우 큼. 기본 검색만 쓰면 작음.

### 꼬리 Q9-2: SSPL 라이선스가 OSS 가 아닌 이유는?

→ "service 로 제공할 때 인프라 코드 모두 공개" 강제. AWS 같은 cloud provider 의 SaaS 를 막으려는 의도. OSI 가 OSS 정의에 부합 안 함으로 거절.

### 악마의 변호인

> "ES 가 다시 OSS 됐으니 OpenSearch 는 의미 없지 않나요?"

→ 이미 OpenSearch 가 독립 진화 (vector / hybrid 부분 우위, AWS 통합). 합쳐지지 않음. 도메인 / 환경별 best.

---

## Q10. msa 의 검색 시스템 아키텍처를 설명해주세요.

### 답변

**핵심**: SoR (RDB) + Outbox + Kafka + ES + alias swap 의 정통 패턴.

**구성**:
- **search:domain** — Pure Kotlin 도메인 + port
- **search:app** — REST API (8083), BM25 + function_score 검색
- **search:consumer** — Kafka (`product.item.created/updated`) → ES bulk (멱등 처리)
- **search:batch** — 전체 reindex, alias swap 무중단

**검색 흐름**: BM25 (`name` + nori) + filter (status=ACTIVE) + function_score (popularityScore log1p + ctr log1p, sum/sum).

**점검 포인트** (§15): 변동성 필드 `price` 색인, multi-field 미설정, version_type=external 명시 X 등 → §19 ADR 후보.

### 꼬리 Q10-1: alias swap 의 원리와 장점은?

→ 새 인덱스 (`products_v_timestamp`) 에 reindex 완료 → atomic alias swap (`POST /_aliases`) → 사용자 lag 0. 옛 인덱스 검증 후 cleanup.

#### 꼬리 Q10-1-1: alias swap 도중에 새 doc 이 들어오면?

→ consumer 가 새 인덱스 + 옛 인덱스 둘 다 인덱싱 (dual write 단계) 또는 alias 가 가리키는 곳에만 → 정합성 정책 결정.

### 꼬리 Q10-2: search:batch 가 일반 reindex 와 다른 점은?

→ Spring Batch 기반. JobExecutionListener 가 새 인덱스 생성 (beforeJob) + alias swap (afterJob). batch 실패 시 swap 스킵 → 부분 노출 방지.

### 악마의 변호인

> "Lucene 직접 안 쓰고 ES 까지 가야 했나요? Solr 도 있는데."

→ ES 가 시장 표준 + 운영 도구 (Kibana, ECK) 풍부. Solr 는 학습 비용 + 채용 시장 약함. 신규 시작은 ES/OS 중.

---

## Q11. 검색 latency 가 갑자기 P99 5초로 spike 했습니다. 진단 순서는?

### 답변

**진단 순서**:
1. `_cluster/health` → green/yellow/red 확인
2. `_nodes/hot_threads` → 어떤 작업이 CPU 잡는지 (search / merge / bulk 스레드)
3. `_cat/segments/products?v` → segment 개수 확인 (>100/shard 면 merge 부하)
4. slow_log → 느린 query 패턴
5. `_cat/thread_pool/search?v` → rejected count
6. `_cluster/stats` → indexing rate / search rate

**가능한 원인**:
- 무거운 query (wildcard, script) → query 재작성
- segment 폭증 (refresh 너무 잦음) → refresh_interval ↑
- bulk 인덱싱 폭주 → consumer batch ↓ 또는 priority
- GC pause → heap 검토

**실무**: msa 의 search:app 에 profile API + Prometheus 메트릭 통합 권장.

### 꼬리 Q11-1: hot_threads 결과를 어떻게 해석하나요?

→ 각 노드의 상위 N 스레드 + stack trace. `org.apache.lucene.search.IndexSearcher.search` 가 많으면 검색, `merge` 가 많으면 segment merge 진행 중.

### 꼬리 Q11-2: thread pool 이 rejected 가 0 이 아니면?

→ 처리 큐 가득 → 일부 요청 거부 (HTTP 429). 사용자에게 timeout / 5xx 가 아닌 429 가 떠야 정상 (재시도 가능).

### 악마의 변호인

> "그냥 노드 더 추가하면 되지 않나요?"

→ 단기 해결은 가능. 근본 원인 (무거운 query, segment 폭증) 안 잡으면 다시 발생. 진단 + 원인 해결 + 인프라 확장 순.

---

## Q12. ES 클러스터가 yellow 됐습니다. red 와 차이는?

### 답변

**차이**:
- **green** — 모든 primary + replica OK
- **yellow** — primary OK, replica 일부 미할당 → 가용성 ↓ (검색 / 인덱싱은 정상)
- **red** — primary 일부 미할당 → 데이터 손실 위험 + 검색 / 인덱싱 일부 불가

**yellow 진단**: `_cluster/allocation/explain` → 미할당 이유 확인.
- allocation awareness 충돌
- disk watermark 초과
- max_shards_per_node 초과
- 노드 부족

### 꼬리 Q12-1: disk watermark 3단계는?

→ low (85%): 새 shard 할당 거부. high (90%): 기존 shard 다른 노드로 이동. flood_stage (95%): 인덱스 read-only 강제.

#### 꼬리 Q12-1-1: flood_stage 후 회복 절차는?

→ 디스크 정리 (옛 인덱스 삭제 / 노드 추가) + `index.blocks.read_only_allow_delete: null` 수동 해제.

### 꼬리 Q12-2: red 시 복구 방법은?

→ snapshot 가용 → restore (다른 이름) → 검증 → alias swap. snapshot 없음 → product DB 에서 search:batch reindex.

### 악마의 변호인

> "yellow 면 무시해도 된다고 하던데요?"

→ 일시적이면 OK (replica 재배치 중). 5분 이상 지속이면 문제 — allocation explain 으로 원인 파악 필수.

---

## Q13. shard 개수는 어떻게 정하나요?

### 답변

**공식**:
- 샤드당 30-50GB 목표 (검색 워크로드)
- 노드당 shard ≤ 20 × heap_GB
- primary shard = ceil(예상 데이터 크기 / 샤드 크기)

**예시**:
- products 인덱스 200GB 예상 → 7 primary
- + replica 1 → 14 shard
- 3 data 노드 → 노드당 5 shard

**중요**: primary shard 개수 변경 ❌ (인덱스 생성 후 고정). 변경 = 새 인덱스 + reindex + alias swap.

**실무**: msa 의 product 인덱스는 작은 규모 (100MB 미만) → 1 primary 로 충분. future-proof 라며 30 shard 잡으면 fan-out 비용 폭증.

### 꼬리 Q13-1: replica 개수는 어떻게 결정하나요?

→ 가용성 (replica = 1 최소) + 읽기 처리량. 인덱싱 부하 ↑ trade-off. 동적 변경 가능.

### 꼬리 Q13-2: 너무 많은 shard 의 문제는?

→ 매 검색이 모든 shard fan-out → 네트워크 / 머지 비용 ↑. master 의 cluster state 비대. file descriptor / 스레드 부족.

### 악마의 변호인

> "shard 가 많을수록 병렬 처리되니 빠른 거 아닌가요?"

→ 인덱스 크기에 비해 너무 많으면 fan-out 비용이 병렬 이득 압도. 큰 인덱스 (수 TB) 에서만 의미.

---

## Q14. ES 의 백업과 복구는 어떻게 하나요?

### 답변

**백업**: snapshot API + S3/GCS/shared FS. SLM (Snapshot Lifecycle Management) 으로 자동화 (daily + 30일 보관).

```http
PUT /_snapshot/s3_repo/snapshot_2026_05_03
{ "indices": "products,orders" }
```

**복구**: `_restore` API 로 snapshot → 새 인덱스 → 검증 → alias swap.

**중요**: ES 가 SoR 가 아닌 경우 (msa 는 RDB 가 SoR) → snapshot 은 RTO 단축 도구. RDB → ES reindex 가 최후 안전망.

**실무**: msa 의 search:batch 가 product DB 전체 → ES reindex 가능. RTO 측정 (분기 1회 staging 훈련) 권장.

### 꼬리 Q14-1: RTO 와 RPO 의 차이는?

→ RTO (Recovery Time Objective) = 복구까지 최대 허용 시간. RPO (Recovery Point Objective) = 데이터 손실 최대 허용 시점 (예: snapshot 24시간 → RPO 24h).

### 꼬리 Q14-2: snapshot 만 있으면 안전한가요?

→ ❌. restore 가 작동해야 안전. 정기 훈련 (분기 1회) 필수. 권한 / 호환성 / 매핑 문제로 실패 흔함.

### 악마의 변호인

> "ES 가 SoR 가 아니면 snapshot 안 해도 되지 않나요?"

→ 재색인 RTO 가 길면 snapshot 필요 (예: 100만 doc reindex 가 1시간이면 snapshot 10분이 우월). RPO 는 RDB 로 보장.

---

## Q15. 임베딩 모델을 바꾸면 어떤 비용이 드나요?

### 답변

**핵심**: 임베딩 모델 변경 = 다른 벡터 공간 → **전체 reindex** + 모든 doc 재임베딩.

**비용**:
- 모든 doc 의 임베딩 추론 (수백만 건이면 수 시간~수일)
- dense_vector reindex (HNSW 그래프 재빌드)
- dual indexing 기간 (옛 모델 + 새 모델 동시 운영) → 메모리 / 디스크 2배
- A/B 검증 시간

**실무 권장**: mapping 에 `embeddingModel` 필드 명시 (예: "bge-m3-v1") → silent 변경 방지. 변경 시 새 인덱스 + alias swap.

### 꼬리 Q15-1: 차원을 줄이는 방법은?

→ OpenAI text-embedding-3 의 `dimensions` 파라미터 (Matryoshka representation), 또는 PCA. 1536 → 768 → 384 로 줄여 메모리 / 검색 비용 ↓.

#### 꼬리 Q15-1-1: 차원 줄이면 정확도 손실은?

→ 일반적으로 50% 까지 줄여도 nDCG 손실 5% 미만 (Matryoshka 모델). 도메인 검증 필수.

### 꼬리 Q15-2: HNSW 의 ef_search 를 키우면?

→ 검색 시 탐색 후보 ↑ → recall ↑ but latency ↑. num_candidates = k × 10~20 가 일반.

### 악마의 변호인

> "vector search 가 BM25 보다 항상 정확한 거 아닌가요?"

→ 정확 키워드 (제품 코드) 매칭은 BM25 가 우월. 의미 검색은 vector. 도메인 의존.

---

## Q16. 검색 품질은 어떻게 측정하나요?

### 답변

**메트릭**:
- **MRR** — 정답이 첫 번째 나오는 rank 의 역수 평균 ("첫 클릭" 위치)
- **nDCG@k** — 상위 k 의 누적 이득 (정답 가까울수록 ↑). 다중 정답에 표준
- **Recall@k** — 전체 정답 중 상위 k 안에 들어있는 비율
- **Precision@k** — 상위 k 중 정답 비율

**Judgment list** 필요:
- 도메인 전문가 라벨링 (정확, 비쌈)
- 클릭 로그 (Implicit Feedback) — 가장 흔함, position bias 보정 필수

**실무**: msa 의 analytics (ClickHouse) 가 클릭 로그 source. judgment 변환 + LTR (§10) 으로 자동 학습.

**도구**: ES Rank Eval API 로 nDCG 자동 측정 → CI 에 포함하면 검색 품질 회귀 감지.

### 꼬리 Q16-1: position bias 가 무엇이고 어떻게 보정하나요?

→ 위에 있을수록 클릭률 ↑ (관련도와 무관하게). 모델이 "위 위치 모방" 으로 학습 가능. IPW (Inverse Propensity Weighting) 같은 debiasing.

### 꼬리 Q16-2: 검색 품질 향상의 효과를 어떻게 정량화하나요?

→ A/B 테스트. group A (현행) vs group B (개선) 의 CTR, CVR, nDCG, MRR 비교 + 통계적 유의성 (paired t-test).

### 악마의 변호인

> "직관적으로 좋아진 게 보이는데 굳이 측정 필요한가요?"

→ 직관과 실측이 다른 경우 흔함. 한 query 잘 됐다고 전체 향상 보장 ❌. 정량 측정 필수.

---

## Q17. msa 의 검색 시스템에 개선할 점이 있다면?

### 답변

**§19 ADR 후보 4건**:

1. **색인 lag SLA 정의** (즉시) — 운영 가시성. P99 < 5s 명시 + Prometheus 메트릭.
2. **변동성 필드 컨벤션** (즉시) — `price` 같은 변동성 필드를 ES 에서 제거 검토. Two-Phase Lookup 강제.
3. **ES vs OpenSearch 일원화** (분기) — 인프라에 둘 다 있지만 search 는 ES 만 사용. 운영 부담 50% ↓.
4. **Hybrid Search 도입** (반기) — 자연어 / 동의어 검색 품질. PoC 후 결정.

**보너스**: 멱등성 표준 (version_type=external), multi-field 매핑, DLQ, alias swap 후 검증 단계 등.

**실무 접근**: 시뮬레이션 (§17) 으로 현 시스템 약점 검증 → ADR 우선순위 결정 → 분기별 점진 적용 + 측정.

### 꼬리 Q17-1: ADR 작성 시 가장 중요한 항목은?

→ **Alternatives Considered**. "왜 이 결정인가" 가 다른 선택지를 검토한 결과여야 설득력. Context 와 Consequences 도 중요.

### 꼬리 Q17-2: PoC 결과 효과 미미하면 어떻게 결정하나요?

→ 데이터로 명확히 폐기. "기술적 실험" 의 가치는 결정의 질을 높이는 것. 도입 강행 ❌.

### 악마의 변호인

> "현 시스템이 잘 돌아가는데 굳이 바꿀 필요가 있나요?"

→ "잘 돌아간다" 의 측정 기준 (lag SLA / 검색 품질 / 운영 안전성) 이 명시 안 돼있으면 모름. 명시화가 첫 단계, 그 후 개선 우선순위.

---

## 마무리 — 시니어가 면접에서 어필하는 패턴

### 1. 코드/메트릭 인용

- "msa 의 search:consumer 에서 BulkIngester (1000 ops, 5s flush) + retry ingester 이중 구조로..."
- "ProductEsDocument 는 nori analyzer 사용, function_score 의 popularityScore + ctr 결합..."

### 2. 트레이드오프 명시

- "k1 ↑ → tf 차이 잘 반영, 단 이상치에 민감"
- "RRF 는 정규화 무관, 단 점수 정보 손실"

### 3. 의사결정 프로세스

- "PoC → 메트릭 → A/B → ADR → 점진 적용"
- "Alternatives Considered 를 명시적으로 검토"

### 4. 운영 관점

- "snapshot 만 있고 restore 훈련 없으면 의미 X"
- "shard 산정 공식 + alert 임계값 + RTO 측정"

### 5. 비즈니스 시그널 결합

- "BM25 만으로 이커머스 부족 → function_score / LTR / business re-rank"
- "검색 품질 = nDCG / CTR / CVR 동시 측정"

---

## 부록. MAB / Thompson Sampling 면접 카드 (2026-05-12 추가)

§42~§44 의 온라인 학습 트랙 보강. 시니어/플랫폼 인터뷰에서 자주 묻는 영역.

### Q-M1. CTR 정렬에서 평균 CTR 만 저장하면 무엇이 빠지나요?

> **핵심**: uncertainty(분포 폭) 가 사라진다. 1/2 와 500/1000 둘 다 평균 50% 지만 진짜 CTR 이 어디 있을지 모르는 정도는 완전히 다르다. function_score 의 `ctr: Double` 같은 점추정 한 숫자는 신규 arm 의 cold-start 와 폭주를 동시에 만든다.

**꼬리**: "그럼 무엇을 저장해야 하나요?" → "clicks, impressions, lastTs 세 카운터. 조회 시점에 `Beta(clicks+α₀, impressions−clicks+β₀)` 로 분포를 구성. α, β 두 숫자가 분포 모양을 완전히 결정하므로 저장 부담 적다."

### Q-M2. Thompson Sampling 의 핵심은 무엇인가요?

> **핵심**: Bernoulli 의 conjugate prior 가 Beta 라서 posterior 업데이트가 `α += click`, `β += non-click` 두 카운터로 끝난다. 매 요청마다 그 Beta 분포에서 랜덤 샘플 하나 뽑아 ranking. 데이터가 적은 arm 은 분포가 넓어 가끔 높은 샘플이 나오는 효과로 exploration 이 자동 발생.

**꼬리**: "왜 광고/추천에서 표준이 됐나요?" → "prior 결합이 자연스럽고(empirical Bayes 직결), 분포 자체가 탐색 강도를 정해 별도 노브가 적다. Microsoft / Yahoo 실증 논문이 LinUCB 와 동등 이상 성능을 반복 보고."

### Q-M3. ES `gauss(created_at)` decay 와 Thompson Sampling 의 차이는?

> **핵심**: decay 는 결정적 freshness boost — 시간만 보고 클릭 학습 없음. TS 는 확률적 탐색 — 실제 반응으로 분포가 좁아지며 좋은/나쁜 arm 자동 분리. 두 축은 직교 — 함께 쓰면 신상품 seed boost + 실측 기반 미세 조정 모두 얻는다.

### Q-M4. msa search 에 MAB 를 어떻게 끼웠나요? (ADR-0043 사례)

> **핵심**: ES function_score 결과 top-N(100) 을 `ThompsonReranker` 가 `(categoryId, productId)` 단위 Redis state batch fetch, `Beta(clicks+priorα, impressions−clicks+priorβ)` 샘플링, `hybrid = 0.8 × esNorm + 0.2 × sample` 로 재정렬. Beta sampling 은 µs 단위라 ADR-0025 P99 200ms 예산 안에서 운영.

**꼬리**: "Redis 가 죽으면?" → "fetchBatch 가 빈 map 반환 → 모든 arm 이 prior 만 사용해 결정적 prior mean 으로 약간만 흔들림. 검색 자체는 계속 동작 (graceful degradation). state 는 클릭/노출 이벤트에서 다시 누적."

### Q-M5. cold-start (클릭 0) 인 신상품은 어떻게 다루나요?

> **핵심**: `Beta(1,1)` 은 평균 0.5 라 위험. 카테고리/지역 평균 CTR 기반 **empirical Bayes prior** 를 주입. 평균 CTR 10% 면 `Beta(α₀, β₀) = (1, 9)`, 신뢰도 강하면 `(5, 45)`. 추가로 `impressionThreshold` (예: 50) 미만은 prior 만 사용해 1~2 노출 첫 클릭 폭주 방지.

### Q-M6. flicker 가 뭐고 어떻게 방지하나요?

> **핵심**: TS 가 매 요청마다 새 sample 을 뽑아 같은 사용자에게 다른 순위가 보이는 현상. mitigation: (1) `(userId|sessionId, query)` session cache 60s 내 같은 sample 반환, (2) top-N 만 TS 적용 나머지 결정적, (3) 1~3 위 위치 보존 부분 sampling.

### Q-M7. MAB 와 LTR (LambdaMART) 의 관계는?

> **핵심**: 직교축. LTR 은 오프라인 학습 — judgment list 로 nDCG 직접 최적화. MAB 는 온라인 학습 — 실시간 클릭으로 분포 업데이트. 표준 cascade 는 `retrieve → function_score → LTR → MAB → business rerank`. 본 PR 은 Phase 1 이라 LTR 미도입, function_score → MAB 단순화.

### Q-M8. ε-greedy / UCB1 / Thompson 의 차이를 한 줄씩?

> - **ε-greedy**: ε 확률로 균등 랜덤 — 명백히 나쁜 arm 도 동일 노출. regret O(T).
> - **UCB1**: 결정적, `√(ln N / n)` 보너스. regret O(log T). prior 결합 어색.
> - **Thompson**: 확률적, posterior 샘플링. regret O(log T). prior/empirical Bayes 자연 결합.

**악마의 변호인**: "TS 가 결과를 흔들어 사용자 신뢰 하락은?" → "session cache 와 hybrid weight (default 0.8) 로 ES relevance dominate, TS 는 미세 조정만. A/B 로 검증 후 weight 조정."

> **§20 회독 체크리스트**:
> - [ ] 17개 질문에 핵심 답변 + 설명 + 실무 + +α 형식으로 답할 수 있다
> - [ ] 꼬리 질문 3단계까지 자연스럽게 이어간다
> - [ ] 악마의 변호인 패턴에 반박할 수 있다
> - [ ] msa 의 search 코드 / ADR / 점검 포인트를 실무 사례로 인용한다
> - [ ] 트레이드오프와 의사결정 프로세스를 시니어 톤으로 답한다

> **#19 학습 완료** 후 회독 권장:
> - 1주 후: 1회독 (§01, §02, §06, §11)
> - 1개월 후: 2회독 (§09, §15, §19, §20)
> - 분기 후: 3회독 (§17 시뮬레이션 실습 + 전체)
