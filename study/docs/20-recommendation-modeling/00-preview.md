---
parent: 20-recommendation-modeling
type: preview
created: 2026-05-12
---

# 추천 모델링 알고리즘 — Preview

> 학습자 수준: 여행 OTA (Online Travel Agency, 온라인 여행사) engines/ **운영 경험 있음** / 알고리즘 디테일은 약함
> 전체 예상 시간: **60h** · 목표: **알고리즘 중심 + msa Phase 1~3 실제 구현**
> 계획서: [00-plan.md](00-plan.md) · 학습 순서: **순차 (Phase 1 → 10)** · 집중 페이즈: **6 (논문+toy) / 10 (msa 구현)**

---

## 멘탈 모델: "추천 Funnel + Two-Stage Retrieval"

추천 시스템은 단일 모델이 아니라 **수천만 candidate 를 단계적으로 좁히는 funnel** 이다. 면접/실무 트러블은 거의 항상 어느 stage 의 어느 컴포넌트에서 발생한다.

```
                  사용자 (수억 명) × 아이템 (수천만 개)
                              │
                              │  "후보 생성 — recall 중시, latency must"
                              ▼
        ┌─────────────────────────────────────────────────┐
        │  Stage 1: Retrieval (수천만 → 수백)              │
        │  ─────────────────────────────────────────────  │
        │  - CF (협업 필터링) — vt/st/bt 공출현 행렬       │
        │  - Two-Tower — user/item embedding · dot product│
        │  - Geo-aware — Geohash/S2/H3 + 거리 패널티       │
        │  - Content-based — Sentence-BERT 임베딩 + ANN    │
        │  - 룰 기반 — Category Best / Trip Home / 시즌    │
        └────────────────────────┬────────────────────────┘
                                 │
                                 │  "정밀 랭킹 — precision 중시"
                                 ▼
        ┌─────────────────────────────────────────────────┐
        │  Stage 2: Ranking (수백 → 수십)                  │
        │  ─────────────────────────────────────────────  │
        │  - Wide & Deep (memorization + generalization)   │
        │  - DLRM (sparse + dense feature interaction)     │
        │  - Tab-Transformer (categorical self-attention)  │
        │  - LTR (Learning to Rank) / cross-encoder        │
        └────────────────────────┬────────────────────────┘
                                 │
                                 │  "비즈니스 룰 / 부스팅"
                                 ▼
        ┌─────────────────────────────────────────────────┐
        │  Stage 3: Boost / Re-rank (수십 → Top-K)         │
        │  ─────────────────────────────────────────────  │
        │  - business rule (union-stay-score, mr, c2dp)     │
        │  - diversity / freshness 보정                    │
        │  - cold-start fallback (default preference)      │
        └────────────────────────┬────────────────────────┘
                                 │
                                 ▼
                       Top-K 추천 결과 노출
                                 │
        ┌────────────────────────┴────────────────────────┐
        │  Feedback Loop: click/purchase → 다음 학습 입력 │
        │  - A/B 테스트로 알고리즘 비교                    │
        │  - Online metrics (CTR / CVR / GMV) 모니터링     │
        │  - Drift detection (data / concept / feedback)   │
        └─────────────────────────────────────────────────┘
```

**핵심 7문장만 외운다**:

1. **추천 = Funnel** — Retrieval (recall 중시) → Ranking (precision 중시) → Boost (business rules). 각 stage 의 latency budget 이 다르다 (retrieval ~50ms / ranking ~30ms / boost <10ms).
2. **CF (협업 필터링) 의 본질** = "비슷한 사용자/아이템을 찾는 것" → 공출현 행렬 + 유사도 메트릭. **Jaccard** (집합 교집합) vs **Cosine** (벡터 각도) vs **PMI (Pointwise Mutual Information, 점별 상호정보량)** (확률 기반) — 데이터 sparsity 와 popular item bias 에 따라 선택.
3. **행동 가중합 패턴** = `reservation×100 + click×20 + addwish×10 + pageview×1` 은 산업 표준. 비율은 무엇을 최적화하는가 (CTR vs CVR vs GMV) 에 따라 달라짐. **Wilson score / Bayesian smoothing** 으로 적은 노출 상품 점수 왜곡 방지.
4. **Two-Tower 의 정체** = user tower + item tower 분리 → dot product score → 서빙 시 item embedding 을 ANN (Approximate Nearest Neighbor) 인덱스에 색인하면 retrieval 이 수십 ms 가능. **YouTube 2019 논문이 retrieval 표준** 으로 만듦.
5. **DLRM (Deep Learning Recommendation Model, Meta 2019) 의 정체** = sparse feature (categorical, embedding lookup) + dense feature → pairwise interaction (dot product) → MLP. **ranking 단계 표준**. Wide&Deep 보다 feature interaction 표현력 우월.
6. **Cold-start 3축** = 신규 유저 (demographics + popularity fallback) / 신규 상품 (content-based + embedding) / 신규 도시 (transfer learning + 룰 기반). msa 구현 시 Phase 1 룰 기반이 cold-start 의 안전망 역할.
7. **ANN 인덱스 = HNSW (Hierarchical Navigable Small World) 가 사실상 표준** — `M` (노드당 연결 수, 메모리 ↔ 정확도) · `ef_construction` (빌드 너비) · `ef_search` (쿼리 너비, latency ↔ recall). FAISS / Annoy / ScaNN 도 결국 비슷한 trade-off 곡선.

