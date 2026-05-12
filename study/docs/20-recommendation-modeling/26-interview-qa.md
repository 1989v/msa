---
parent: 20-recommendation-modeling
seq: 26
title: 면접 카드 + 꼬리질문 트리 — 추천 시스템 백엔드 시니어 면접 대비
type: deep
created: 2026-05-12
---

# 26. 면접 카드 + 꼬리질문 트리

> **부록 1**. §01-25 의 꼬리질문을 면접 카드로 통합. 기본 질문 → 꼬리 트리 → 함정 → 시스템 설계 연결.

---

## 1. 면접관 시각 — 추천 시스템에서 무엇을 묻는가

백엔드 시니어 / MLE 면접에서 추천 시스템 질문 패턴:

1. **개론** (5-10분): "추천 시스템이 검색과 어떻게 다른가요?"
2. **알고리즘 깊이** (15-20분): CF / MF / 딥러닝 / ANN
3. **시스템 설계** (20-30분): 대규모 추천 시스템 설계
4. **운영 경험** (10-15분): A/B, cold-start, drift

---

## 2. 기본 질문 5개 + 꼬리 트리

### Q1. 추천 시스템의 핵심 알고리즘 종류를 설명해 주세요.

**핵심 답변**:
- Content-based: 아이템 속성 기반 (텍스트/이미지 임베딩 → cosine)
- Collaborative Filtering: 사용자 행동 기반 (공출현 유사도)
- Hybrid: 둘의 결합 — 산업 표준
- Deep Learning: Wide & Deep / Two-Tower / DLRM — 현대 표준

**Q1-1**: "CF 안에서도 User-User 와 Item-Item 차이는?"
- User-User: 비슷한 사용자 찾기, cold-start 사용자 약함
- Item-Item (산업 표준): 비슷한 아이템 찾기, 사용자 수 > 아이템 수 → 계산 효율, item similarity 시간적으로 안정

**Q1-1-1**: "Item-Item CF 의 유사도 메트릭은 어떻게 선택하나?"
- Binary implicit (vt): PMI/PPMI 권장 (popular item bias 회피)
- Binary 단순: Jaccard
- Count/weighted: Cosine (단 popular bias 주의)
- Rating: Pearson (user bias mean-centering)
- → §02 §8 의 의사결정 트리

**Q1-2**: "Hybrid 의 결합 방식은?"
- Weighted: `α × content + β × cf`
- Switching: cold-start 는 content, active 는 CF
- Cascade: content 로 후보 → CF 로 재정렬
- Feature combination (산업 표준): DLRM/Two-Tower 가 둘 다 input

---

### Q2. Matrix Factorization 이 추천에 어떻게 적용되나?

**핵심 답변**:
- 사용자×아이템 matrix R 을 R ≈ U × V^T 로 분해
- U: user latent vector (k 차원), V: item latent vector
- score(u, i) = u · v_i
- O(N²) similarity → O(N×k) 메모리
- Netflix Prize 시대 (2006-2009) 의 핵심 기술

**Q2-1**: "SVD 를 그대로 추천에 못 쓰는 이유는?"
- Missing value 처리 불가 — rating matrix 99% missing
- Missing 을 0 으로 채우면 popular item bias
- 계산 비용 O(min(m²n, mn²))
- → FunkSVD (SGD) 또는 ALS (Spark) 가 observed entries 만 학습

**Q2-2**: "Implicit ALS (Hu, Koren, Volinsky 2008) 의 두 핵심 통찰?"
1. Confidence 도입 — `p_ui` (binary preference) + `c_ui = 1 + α×r_ui` (confidence)
2. 모든 (u, i) 쌍을 학습 데이터로 — 비관측은 낮은 confidence
- 산업 implicit feedback CF 의 표준

**Q2-3**: "MF 와 Two-Tower 의 관계는?"
- Two-Tower = deep MF
- MF: `score = user_vec · item_vec` (embedding lookup)
- Two-Tower: `score = user_tower(features) · item_tower(features)`
- 신경망 출력으로 lookup 교체 → side feature, non-linear, context 활용

---

### Q3. 대규모 추천 시스템에서 latency 문제를 어떻게 해결하나?

**핵심 답변** — Two-Stage Retrieval:
- 수천만 candidate → 한 모델로 점수 매기면 latency 폭발
- Stage 1 (Retrieval): 가벼운 모델로 수십~수백 후보 좁히기 (~50ms, recall 중시)
- Stage 2 (Ranking): 무거운 모델로 정밀 정렬 (~30ms, precision 중시)
- Stage 3 (Boost): business rule + diversity (~10ms)

