---
id: 20
title: 추천 모델링 알고리즘 — CF · 베스트랭킹 · 거리/위치 · NLP 임베딩 · 딥러닝 추천 (engines/ (산업 사례) grounding + msa 적용)
status: completed
created: 2026-05-12
updated: 2026-05-12
refined: 2026-05-12 (bs 1차 — 알고리즘 중심 / Phase 6 논문+toy training / Phase 10 Two-Tower 까지 msa 구현 / Phase 1 부터 순차)
exec-started: 2026-05-12 (00-preview.md 생성, 소주제 28개 지도)
completed: 2026-05-12 (Phase 1-10 + 부록 §26-27, 27 deep file / ~12K 줄)
tags: [recommendation, collaborative-filtering, ctr, ranking, embedding, sentence-bert, two-tower, dlrm, wide-and-deep, ann, hnsw, faiss, geo-aware, spark, bigquery, airflow, recommendation-engines, msa-implementation]
difficulty: advanced
estimated-hours: 60
codebase-relevant: true
---

# 추천 모델링 알고리즘

## 1. 개요

추천 시스템은 "공출현 행렬 + 행동 가중합 + 임베딩 유사도 + 딥러닝 랭킹"의 4계층 스택으로 진화해 왔다. 본 주제는 여행 OTA (Online Travel Agency, 온라인 여행사) 의 실제 production `engines/` 디렉토리 (38개 추천 엔진) 를 grounding 으로 삼아, **CF (Collaborative Filtering, 협업 필터링) → Best-ranking → Geo-aware → NLP 임베딩 → 딥러닝 추천 → 메타/스코어 보정** 까지 산업계 백엔드/MLE (Machine Learning Engineer, 머신러닝 엔지니어) 관점에서 깊이 본다.