---

## 소주제 지도

> 28개 파일로 분할 (00-preview + 01~27). 각 파일 평균 ~2h (전체 60h ÷ 27 ≈ 2.2h 평균, Phase 6/10 이 더 두꺼움).

### Phase 1: CF (협업 필터링) 기초 (4개) — **사용자 약점 영역, 시작점**

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 01 | 추천 시스템 개론 + Funnel 멘탈 모델 | [01-recommendation-overview.md](01-recommendation-overview.md) | content vs collaborative vs hybrid, Two-stage retrieval 의 정체, 추천 vs 검색 차이 |
| 02 | CF 유사도 메트릭 deep-dive | [02-cf-similarity-metrics.md](02-cf-similarity-metrics.md) | Jaccard / Cosine / PMI / Lift / Pearson 수식, popular item bias, sparse 데이터 함정 |
| 03 | Matrix Factorization (SVD / ALS / FunkSVD) | [03-matrix-factorization.md](03-matrix-factorization.md) | latent factor model, ALS Spark 구현, Netflix Prize 의 유산 |
| 04 | 추천 엔진 명명규칙 + CF 패밀리 카탈로그 | [04-recommendation-engines-cf-family.md](04-recommendation-engines-cf-family.md) | vt/st/bt/ct + `-acc`/`-mi`/`-pkg`/`-com`/`-vtf`/`-cp` (사용자 익숙 영역 — 간략 정리) |

### Phase 2: 베스트 랭킹 (2개) — **부분 약점 (Wilson / Bayesian)**

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 05 | 행동 가중합 + CTR/CVR/GMV KPI | [05-action-weighting-ctr.md](05-action-weighting-ctr.md) | `reservation×100 + click×20 + addwish×10 + pageview×1` 도출, KPI 별 weight 차이, dynamic weight (lb/urb) |
| 06 | Wilson score / Bayesian smoothing | [06-wilson-bayesian-smoothing.md](06-wilson-bayesian-smoothing.md) | lower confidence bound 수식, 적은 노출 상품 점수 왜곡 방지, Beta-Binomial conjugate prior |

### Phase 3: Geo-aware 추천 (1개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 07 | 거리/위치 기반 추천 | [07-geo-aware-recommendation.md](07-geo-aware-recommendation.md) | Geohash / S2 / H3 비교, ES `geo_distance` vs BigQuery `ST_DWITHIN`, 거리 패널티 + 인기 보정 결합 공식, 랜드마크 인기도 (lb/ldp) |

### Phase 4: 시즌 / 베스트 / 통합 스코어 (1개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 08 | 시즌·통합스코어·MAB 후보 | [08-season-trip-home-mab.md](08-season-trip-home-mab.md) | sba (예약일 ±7일 sliding window), th (Trip Home `feature_score`), stb → MAB 진화 (#19 §42-44 cross-ref) |

### Phase 5: NLP 임베딩 추천 (3개) — **ANN 파라미터 약점**

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 09 | Sentence-BERT 임베딩 (KoBERT / Electra / RoBERTa / BART) | [09-sentence-bert-embedding.md](09-sentence-bert-embedding.md) | Siamese BERT 구조, mean pooling, cosine similarity loss, 한국어 모델 비교 |
| 10 | ANN 인덱스 deep-dive (FAISS / HNSW / Annoy / ScaNN) | [10-ann-faiss-hnsw.md](10-ann-faiss-hnsw.md) | HNSW M / ef_construction / ef_search trade-off, recall/latency/memory 측정 |
| 11 | ES MoreLikeThis vs Dense Vector + morelike-com/offer 운영 | [11-mlt-vs-dense-vector.md](11-mlt-vs-dense-vector.md) | TF-IDF 한계, dense vector 우월 시나리오, morelike-com/offer 의 src 공유 + DAG 분리 패턴 |