**Q3-1**: "Retrieval 단계의 표준 모델은?"
- Two-Tower — user/item embedding dot product
- ANN 인덱싱 (FAISS / HNSW) 으로 수십억 item 중 Top-K
- §13 — YouTube 2019 표준

**Q3-1-1**: "Two-Tower 와 Two-Stage Retrieval 의 차이는?" ⚠️ **함정 질문**
- Two-Tower = 모델 아키텍처 (단일 신경망)
- Two-Stage Retrieval = 시스템 파이프라인 패턴
- 차원이 다른 개념. Two-Tower 를 Stage 1 retrieval 에 자주 사용.
- §01 §4-2

**Q3-2**: "HNSW 의 핵심 파라미터는?"
- M: 노드당 연결 수 (메모리 ↔ 정확도, 영구)
- ef_construction: 빌드 너비 (빌드 시간 ↔ 품질, 영구)
- ef_search: 검색 너비 (latency ↔ recall, runtime)
- 산업 sweet spot: M=16, ef_construction=200, ef_search=100

**Q3-3**: "Ranking 단계의 표준 모델은?"
- DLRM (Meta 2019): sparse + dense + pairwise interaction
- Wide & Deep (Google 2016): memorization + generalization joint
- 둘 다 non-separable score → retrieval 불가, ranking 만

---

### Q4. 추천 시스템의 평가는 어떻게 하나?

**핵심 답변** — 평가의 어려움:
- 정답이 없는 문제 (counterfactual problem)
- 과거 모델이 노출 안 한 item 은 라벨 없음 → selection bias
- Offline metric (Recall@K, NDCG) 는 hill-climbing 보조
- **A/B 가 유일한 신뢰 평가**

**Q4-1**: "Offline 메트릭이 production 성능 보장 못 하는 이유?"
- Counterfactual: 노출 안 한 item 라벨 없음
- Position bias: 위에 노출된 item click ↑
- Long-term effect 측정 불가
- Filter bubble: 모델 출력이 학습 데이터에 영향

**Q4-2**: "A/B 테스트 sample size 계산은?"
- `n = (z_{α/2} + z_β)² × 2σ² / δ²`
- α=0.05 (유의수준), β=0.2 (power 0.8 의 보충)
- σ² = baseline metric 분산
- δ = MDE (Minimum Detectable Effect)
- 예: CTR 5% baseline + 1% 효과 → 7,500 / group

**Q4-3**: "Multiple testing 보정의 메커니즘은?"
- N개 실험 동시 → 5%×N false positive 가능
- Bonferroni: `α' = α/N` (보수적)
- FDR (Benjamini-Hochberg): false discovery rate 통제 (덜 보수적)
- 산업 표준은 FDR

**Q4-4**: "MAB (Thompson sampling) 가 A/B 보다 우월한 시나리오?"
- 세부 튜닝 (weight 조정) 같은 작은 변경
- Beta posterior sampling → 자동 exploration/exploitation
- 단점: 통계적 rigor 약함
- 큰 변경 (모델 교체) 은 여전히 A/B

---

### Q5. Cold-start 문제는 어떻게 해결하나?

**핵심 답변** — Cold-start 3축:
1. **New User**: demographics (성별/연령/지역) + onboarding bandit + content embedding
2. **New Item**: content-based embedding (Sentence-BERT) + popularity boost + Two-Tower side feature
3. **New Context** (도시/카테고리): geographic/category transfer + manual curation

**Q5-1**: "Two-Tower 가 cold-start 에 어떻게 강한가?"
- Item tower 가 side feature (content embedding, category) input
- 신상품 → text/category 만 있으면 item embedding 즉시 생성
- CF (행동 데이터 의존) 보다 우월
- Sentence-BERT 임베딩이 input feature 로

**Q5-2**: "신상품 boost 의 강도와 감쇠는?"
- `boost(item) = 1 + α × exp(-age_days / τ)`
- α = 0.5~1.0, τ = 14일 (exp(-1) decay)
- 너무 강하면 본질 가치 무시, 너무 약하면 노출 부족
- A/B 로 도메인별 튜닝

**Q5-3**: "Soft cold-start (행동 1~100) 의 보정은?"
- §06 의 Bayesian smoothing — `(k + α) / (n + α + β)`
- n 작을 때 평균에 회귀
- Wilson score lower bound 도 가능
- 적은 노출의 거짓 100% CTR 함정 회피

---

## 3. 시스템 설계 — Recommendation System Design