추천은 검색 (#19) 과 형제 영역이다. 검색은 **사용자가 쿼리한 의도** 에 맞추고, 추천은 **사용자가 쿼리하지 않은 잠재 의도** 를 예측한다. 두 영역 모두 BM25 (Best Match 25) / Embedding / Re-Ranking 같은 공통 인프라를 공유하면서도, 추천은 **공출현 행렬 (co-occurrence matrix) · 행동 가중합 · 시즌성 · cold-start** 같은 고유 문제를 갖는다. 백엔드 시니어가 알아야 하는 것은 모델 디테일이 아니라 **(1) 어떤 알고리즘이 어떤 비즈니스 시나리오에 맞는지, (2) 데이터 파이프라인 (Spark / BigQuery / Airflow) 설계, (3) 서빙 인프라 (ANN · Approximate Nearest Neighbor, 근사 최근접 이웃 / Two-stage retrieval), (4) A/B 테스트로 검증** 의 전체 흐름이다.

msa 본 레포에는 추천 서비스가 없지만, `analytics` (Kafka Streams + ClickHouse), `search` (BM25 → Hybrid Search 잠재), `experiment` (A/B 플랫폼) 가 추천 도입의 인프라 토대가 된다. 본 학습의 최종 산출물 후보는 ADR "MSA 에 추천 서비스 도입 — 1단계 룰 기반 Category Best → 2단계 CF Spark 잡 → 3단계 임베딩 ANN" 이다.

## 2. 학습 목표

- CF (협업 필터링) 의 3가지 형태 (Item-Item / User-Item / Hybrid) 와 공출현 행렬 구성법 설명, Jaccard / Cosine / PMI (Pointwise Mutual Information, 점별 상호정보량) 유사도 메트릭 선택 기준
- View Together (vt) / Search Together (st) / Buy Together (bt) / City Together (ct) 의 시그널 차이와 비즈니스 적용 시나리오 매핑
- 행동 가중합 (action weight) 설계 — `reservation×100 + click×20 + addwish×10 + pageview×1` 이 왜 산업 표준 패턴인가, Wilson score / Bayesian smoothing 으로 소노출 상품 왜곡 방지
- CTR (Click-Through Rate, 클릭률) vs CVR (Conversion Rate, 전환율) vs GMV (Gross Merchandise Volume, 총 거래액) — 무엇을 최적화할지에 따른 weight 설계
- Geo-aware 추천: Geohash / S2 / H3 셀 인덱싱, ES `geo_distance` vs BigQuery `ST_DWITHIN` vs PostGIS R-tree, 거리 패널티 + 인기 보정 결합
- 시즌성 추천 (예약일 ±7일 윈도우) 의 Spark sliding window 구현 패턴
- Sentence-BERT (KoBERT / Electra / RoBERTa / BART) 임베딩 코사인 유사도가 ES MoreLikeThis (TF-IDF 기반) 보다 우월한 시나리오, FAISS / HNSW (Hierarchical Navigable Small World, 계층적 탐색 가능 소세계) ANN 인덱스의 ef_construction / M 파라미터 트레이드오프
- 딥러닝 추천 4대 모델 이해: Wide & Deep (Google 2016), Two-Tower (YouTube 2019), DLRM (Deep Learning Recommendation Model, Meta 2019), Tab-Transformer (Amazon 2020) — 각 모델이 풀려는 문제와 구조적 특징
- Two-stage retrieval 파이프라인: Two-Tower (retrieval, 수천만 → 수백) → DLRM/Wide&Deep (ranking, 수백 → 수십) 의 산업 표준 아키텍처
- Cold-start 문제: 신규 유저 (default preference / c2dp), 신규 상품 (콘텐츠 기반 / 임베딩), 신규 도시 (도시 transfer learning)
- 빌드/배포 패턴: Scala 2.11 + Spark 2.4.4 Dataproc 워크플로, Pure BigQuery + Airflow DAG, Python 딥러닝 (TensorFlow / PyTorch + AWS p2/g5), Flask + waitress 추론 서버
- MSA 적용 후보 ADR 도출: `analytics` 의 Kafka Streams + ClickHouse 가 OTA 의 BigQuery + Airflow 를 어떻게 대체 가능한가, `search` 의 Hybrid Search 도입 (#19 cross-ref), `experiment` 로 추천 알고리즘 A/B 검증

## 3. 선수 지식

- **확률/통계 기본**: 조건부 확률, 기대값, PMI, Bayesian inference 개념적 이해
- **선형대수 기본**: 벡터 내적, 코사인 유사도, 행렬 곱
- **머신러닝 기본**: supervised / unsupervised, train/val/test split, overfitting, regularization
- **딥러닝 기본 (있으면 좋음)**: MLP (Multi-Layer Perceptron, 다층 퍼셉트론), embedding layer, attention 개념
- **검색엔진 (#19)**: BM25, Inverted Index, ES Query DSL, Vector search (HNSW) — 추천의 dense vector 와 직결
- **분산 시스템 (#7)**: eventual consistency, batch vs streaming 패러다임
- **Kafka (#6)**: 이벤트 수집/스트리밍 — analytics 와 연결
- **DB 인덱스 (#4)**: B-tree, R-tree (geo) 확장 학습 필요

## 4. 학습 로드맵

### Phase 1: 기본 개념 — CF (협업 필터링) 기초 **[학습 시작점 / ~5h]**
- 추천 시스템 개론 — content-based vs collaborative filtering vs hybrid
- Item-Item CF vs User-Item CF — OTA 가 Item-Item 채택한 이유 (cold-user 회피)
- 공출현 행렬 (co-occurrence matrix) 구성 — Spark `flatMap + groupByKey` 패턴
- **유사도 메트릭 deep-dive (사용자 약점 영역)** — Jaccard / Cosine / PMI / Lift / Pearson correlation
  - 각 메트릭의 수식 derivation + 선호 시나리오 + 함정 (popular item bias 등)
  - 코드 예제 (Python/Scala) 로 동일 데이터셋에 4종 메트릭 적용 후 결과 비교
- 행렬 분해 (Matrix Factorization) 개념 — SVD / ALS / FunkSVD, latent factor model 의 의미
- 산업 추천 엔진 카탈로그 명명규칙 — vt/st/bt/ct, 접미사 (`-acc`/`-mi`/`-pkg`/`-com`/`-vtf`/`-cp`) **간략 정리만** (사용자 익숙 영역)

### Phase 2: 베스트 랭킹 — 행동 가중합 + CTR 보정 **[~3h]**
- 행동 가중치 패턴 (`reservation×100 + click×20 + addwish×10 + pageview×1`) — **사용자 익숙, 도출 과정만 정리**
- CTR vs CVR vs GMV — 어떤 KPI 에 최적화할지에 따른 weight 차이
- **Wilson score / Bayesian smoothing deep-dive (사용자 약점)** — lower confidence bound 수식 + 적은 노출 상품 점수 왜곡 방지 메커니즘
  - 코드 예제로 Wilson score interval, Bayesian smoothing 적용 비교
- Dynamic action weight (lb / urb 의 `dyn_action_weight`) — 정적 weight vs 시간/카테고리별 동적 weight
- Category Best (cb / cb2) / Urban (urb) — OTA 구현 패턴 간략 정리

### Phase 3: 거리/위치 기반 (Geo-aware) 추천 **[~2h]**
- Geohash / S2 (Google) / H3 (Uber) 셀 인덱싱 비교
- ES `geo_distance` query vs BigQuery `ST_DWITHIN` vs PostGIS R-tree
- 숙소 → TNA cross 추천 — **거리 패널티 + 인기 보정 결합 공식 derivation**
- 랜드마크 인기도 (lb / ldp) — 도시별 POI (Point of Interest, 관심 지점) 기반 인기 랭킹

### Phase 4: 시즌 / 베스트 / 통합 스코어 **[~2h]**
- 시즌 인기 (sba) — 예약일 ±7일 sliding window Spark 구현 패턴
- Trip Home (th) — 통합 `feature_score` 가중치 도출
- Section preference (stb) — 메인 페이지 섹션 임프레션 → contextual bandit (MAB, Multi-Armed Bandit, 다중 슬롯머신) 으로 진화 가능성 (#19 §42-44 cross-ref)

### Phase 5: NLP 임베딩 추천 **[~4h]**
- Sentence-BERT 구조 — Siamese BERT, mean pooling, cosine similarity loss **(논문 독해)**
- 한국어 임베딩 모델 비교 — KoBERT (SKT) / KLUE-BERT / Electra / RoBERTa / BART
- ES MoreLikeThis (TF-IDF) vs dense vector — 어디서 우월한가, 무엇을 못 잡는가 (구체 시나리오 분석)
- **ANN 인덱스 deep-dive (사용자 약점)** — FAISS (Meta) vs HNSW vs Annoy (Spotify) vs ScaNN (Google)
  - HNSW 의 ef_construction / M 파라미터가 무엇을 통제하는가
  - 메모리/recall/latency trade-off 측정 (#19 §08 cross-ref)
- 형태소 분석 + 공기빈도 (rs 엔진) — 연관 검색어 알고리즘, search_term co-occurrence
- 신상품 cold-start vs embedding refresh 주기 trade-off

### Phase 6: 딥러닝 추천 — 논문 독해 + Toy Training **[~16h, 핵심 페이즈]**

**산출물**: 논문 4편 독해 노트 + Jupyter notebook (MovieLens-1M 으로 직접 학습/추론)

#### 6-A. 논문 4편 원문 독해 (~6h)
- **Wide & Deep Learning for Recommender Systems** (Cheng et al., Google, DLRS 2016)
  - linear part (memorization) + DNN part (generalization) joint training
  - feature cross product transformation, FTRL-Proximal + AdaGrad optimizer 분리
- **Deep Neural Networks for YouTube Recommendations** (Covington et al., RecSys 2016) → **Two-Tower 의 원형**
  - candidate generation (retrieval) vs ranking 의 분리
  - watch time 으로의 weighted logistic regression
- **Deep Learning Recommendation Model (DLRM)** (Naumov et al., Meta 2019)
  - dense + sparse feature 분리, sparse 는 embedding lookup
  - interaction = dot product of all pairs (FM-style)
  - model + data parallelism scaling
- **TabTransformer: Tabular Data Modeling Using Contextual Embeddings** (Huang et al., Amazon 2020)
  - categorical embedding 에 multi-head self-attention 적용
  - contextual embedding 으로 정형 데이터에서 transformer 활용

#### 6-B. Two-stage retrieval + ranking 파이프라인 이해 (~2h)
- retrieval (Two-Tower, 수천만 → 수백) → ranking (DLRM/Wide&Deep, 수백 → 수십) 산업 표준 아키텍처
- 각 stage 의 latency / recall / precision 트레이드오프

#### 6-C. Toy Training (Jupyter Notebook, ~6h)
- **데이터셋**: MovieLens-1M (사용자 6K × 영화 4K × 평점 1M) — 추천 시스템 표준 벤치마크
- **실습 1**: Two-Tower 구현 — user tower / item tower / dot-product / sampled softmax loss
- **실습 2**: Wide & Deep 구현 — linear + DNN joint, MovieLens 의 genre / occupation 을 wide feature 로
- **실습 3**: 학습된 Two-Tower embedding 을 FAISS 에 색인 → ANN retrieval latency 측정
- **출력**: notebook → `study/docs/20-recommendation-modeling/notebooks/` 디렉토리에 저장

#### 6-D. 응용 디테일 (~2h)
- DeepFM / xDeepFM / DCN-v2 (Deep & Cross Network v2) / AutoInt — feature interaction 자동화 패밀리 (concept only)
- Negative sampling 전략 — in-batch negatives, hard negatives mining, popularity-debiased sampling
- Two-Tower 의 임베딩 차원 (보통 64~256) vs 메모리 vs 정확도 trade-off
- AWS p2 (K80) vs g5 (A10G) GPU 인스턴스 선택 기준, TF Serving / TorchServe 비교
- **vt-deep 14종의 실제 정체** — 산업 내부 코드 직접 확인 (사용자 본인 검증) → 일반 산업 패밀리 매핑

### Phase 7: 메타 / 스코어 보정 / Cold-start **[~3h]**
- 섹션 매핑 reference (mr) — home / main_ / xsell 메타 DB
- Default preference (c2dp) — 도시×카테고리2 cold-user fallback
- Score boosting (union-stay-score) — business rule injection
- **Cold-start 3축 deep-dive**: 신규 유저 (demographics + default) / 신규 상품 (content-based + embedding) / 신규 도시 (transfer learning)
- Position bias 보정 — IPW (Inverse Propensity Weighting, 역경향성 가중치) 기본 개념

### Phase 8: 빌드/배포 패턴 + 인프라 **[~2h, 사용자 익숙 영역 — 압축]**
- Scala 2.11 + Spark 2.4.4 Dataproc vs MSA 의 Kafka Streams — 비교 표만
- BigQuery + Airflow DAG vs MSA 의 ClickHouse + (Airflow 도입 여부) — ADR 후보로 정리
- Python 딥러닝 워크로드 (Phase 6 산출물의 production 화) — TF Serving / TorchServe 선택
- Feature store 개념 — Feast / Vertex AI Feature Store / 자체 구현 trade-off

### Phase 9: 운영 — A/B 테스트, 메트릭, 디버깅 **[~3h]**
- Online metrics — CTR, CVR, GMV, dwell time, diversity, novelty
- Offline metrics — Recall@K, NDCG (Normalized Discounted Cumulative Gain, 정규화 할인 누적 이득), MAP (Mean Average Precision, 평균 정확도 평균)
- A/B 테스트 설계 — 표본 크기 계산, statistical power, multiple testing 보정
- Multi-armed bandit (MAB) 으로 cold-start 추천 — epsilon-greedy / UCB (Upper Confidence Bound) / Thompson sampling (#19 §42-44 cross-ref)
- Drift detection — data drift / concept drift / feedback loop bias
- Counterfactual evaluation — 추천 시스템 특유의 평가 어려움

### Phase 10: MSA 적용 — Phase 1~3 전체 구현 **[~24h, 실전 구현]**

**산출물**: ADR 3건 + msa `recommendation` 서비스 신규 모듈 + 룰 기반 CB + CF Spark 잡 PoC + Two-Tower ANN 서빙

#### 10-A. ADR 3건 작성 (~3h)
- **ADR-XXXX**: MSA 추천 서비스 도입 단계 — Phase 1 룰 기반 CB → Phase 2 CF Spark → Phase 3 임베딩 ANN → Phase 4 Two-Tower retrieval
- **ADR-XXXX**: 추천 데이터 파이프라인 — Kafka Streams + ClickHouse vs Spark + BigQuery + Airflow 비교 결정
- **ADR-XXXX**: 임베딩 ANN 인덱스 선택 — FAISS vs HNSW (ES) vs ScaNN 트레이드오프

#### 10-B. recommendation 서비스 스캐폴딩 (~4h)
- `recommendation/domain/` + `recommendation/app/` nested submodule 구조 (msa CLAUDE.md 패턴)
- Clean Architecture — Controller / Service / Port / Adapter
- Kafka topic 정의 — `recommendation.events` (view/click/purchase/wishlist)
- DB schema (MySQL 또는 ClickHouse, ADR 결과에 따름)

#### 10-C. Phase 1 — 룰 기반 Category Best 구현 (~5h)
- 행동 가중합 (`reservation×100 + click×20 + addwish×10 + pageview×1`) 을 ClickHouse SQL 로 구현
- 도시×카테고리 Top-N 캐시 (Redis) — 1시간 주기 갱신
- API: `GET /api/v1/recommendations/category-best?city=&category=&limit=`
- 통합 테스트 — Kotest BehaviorSpec + MockK (test-rules.md 준수)

#### 10-D. Phase 2 — CF Spark 잡 PoC (~7h)
- Spark 잡 작성 — analytics 의 ClickHouse 에서 (user, item, action) 추출 → 공출현 행렬 → cosine similarity
- 결과를 Redis 또는 별도 테이블 (`item_similarity`) 에 저장
- API: `GET /api/v1/recommendations/similar-items?itemId=&limit=`
- batch 모듈 분리 — `recommendation/batch/` (search/batch 패턴 참고)

#### 10-E. Phase 3 — Two-Tower retrieval ANN 서빙 (~5h)
- Phase 6 에서 학습한 Two-Tower 모델을 ONNX 또는 TF SavedModel 로 export
- item embedding 을 FAISS 또는 HNSW 인덱스에 색인 (`recommendation/infrastructure/ann/`)
- user embedding 은 inference 시점에 user tower 호출
- API: `GET /api/v1/recommendations/personalized?userId=&limit=`
- 인프라 ADR 후속 — embedding 서빙을 별도 Python 서비스 vs Kotlin 내장 ONNX Runtime 선택

#### 10-F. Gateway 라우팅 + experiment A/B 연동 (~선택, ~5h)
- gateway 에 `/api/v1/recommendations/*` 라우팅 추가
- experiment 서비스로 추천 알고리즘 (CB / CF / Two-Tower) A/B 비교
- 메트릭 수집 — analytics 로 click/purchase 이벤트 발행

## 5. 코드베이스 연관성

**msa 본 레포 직접 연관**: 없음 (추천 서비스 미구현)

**msa 본 레포 간접 연관 (인프라 토대)**:
- `analytics` 서비스 — 이벤트 수집 + 스코어 산출 (Kafka Streams + ClickHouse), OTA 의 BigQuery + Airflow 와 비교 대상
- `search` 서비스 — BM25 검색, 향후 Hybrid Search 도입 시 임베딩 ANN 인프라 공유 가능 (#19 cross-ref)
- `experiment` 서비스 — A/B 테스트 플랫폼, 추천 알고리즘 비교 실험에 활용
- `product` 서비스 — SSOT (Single Source of Truth, 단일 진실 출처), 추천 대상 도메인

**외부 grounding (필수)**:
- OTA `engines/` 디렉토리 — 38개 추천 엔진 production 코드
  - 입력 자료: `study/notes/archive/2026-05-12-ota-추천엔진-카탈로그.md`
  - 명명규칙 (vt/st/bt/ct/cb/lb/...) + 6개 카테고리 + 빌드 패턴 4종

**ADR 후보 (Phase 10 산출)**:
- "MSA 추천 서비스 도입 단계 (Phase 1~4)"
- "추천 데이터 파이프라인 — Kafka Streams + ClickHouse vs Spark + BigQuery + Airflow"
- "임베딩 ANN 인덱스 선택 — FAISS vs HNSW (ES) vs ScaNN"

## 6. 참고 자료

### 책 / 논문
- **Recommender Systems Handbook (2nd ed., Springer 2015)** — Ricci et al., CF 표준 교과서
- **Wide & Deep Learning for Recommender Systems (Cheng et al., 2016)** — Google
- **Deep Neural Networks for YouTube Recommendations (Covington et al., 2016)** — Two-Tower 원조
- **Deep Learning Recommendation Model for Personalization and Recommendation Systems (Naumov et al., 2019)** — Meta DLRM 논문
- **TabTransformer (Huang et al., 2020)** — Amazon
- **Sentence-BERT (Reimers & Gurevych, 2019)** — EMNLP

### 산업 글
- YouTube Recommendations Two-Tower Paper (RecSys 2019)
- Pinterest PinSage (KDD 2018) — Graph-based recommendation
- Airbnb Embedding for Search Ranking (KDD 2018) — listing embedding
- Spotify Annoy ANN library — github.com/spotify/annoy

### 한국어 자료
- KoBERT (SKT) — github.com/SKTBrain/KoBERT
- KLUE Benchmark — klue-benchmark.com
- KoSentence-BERT — github.com/BM-K/KoSentenceBERT-SKT

### Cross-ref (study/)
- #19 검색엔진 §08 (vector-semantic-search), §07 (hybrid-search), §42-44 (MAB/Thompson sampling)
- #6 Kafka — 이벤트 수집 stream
- #7 분산시스템 — batch vs streaming, eventual consistency
- #4 DB 인덱스 — R-tree (geo), B-tree 확장
- #16 비동기/논블러킹 — Python Flask + waitress 서빙 비교

## 7. 결정 사항 (bs 1차 — 2026-05-12)

| # | 항목 | 결정 |
|---|------|------|
| 1 | 알고리즘 vs 인프라 비중 | **알고리즘 중심** — Phase 1~7 deep-dive, Phase 8 인프라는 비교 표 수준으로 압축 (사용자가 Spark/BigQuery/Airflow 운영 익숙) |
| 2 | Phase 6 딥러닝 디테일 | **논문 원문 4편 독해 + MovieLens-1M toy training** — Two-Tower / Wide&Deep 직접 구현, FAISS ANN 색인 실측. ~16h. |
| 3 | Phase 10 msa 적용 산출물 | **Phase 1~3 전체 구현** — ADR 3건 + recommendation 서비스 스캐폴딩 + 룰 기반 CB + CF Spark PoC + Two-Tower ANN 서빙. ~24h. |
| 4 | 학습 시작점 | **Phase 1 부터 순서대로** — CF 수식/유사도 메트릭 기초 → 점진적으로 깊이 |
| 5 | 시간 총량 | **60시간** (기존 42h → +18h, Phase 6/10 강화 반영) |
| 6 | vt-deep 14종 정체 | **Phase 6-D 에서 사용자 본인이 OTA 코드 직접 확인 후 일반 산업 패밀리에 매핑** |
| 7 | 사용자 약점 영역 우선순위 | CF 유사도 메트릭 수식 / Wilson score / ANN 파라미터 (ef_construction, M) / 딥러닝 모델 구조 — 학습 로드맵에 명시적 표시 |
| 8 | 사용자 익숙 영역 압축 | OTA 명명규칙 / 행동 가중합 패턴 / Spark·BigQuery·Airflow 인프라 — 간략 정리만 |

**추가 미결 (Phase 10 진입 시 결정)**:
- recommendation 서비스의 DB — MySQL vs ClickHouse 직접 사용 (ADR-XXXX 에서 결정)
- embedding 서빙 — 별도 Python 서비스 (FastAPI) vs Kotlin 내장 ONNX Runtime (ADR-XXXX 에서 결정)
- gateway 라우팅 + experiment A/B 연동 (10-F) 은 optional — 시간 여유 보고 진행

## 8. 원본 메모

```text
20. 추천 모델링 알고리즘 (CF · 베스트랭킹 · 거리/위치 · NLP 임베딩 · 딥러닝 추천)
  20-1. 동시 행동 기반 협업 필터링 (CF · Collaborative Filtering) — View Together / Search Together / Buy Together / City Together, 공출현 행렬, Item-Item vs User-Item CF, Jaccard / Cosine / PMI 유사도
  20-2. 베스트 랭킹 (Category Best · Urban) — 행동 가중합 (`reservation×100 + click×20 + addwish×10 + pageview×1`), CTR vs CVR, Wilson score / Bayesian smoothing, dynamic weight 변형 (lb/urb)
  20-3. 거리/위치 기반 (Geo-aware) — 숙소→TNA cross, Geohash / S2 / H3 셀, ES `geo_distance` / BigQuery `ST_DWITHIN`, 거리 패널티 + 인기 보정 결합, 랜드마크 인기도 (lb/ldp)
  20-4. 시즌 / 베스트 / 재구매 — 예약일 ±7일 시즌성 (sba), `중기 CTR 피처` (ctr-best), 재구매 사용자 수 (resale-best), Trip Home 통합 score (th)
  20-5. 콘텐츠 / NLP 임베딩 — Sentence-BERT (KoBERT / Electra / RoBERTa / BART) 문장 임베딩 코사인 유사도, ES MoreLikeThis (TF-IDF) 대체 시나리오, FAISS / HNSW (ANN · Approximate Nearest Neighbor), 형태소 분석 + 공기빈도 연관 검색어 (rs)
  20-6. 딥러닝 추천 (vt-deep 14종) — Wide & Deep (Google 2016), Two-Tower (YouTube 2019), DLRM (Deep Learning Recommendation Model, Meta 2019), Tab-Transformer (Amazon 2020), DeepFM / xDeepFM / DCN-v2 / AutoInt, two-stage retrieval (Two-Tower) → ranking (DLRM/Wide&Deep) 파이프라인
  20-7. 메타 / 스코어 보정 / 디스트리뷰션 — 섹션 매핑 reference DB (mr), default preference (c2dp), union-stay 부스팅 (union-stay-score), section preference bandit 후보 (stb)
  20-8. NER 추론 인프라 (nero) — KLUE-BERT 한국어 NER, Flask + waitress + AWS GPU AMI, 검색어 의도 파악 — **추천이 아닌 검색 인프라**, 비교/contrast 용
  20-9. 빌드/배포 패턴 — Scala 2.11 + Spark 2.4.4 Dataproc, Pure BigQuery + Airflow DAG, Python 딥러닝 (TensorFlow / PyTorch), `cloudbuild-dags.yaml` 로 `airflow-workflows` 레포 sync
  20-10. msa 적용 후보 — `analytics` (Kafka Streams + ClickHouse) vs OTA 의 BigQuery + Airflow, `search` 의 BM25 → Hybrid Search 도입 (#19 cross-ref), `experiment` A/B 플랫폼으로 추천 알고리즘 비교, ADR 후보: "추천 서비스 도입 — 1단계 룰 기반 CB → 2단계 CF Spark → 3단계 임베딩 ANN"
  > 입력 자료: `study/notes/archive/2026-05-12-ota-추천엔진-카탈로그.md` (engines/ (산업 사례) 디렉토리 전체 카탈로그 — 명명규칙 + 6개 카테고리 + 빌드/배포 패턴 + 학습 분해 + cross-ref)
```