### Phase 6: 딥러닝 추천 (5개) — **핵심 페이즈 16h, 논문 + Toy Training**

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 12 | Paper 1: Wide & Deep (Google 2016) | [12-paper-wide-and-deep.md](12-paper-wide-and-deep.md) | linear (memorization) + DNN (generalization) joint training, feature cross transformation |
| 13 | Paper 2: YouTube Deep Recsys → Two-Tower (2016/2019) | [13-paper-two-tower.md](13-paper-two-tower.md) | candidate generation vs ranking 분리, weighted logistic regression, dot product retrieval |
| 14 | Paper 3: DLRM (Meta 2019) | [14-paper-dlrm.md](14-paper-dlrm.md) | sparse + dense feature, pairwise dot product interaction, model/data parallelism |
| 15 | Paper 4: TabTransformer (Amazon 2020) | [15-paper-tab-transformer.md](15-paper-tab-transformer.md) | categorical embedding + multi-head self-attention, contextual embedding |
| 16 | Toy Training (MovieLens-1M + Jupyter notebook) | [16-toy-training-movielens.md](16-toy-training-movielens.md) | Two-Tower / Wide&Deep 직접 구현, FAISS 색인 + latency 측정, vt-deep 14종 정체 확인 |

### Phase 7: Cold-start + 메타 (1개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 17 | Cold-start 3축 + 메타/스코어 보정 | [17-cold-start-meta.md](17-cold-start-meta.md) | 신규 유저/상품/도시 fallback, IPW (Inverse Propensity Weighting, 역경향성 가중치), mr/c2dp/union-stay-score 패턴 |

### Phase 8: 인프라 비교 (1개, 압축)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 18 | OTA 스택 (Spark + BigQuery + Airflow) vs MSA 스택 (Kafka Streams + ClickHouse) | [18-infra-ota-vs-msa.md](18-infra-ota-vs-msa.md) | 비교 표 + 추천 데이터 파이프라인 ADR 후보 정리, Feature Store (Feast) 고려 |

### Phase 9: A/B 테스트 + 메트릭 (1개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 19 | 추천 평가 — Offline/Online metrics + MAB | [19-evaluation-ab-mab.md](19-evaluation-ab-mab.md) | Recall@K / NDCG / MAP, CTR/CVR/GMV/diversity/novelty, 표본 크기, MAB (epsilon-greedy/UCB/Thompson) — #19 §42-44 cross-ref |

### Phase 10: MSA 구현 (6개) — **실전 구현 24h**

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 20 | ADR 3건 작성 | [20-msa-adr-three.md](20-msa-adr-three.md) | (1) 추천 서비스 도입 단계 (2) 데이터 파이프라인 (3) ANN 인덱스 선택 |
| 21 | recommendation 서비스 스캐폴딩 | [21-msa-scaffolding.md](21-msa-scaffolding.md) | nested submodule (domain/app), Clean Architecture, Kafka topic, DB schema |
| 22 | Phase 1 구현: 룰 기반 Category Best | [22-msa-rule-based-cb.md](22-msa-rule-based-cb.md) | ClickHouse SQL 행동 가중합, Redis Top-N 캐시, API + Kotest 통합 테스트 |
| 23 | Phase 2 구현: CF Spark PoC | [23-msa-cf-spark-poc.md](23-msa-cf-spark-poc.md) | Spark 잡 — 공출현 행렬 + cosine similarity, batch 모듈 분리, `item_similarity` 테이블 |
| 24 | Phase 3 구현: Two-Tower ANN 서빙 | [24-msa-two-tower-ann.md](24-msa-two-tower-ann.md) | ONNX/TF SavedModel export, FAISS 색인, user embedding inference, personalized API |
| 25 | (선택) Gateway 라우팅 + experiment A/B | [25-msa-gateway-experiment.md](25-msa-gateway-experiment.md) | gateway route 추가, experiment 서비스로 CB/CF/Two-Tower A/B, analytics 메트릭 발행 |

### 부록 (2개)