**질문**: "Netflix 같은 추천 시스템을 처음부터 설계해 주세요. (45분)"

**답변 구조**:

### 3-1. Requirements Clarification

- 규모: 사용자 수, 영상 수, 일일 트래픽
- Latency 목표: P99 < 100ms?
- 정확도 요구: recall vs precision 균형
- 비즈니스 KPI: watch time / retention / CTR

### 3-2. High-Level Architecture

```
사용자 요청 → Gateway → Recommendation Service
                          ↓
              ┌───────────┴────────────┐
              ↓                        ↓
     Retrieval (Two-Tower)    Ranking (DLRM)
              ↓                        ↓
         ANN (FAISS)         Top-N → User
              
Async Pipeline:
   Action Log → Kafka → ClickHouse → Spark/Python → Model Training
                                                  → ANN Reindex
```

### 3-3. Data Flow

- 행동 수집: Kafka → ClickHouse (raw events)
- Batch 학습: 일일 Spark + PyTorch
- Online serving: Redis (cache) + FAISS (ANN) + Kotlin REST API

### 3-4. Storage 결정

- ClickHouse: OLAP, raw events + score
- Redis: serving cache (Top-N per category, user embedding)
- FAISS: ANN index

### 3-5. Failure Handling

- Circuit Breaker → fallback to popularity ranking
- Multiple ANN replicas + atomic index swap
- 모델 학습 실패 → 이전 모델 유지

### 3-6. Scale Considerations

- Embedding table > GPU 메모리 → model parallelism (DLRM)
- ANN index > 단일 머신 → IVF sharding
- 사용자별 추천 cache miss → user tower 실시간 inference

### 3-7. Monitoring + A/B

- Online metrics (CTR, CVR, dwell time)
- Drift detection (PSI, KL divergence)
- experiment 서비스로 A/B 비교

---

## 4. 함정 질문 / 오해 포인트

| # | 오해 | 실제 |
|---|---|---|
| 1 | "Two-Tower = Two-Stage Retrieval" | 다른 개념. 모델 vs 시스템 패턴. §01 §4-2 |
| 2 | "Cosine similarity 가 binary CF 의 default 로 안전" | Popular item bias 직격탄. PMI/PPMI 권장. §02 §4-4 |
| 3 | "Offline metric 좋으면 production 도 좋다" | 30% 이상 격차 흔함. Counterfactual problem. §01 §6 |
| 4 | "SVD 를 추천에 직접 사용 가능" | Missing value 처리 불가. FunkSVD/ALS 사용. §03 §3 |
| 5 | "행동 가중치 `100:20:10:1` 이 모든 도메인 표준" | OTA funnel 에서 도출. 도메인마다 다름. §05 §1-3 |
| 6 | "MAB 가 A/B 완전 대체" | 큰 모델 변경은 A/B, 세부 튜닝은 MAB. §19 §5 |
| 7 | "추천 = 머신러닝" | 70%는 데이터/파이프라인/평가. 모델은 마지막. §01 §9 |

---

## 5. 깊이 있는 후속 질문 (5단계 꼬리)

### Q. "PMI 가 cosine 보다 안전한 이유?"

**Level 1**: Popular item bias 자동 보정.

**Level 2**: PMI = log(P(i,j) / (P(i)P(j))). 인기 아이템 쌍은 그냥 같이 나올 가능성이 높으므로 P(i,j) 가 P(i)P(j) 에 가까워짐 → PMI ≈ 0.

**Level 3**: cosine 은 vector 의 1의 수가 많으면 (인기 아이템) 자동으로 높아짐. 단위 벡터 norm 으로 보정해도 popular pair 끼리 자주 같이 1.

**Level 4**: PMI 의 이론적 토대 — Levy & Goldberg 2014 가 word2vec 의 skip-gram with negative sampling 의 목적함수가 PMI 행렬 분해와 동등함을 증명. 즉 dense embedding 도 결국 PMI 분해.

**Level 5**: PMI 의 한계 — sparse data 에서 변동성 큼. PPMI (positive PMI) 로 음수 자르고, Bayesian smoothing 또는 최소 노출 필터 결합이 산업 표준.

---

### Q. "Two-Tower 의 dot product 가 다른 score 함수 (예: f(u, v) neural network) 보다 우월한 이유?"

**Level 1**: ANN 가능.

**Level 2**: dot product 는 separable — u 와 v 를 독립 계산. f(u, v) 는 non-separable — 모든 pair 에 inference 필요.