| # | 소주제 | 파일 | 핵심 |
|---|---|---|---|
| 26 | 면접 카드 + 꼬리질문 | [26-interview-qa.md](26-interview-qa.md) | 기본 5개 + 꼬리 트리 + 함정 질문 + 시스템 설계 연결 |
| 27 | 학습 → 개선 후보 + ADR 초안 | [27-improvements-adr-candidates.md](27-improvements-adr-candidates.md) | Phase 10 산출 ADR 3건 + 추가 발견 후보 |

---

## 학습 순서 권장

**X (Top-down) 가 아니라 Bottom-up 순차 진행**:

```
Phase 1 (CF 기초)         ──┐
   │  유사도 메트릭이 모든  │
   │  CF 의 토대            │
   ▼                        │
Phase 2 (베스트 랭킹)        │  알고리즘 기초
   │  Wilson/Bayesian       │  ~12h
   ▼                        │
Phase 3-4 (Geo + 시즌)     ──┘
   │
   ▼
Phase 5 (NLP 임베딩)      ──┐
   │  ANN 이 Phase 6 의     │  임베딩
   │  Two-Tower 서빙 기반   │  ~4h
   ▼                        │
Phase 6 (딥러닝 + Toy) ────┐ │  딥러닝
   │  논문 4편 + MovieLens │ │  ~16h (핵심)
   │  Toy training         │ │
   ▼                        │
Phase 7 (Cold-start)       │
   │  딥러닝의 한계 인지    │
   ▼                        │
Phase 8-9 (인프라 + A/B)  ──┘
   │  구현 들어가기 전 정리
   ▼
Phase 10 (msa 구현) ───────  실전 ~24h
   │  ADR → 스캐폴딩 → CB → CF → Two-Tower
   │
   ▼
부록 (면접 + ADR 후보)  ──── 마무리
```

---

## 사용자 강점/약점 매핑

| Phase | 사용자 강점 | 사용자 약점 | 학습 깊이 |
|-------|----------|----------|---------|
| 1 | OTA 명명규칙 (vt/st/bt/ct) | **유사도 메트릭 수식 (Jaccard/Cosine/PMI)** | **deep** (02) / 압축 (04) |
| 2 | 행동 가중합 패턴 (`×100/×20/×10/×1`) | **Wilson score / Bayesian smoothing** | 압축 (05) / **deep** (06) |
| 3 | — | Geohash/S2/H3 차이 | medium |
| 4 | sba/th 운영 | MAB 진화 가능성 | medium |
| 5 | morelike-com/offer 운영 | **ANN 파라미터 (HNSW M/ef)** | medium (09/11) / **deep** (10) |
| 6 | vt-deep 운영 | **딥러닝 모델 구조 (Wide&Deep/Two-Tower/DLRM/Tab-Transformer)** | **deep** (12~16, 16h) |
| 7 | — | IPW / position bias | medium |
| 8 | **Spark/BigQuery/Airflow 운영** | — | **압축** (1개 파일) |
| 9 | — | Recall@K / NDCG, A/B 표본 크기 | medium |
| 10 | msa 아키텍처 | 추천 서비스 통합 | **deep** (24h 실전 구현) |

---

## Cross-cutting (다른 study 주제와 연결)

| 시나리오 | 관련 주제 |
|---|---|
| ANN 인덱스 (HNSW) deep-dive | **#19 §08** (vector-semantic-search) ↔ #20 §10 |
| MAB (epsilon-greedy / Thompson) | **#19 §42-44** ↔ #20 §08, §19 |
| Spark 잡 + 멱등성 | #6 Kafka §멱등성 + #20 §23 (CF Spark PoC) |
| Kotest BehaviorSpec + MockK | docs/standards/test-rules.md + #20 §22-24 |
| `@Transactional` + 외부 IO | #5 §외부 IO 분리 + #20 §22 (Redis 캐시 갱신) |
| ClickHouse OLAP | analytics 서비스 + #20 §22-23 |
| ADR 작성 표준 | docs/adr/ + #20 §20 |
| Kafka topic 컨벤션 | docs/architecture/kafka-convention.md + #20 §21 |

---

## 진입 권장

**다음 단계**: `/study:start 20 01-recommendation-overview` — Phase 1 첫 파일부터 본격 심화 학습.

또는 한꺼번에 Phase 1 (01~04) 을 묶어서 학습하려면 `/study:start 20 phase-1` 같은 그룹 지정 가능.

학습 중 막히는 부분은 즉석 질문으로 해결하고, 각 deep file 끝에 **꼬리질문 3-5개** 자동 생성하여 §26 면접 카드로 모이게 한다.