**Level 3**: 수십억 item 중 Top-K 검색 시 — Two-Tower 는 item embedding 사전 계산 + ANN 으로 ms 단위. f(u, v) 는 inference 수십억 번 = 불가.

**Level 4**: 약점 — dot product 의 표현력 제한. f(u, v) 의 universal approximator 보다 약함. 그래서 ranking 단계 (DLRM, Wide & Deep) 는 f(u, v) 사용.

**Level 5**: 산업 표준 — Two-Tower retrieval (수십억 → 수백) + DLRM ranking (수백 → 수십). 두 모델 결합이 표현력 + scalability 둘 다.

---

## 6. 면접 카드 — 영어 용어 정리

| 한글 | 영문 | 약어 |
|---|---|---|
| 협업 필터링 | Collaborative Filtering | CF |
| 행렬 분해 | Matrix Factorization | MF |
| 교대 최소제곱 | Alternating Least Squares | ALS |
| 클릭률 | Click-Through Rate | CTR |
| 전환률 | Conversion Rate | CVR |
| 총 거래액 | Gross Merchandise Volume | GMV |
| 정규화 할인 누적 이득 | Normalized Discounted Cumulative Gain | NDCG |
| 점별 상호정보량 | Pointwise Mutual Information | PMI |
| 근사 최근접 이웃 | Approximate Nearest Neighbor | ANN |
| 계층적 탐색 가능 소세계 | Hierarchical Navigable Small World | HNSW |
| 다중 슬롯머신 | Multi-Armed Bandit | MAB |
| 역경향성 가중치 | Inverse Propensity Weighting | IPW |
| 최소 측정 가능 효과 | Minimum Detectable Effect | MDE |
| 추천 모델 (Meta) | Deep Learning Recommendation Model | DLRM |
| 관심 지점 | Point of Interest | POI |
| 시스템 기록 원본 | System of Record | SoR |

---

## 7. 자가평가 기준

면접 준비도 자가평가:

| 영역 | 기준 |
|---|---|
| **개론** | Funnel + Two-Stage vs Two-Tower 구분 명확히 설명 가능 |
| **CF** | Item-Item vs User-Item, 5종 메트릭 (Jaccard/Cosine/PMI/Lift/Pearson) 선택 기준 설명 |
| **MF** | SVD vs FunkSVD vs ALS vs Implicit ALS 차이 + Hu et al. 두 통찰 |
| **딥러닝** | Wide & Deep / Two-Tower / DLRM / TabTransformer 각 모델의 풀려는 문제 |
| **ANN** | HNSW 의 M/ef_construction/ef_search 의미 + 산업 sweet spot |
| **평가** | Counterfactual problem + Offline vs Online + Sample size 계산 |
| **Cold-start** | 3축 + 각각의 fallback 전략 |
| **운영** | Position bias / IPW / Drift detection / A/B vs MAB |
| **시스템 설계** | 처음부터 추천 시스템 설계 가능 (45분 면접) |

각 영역 **5단계 꼬리 질문** 까지 답변 가능 → 시니어 수준.

---

## 8. 추천 학습 자료

- **Recommender Systems Handbook (2nd ed., Springer 2015)** — Ricci et al., CF 표준 교과서
- **Wide & Deep Learning for Recommender Systems** — Cheng et al., DLRS 2016
- **Deep Neural Networks for YouTube Recommendations** — Covington et al., RecSys 2016
- **DLRM** — Naumov et al., 2019
- **TabTransformer** — Huang et al., 2020
- **Sentence-BERT** — Reimers & Gurevych, EMNLP 2019
- **Levy & Goldberg 2014** — Neural Word Embedding as Implicit Matrix Factorization
- **Hu, Koren, Volinsky 2008** — Collaborative Filtering for Implicit Feedback Datasets

---

## 9. cross-ref (역참조)

| 면접 질문 영역 | 학습 노트 |
|---|---|
| 개론 / Funnel | §01 |
| CF 메트릭 | §02 |
| MF / ALS | §03 |
| 명명규칙 / 패밀리 | §04 |
| 행동 가중합 / KPI | §05 |
| Wilson / Bayesian | §06 |
| Geo-aware | §07 |
| 시즌 / MAB | §08 |
| Sentence-BERT | §09 |
| ANN deep | §10 |
| MLT vs Dense | §11 |
| Wide & Deep | §12 |
| Two-Tower | §13 |
| DLRM | §14 |
| TabTransformer | §15 |
| Toy training | §16 |
| Cold-start | §17 |
| 인프라 | §18 |
| 평가 / A/B / MAB | §19 |
| msa ADR | §20 |
| msa 구현 | §21-25 |
