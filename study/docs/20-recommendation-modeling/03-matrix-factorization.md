---
parent: 20-recommendation-modeling
seq: 03
title: Matrix Factorization — SVD · FunkSVD · ALS · Implicit ALS, Netflix Prize 의 유산
type: deep
created: 2026-05-12
---

# 03. Matrix Factorization (행렬 분해)

> **§02 의 다음 단계**. §02 의 유사도 메트릭이 "아이템 i 와 j 가 얼마나 비슷한가" 를 풀었다면, MF (Matrix Factorization, 행렬 분해) 는 "사용자 u 가 아이템 i 를 얼마나 좋아할까" 를 **잠재 차원에서** 푼다. Two-Tower 의 직접적 조상.

---

## 1. 왜 행렬 분해가 CF 의 다음 단계인가

§02 의 유사도 메트릭 기반 CF 는 한계가 있다:

```
한계 1: O(N²) 아이템 쌍 — 1,000만 아이템이면 50조 쌍. 정밀 계산 불가능
한계 2: similarity 가 transitive 하지 않음 — sim(A,B) 와 sim(B,C) 가 높아도 sim(A,C) 는 모름
한계 3: 새 아이템 cold-start — co-occurrence 데이터 없으면 점수 못 매김
한계 4: implicit feedback 의 "안 봤다 = ?" — 0 의 의미가 모호 (몰랐던 건지 싫은 건지)
```

**MF 의 해결**: 각 사용자와 아이템을 **저차원 latent vector** 로 표현. 점수는 두 vector 의 dot product.

```
score(user_u, item_i) = user_vec_u · item_vec_i

user_vec_u  ∈ R^k  (k = 10~200 정도, latent factor 수)
item_vec_i  ∈ R^k
```

장점:
- ✅ O(N²) → O(N×k) 메모리. 100만 아이템 × 100 차원 = 1억 floats = 400MB
- ✅ Two-Tower retrieval 의 직접 토대 — Phase 6 §13 의 deep-dive 모델이 MF 의 신경망 확장
- ✅ 임의의 (user, item) 쌍 score 계산 가능 — co-occurrence 데이터 없어도
- ✅ latent vector 가 **잠재 의미 차원** 을 학습 — "SF 영화 vs 로맨스 영화" 같은 축이 자동으로 emergent

이게 Netflix Prize (2006-2009) 가 CF 를 한 단계 발전시킨 핵심 통찰이다.

---

## 2. Latent Factor Model — 직관

영화 추천을 예로:

```
상상해보자: 영화는 [SF, 액션, 로맨스, 가족, 코미디] 5차원 점수로 묘사 가능
사용자도 같은 5차원에서 선호도로 묘사 가능

영화 "인셉션":  [0.9, 0.7, 0.1, 0.0, 0.0]  (SF + 액션 강)
영화 "노트북":  [0.0, 0.0, 0.9, 0.3, 0.1]  (로맨스 강)

사용자 A:      [0.8, 0.6, 0.0, 0.0, 0.2]  (SF/액션 좋아함)
사용자 B:      [0.1, 0.0, 0.9, 0.4, 0.3]  (로맨스 좋아함)

score(A, 인셉션) = 0.8×0.9 + 0.6×0.7 + 0.0×0.1 + 0×0 + 0.2×0 = 1.14  → 좋아함
score(A, 노트북) = 0.8×0 + 0.6×0 + 0×0.9 + 0×0.3 + 0.2×0.1 = 0.02   → 안 좋아함
score(B, 노트북) = 0.1×0 + 0×0 + 0.9×0.9 + 0.4×0.3 + 0.3×0.1 = 0.96  → 좋아함
```

**문제**: 누가 이 5차원을 "SF/액션/로맨스/가족/코미디" 라고 라벨링하나? 산업에서 이걸 수동으로 못 한다.

**MF 의 마법**: rating 데이터만 주면 **차원의 의미를 자동으로 emergent** 시킨다. k=10 차원이면 알고리즘이 알아서 10가지 잠재 축을 찾아낸다 (사람이 해석 안 되는 축일 수도 있음).

### 2-1. 수식으로 정리

```
관측: rating matrix R ∈ R^(n_users × n_items)   (대부분 missing)

분해: R ≈ U × V^T
      U ∈ R^(n_users × k)   (user latent matrix)
      V ∈ R^(n_items × k)   (item latent matrix)
      k << min(n_users, n_items)

추정값: r̂(u, i) = U_u · V_i^T = Σ_f U_uf × V_if
```

**핵심**: rating matrix 는 sparse 하지만 (대부분 missing), latent matrix U, V 는 dense 하다. 즉 **빠진 부분도 채울 수 있다** — 이게 추천의 직접 메커니즘.

---

## 3. SVD — Singular Value Decomposition (수학적 기초)

### 3-1. 정의

SVD (특이값 분해) 는 임의의 행렬 R 을 다음과 같이 분해:

```
R = U × Σ × V^T

U ∈ R^(m × m)  (orthogonal, left singular vectors)
Σ ∈ R^(m × n)  (diagonal, singular values σ₁ ≥ σ₂ ≥ ... ≥ 0)
V ∈ R^(n × n)  (orthogonal, right singular vectors)
```

**Truncated SVD** (low-rank approximation):
```
R ≈ U_k × Σ_k × V_k^T
   = (U_k √Σ_k) × (√Σ_k V_k^T)
   = U' × V'^T

U' ∈ R^(m × k), V' ∈ R^(k × n)
```

직관: 가장 큰 k 개의 singular value 만 유지 → R 의 가장 중요한 k 개 잠재 차원만 보존.

### 3-2. 왜 추천에 직접 못 쓰나

**문제 1: Missing value**. 표준 SVD 는 **완전한 행렬** 을 요구한다. rating matrix 는 99% 가 missing 인데, missing 을 0 으로 채우면:
- "사용자가 0점 줬다" 와 "안 봤다 (모름)" 가 구별 안 됨
- popular item bias 자동 발생 (안 본 사람들이 0 으로 채워져서)

**문제 2: 계산 비용**. SVD 의 시간 복잡도는 O(min(m²n, mn²)) — 100만×100만 행렬에서는 사실상 불가능.

**문제 3: 해석 가능성**. SVD 는 미적분학적 분해라 의미 있는 latent factor 가 안 나옴 — 수학적으로 최적이지만 추천 신호로는 약함.

→ 그래서 산업에서는 **SVD 의 정신만 가져오고 다른 알고리즘** 을 쓴다. 다음 절의 FunkSVD 와 ALS.

---

## 4. FunkSVD — Netflix Prize 의 실용적 변형 (2006)

Simon Funk 가 Netflix Prize 중간 (2006) 에 발표한 알고리즘. SVD 의 이름을 빌렸지만 실제로는 **gradient descent 로 푸는 stochastic matrix factorization**.

### 4-1. 목적 함수

```
minimize  Σ_(u,i) ∈ observed  (r_ui - p_u · q_i)² + λ(||p_u||² + ||q_i||²)
   p, q

p_u: user latent vector ∈ R^k
q_i: item latent vector ∈ R^k
r_ui: 관측된 rating
λ: regularization 강도
```

**핵심 차이 (vs SVD)**:
- ✅ **observed entries 만 사용** — missing 은 학습 데이터에 안 들어감
- ✅ Gradient descent 로 점진 학습 — 메모리 효율
- ✅ Regularization 으로 overfit 방지

### 4-2. Gradient Descent 업데이트 (SGD — Stochastic Gradient Descent)

```python
for each (user u, item i, rating r) in shuffle(observed):
    error = r - p_u.dot(q_i)
    p_u += lr * (error * q_i - λ * p_u)
    q_i += lr * (error * p_u - λ * q_i)
```

매 (u, i, r) 마다 두 vector 만 업데이트 → 단순하고 빠름.

### 4-3. Bias Term 추가 (Koren 2009)

순수 dot product 만으로는 부족. **bias** 추가:

```
r̂(u, i) = μ + b_u + b_i + p_u · q_i

μ:   전체 평균 (global)
b_u: user bias (이 사용자가 후하게/까다롭게 점수 주는 편향)
b_i: item bias (이 아이템이 일반적으로 좋게/나쁘게 평가되는 편향)
p_u · q_i: 진짜 interaction
```

이게 **Koren 의 SVD++** 의 토대. Netflix Prize 우승 솔루션의 핵심.

> **§02 §7 의 Pearson correlation** 이 user bias 를 빼는 것과 같은 정신이지만, MF 는 그것을 학습 가능한 파라미터로 만든 게 차이.

---

## 5. ALS — Alternating Least Squares (대규모 분산 학습용)

SGD 는 sequential 이라 분산 학습이 어렵다. Spark 같은 대규모 분산 환경에서는 **ALS (교대 최소제곱)** 가 표준.

### 5-1. 아이디어

p (user latent) 와 q (item latent) 를 **번갈아 가면서 한 쪽씩 고정** 하고 다른 쪽을 closed-form 으로 푼다:

```
Step 1: q 를 고정. p_u 에 대한 최적화는 선형회귀.
        p_u = (Q^T Q + λI)^(-1) Q^T r_u
        (Q 는 user u 가 본 아이템들의 latent matrix)

Step 2: p 를 고정. q_i 에 대한 최적화는 또 선형회귀.
        q_i = (P^T P + λI)^(-1) P^T r_i

Step 1 ↔ Step 2 반복 (보통 10~20 iteration)
```

### 5-2. 왜 분산 학습에 적합한가

- ✅ **각 user 의 p_u 계산이 독립** → Spark 의 map 으로 parallel
- ✅ **각 item 의 q_i 계산이 독립** → 동일
- ✅ Closed-form 이라 hyperparameter (lr) 없음 — 안정적
- ✅ Iteration 횟수 적음 (10~20) → SGD 의 수백 epoch 보다 빠를 수 있음

**Spark MLlib 의 `ALS` 가 정확히 이걸 구현**. 산업에서 가장 흔히 쓰는 MF 구현.

### 5-3. SGD vs ALS — 선택 기준

| | SGD (FunkSVD) | ALS |
|---|---|---|
| 적합 환경 | 단일 머신, 작은 데이터 | 분산 (Spark), 대규모 |
| 수렴 | 느림 (수백 epoch) | 빠름 (10~20 iter) |
| Hyperparameter | lr 튜닝 필요 | iter 수만 |
| Implicit feedback | 어색함 (negative sampling 필요) | **자연스러움** (§6 deep-dive) |
| 메모리 | 적게 — 점진 학습 | 많이 — 매 iter 모든 데이터 |

산업 표준:
- **소규모 / 빠른 prototyping**: FunkSVD (SGD)
- **대규모 / production**: ALS (Spark MLlib)

---

## 6. Implicit ALS — Implicit Feedback 의 표준 (Hu, Koren, Volinsky 2008)

추천 시스템에서 가장 자주 인용되는 논문 (Hu, Koren, Volinsky 2008 — "Collaborative Filtering for Implicit Feedback Datasets"). **implicit feedback CF 의 산업 표준** 이 됨.

### 6-1. 문제 — Explicit MF 를 Implicit 에 그대로 쓰면

```
rating matrix → click matrix 로 변환
  관측: r_ui = 1 (클릭함)
  비관측: r_ui = ? (안 클릭했는데, 안 봤는지 싫은 건지 모름)

FunkSVD 를 그대로 쓰면? "안 본 것" 을 학습 데이터에서 제외해버림
   → 모든 데이터가 positive only
   → 모델이 "모두에게 모든 것을 추천" 으로 수렴 (trivial solution)
```

### 6-2. Hu et al. 의 두 가지 핵심 통찰

#### 통찰 1: Confidence 도입

binary 클릭을 두 부분으로 나눔:
```
p_ui = 1 if r_ui > 0 else 0   (선호 여부 — binary)
c_ui = 1 + α × r_ui            (confidence — count 가 많을수록 신뢰)

α: hyperparameter (보통 40)
```

p 는 binary preference, c 는 confidence weight.

#### 통찰 2: 모든 entry 를 학습 데이터로

기존: observed entries 만 → trivial solution
Hu et al.: **모든 (u, i) 쌍을 학습 데이터로 사용**. 그러나 confidence 가 다름.
- 클릭한 쌍 → high confidence (c_ui = 41)
- 안 클릭한 쌍 → low confidence (c_ui = 1)

### 6-3. 목적 함수

```
minimize  Σ_(u,i)  c_ui × (p_ui - x_u · y_i)² + λ(||x_u||² + ||y_i||²)
   x, y

(u, i) 는 모든 user × item 조합 (관측 + 미관측)
```

비관측 쌍도 학습에 포함되지만 confidence 가 낮아서 영향이 적음. 이게 implicit feedback 의 미묘한 의미를 잘 잡아낸다.

### 6-4. 효율적 계산 트릭

모든 user × item 쌍을 학습 데이터로 쓰면 100만 × 100만 = 1조 쌍 → 계산 불가능.

**Hu et al. 의 트릭**: ALS 의 closed-form 업데이트를 행렬 분해해서, 클릭한 쌍에 대해서만 sparse 연산. 클릭 안 한 쌍은 행렬 곱으로 한꺼번에 처리. 결과적으로 **O(클릭 수)** 시간 복잡도.

Spark MLlib ALS 의 `implicitPrefs=true` 옵션이 정확히 이것을 구현한다.

---

## 7. Bias / Regularization — 산업 실전

### 7-1. Full Model (Koren 2009)

```
r̂(u, i) = μ + b_u + b_i + p_u · q_i

목적 함수:
   minimize Σ (r_ui - r̂_ui)² 
            + λ × (b_u² + b_i² + ||p_u||² + ||q_i||²)
```

**왜 bias 가 중요한가**:
- popular item 의 평균 평점이 높은 것은 모델이 알아야 함 → b_i 가 학습
- 후하게 평가하는 사용자의 평점 분포 보정 → b_u 가 학습
- p_u · q_i 가 정말로 "인터랙션" 의미만 잡도록 — 다른 효과는 bias 가 흡수

### 7-2. Regularization 강도 λ

| λ 작음 (0.01) | λ 큼 (0.1) |
|---|---|
| Overfit 위험 | Underfit 위험 |
| Train error 작음 | 평균에 가까운 예측 |
| Latent vector 크기 큼 | Latent vector 크기 작음 (regularized) |

**튜닝 전략**: 5-fold cross validation 으로 RMSE (Root Mean Square Error) 최소화. 보통 0.01 ~ 0.1.

### 7-3. Latent Dimension k 선택

| k 작음 (10) | k 큼 (200) |
|---|---|
| Underfit | Overfit |
| 학습 빠름 | 학습 느림 |
| 메모리 적음 | 메모리 많이 |
| Coarse signal | Fine signal |

**튜닝 전략**: 데이터 규모에 따라.
- 1만 사용자: k = 10~30
- 100만 사용자: k = 50~100
- 1억 사용자: k = 100~200

너무 크면 sparse 데이터 영역에서 overfit. 너무 작으면 신호 손실.

---

## 8. Spark MLlib ALS — 코드 예제

산업에서 가장 흔히 쓰는 MF 구현.

### 8-1. Explicit ALS (rating)

```scala
import org.apache.spark.ml.recommendation.ALS

val als = new ALS()
  .setRank(50)             // latent dimension k
  .setMaxIter(15)
  .setRegParam(0.1)        // λ
  .setUserCol("user_id")
  .setItemCol("item_id")
  .setRatingCol("rating")
  .setColdStartStrategy("drop")  // 새 user/item 은 prediction 제외

val model = als.fit(trainingDF)

// 사용자별 Top-10 추천
val userRecs = model.recommendForAllUsers(10)
```

### 8-2. Implicit ALS (click)

```scala
val als = new ALS()
  .setRank(50)
  .setMaxIter(15)
  .setRegParam(0.1)
  .setAlpha(40)            // Hu et al. 의 α
  .setImplicitPrefs(true)  // ★ implicit mode
  .setUserCol("user_id")
  .setItemCol("item_id")
  .setRatingCol("click_count")  // confidence 의 base

val model = als.fit(implicitDF)
```

### 8-3. Item Embedding 추출 → ANN 색인

```scala
// item latent vectors 추출
val itemFactors = model.itemFactors  // (id, features) DataFrame

// 외부 ANN 색인 (FAISS / HNSW) 으로 export
val itemEmbeddings: Array[(Int, Array[Float])] = itemFactors
  .map(row => (row.getInt(0), row.getSeq[Float](1).toArray))
  .collect()

// FAISS 색인 (Python 측에서)
// faiss.IndexFlatIP(dim).add(item_embeddings)
```

이게 **MF → ANN 서빙** 의 표준 파이프라인. Two-Tower (Phase 6 §13) 와 동일한 패턴.

### 8-4. 산업 활용 패턴

```
1. Spark 잡 매일/매주 실행
2. 사용자 행동 로그 → user-item interaction matrix
3. ALS 학습 → user/item latent vectors
4. item vectors → ANN 인덱스 (FAISS/HNSW) 로 export
5. user vector → 실시간 inference (사용자 ID 로 lookup)
6. ANN 검색 → 후보 Top-100
7. (선택) ranking 모델로 재정렬 → Top-10
```

Phase 10 §23 의 msa CF Spark PoC 가 정확히 이 패턴.

---

## 9. Matrix Factorization → Two-Tower 진화

### 9-1. MF 의 한계

- ❌ Feature 활용 불가 — user/item 의 demographics, category 같은 side feature 못 씀
- ❌ Cold-start 약함 — 새 user/item 의 latent vector 학습 필요
- ❌ Non-linear interaction 못 표현 — dot product 만으로는 표현력 한계
- ❌ Context 무시 — 시간/위치/디바이스 같은 컨텍스트 못 씀

### 9-2. Two-Tower 가 푼 것

```
MF:        score = user_vec · item_vec
                   (user_vec = embedding lookup)
                   (item_vec = embedding lookup)

Two-Tower: score = user_tower(user_id, user_features, context) 
                   · item_tower(item_id, item_features)
```

- **side feature 활용** — demographics, category, price 등을 신경망에 입력
- **non-linear** — MLP 가 복잡한 변환 학습
- **context-aware** — 시간/위치를 user_tower 입력으로
- **cold-start 개선** — 새 user/item 도 feature 만 있으면 embedding 생성

> **이론적 관점**: Two-Tower 는 **deep matrix factorization** 이다. MF 의 user/item embedding 을 단순 lookup 에서 **신경망 출력** 으로 교체한 것. 그 외 구조 (dot product) 는 동일.

### 9-3. 진화 계보

```
2006 ─ FunkSVD (Simon Funk) ───────────────────────────────┐
2008 ─ Implicit ALS (Hu, Koren, Volinsky) ─────────────────┤
2009 ─ Koren bias + SVD++ ──────────────────────────────────┤
2013 ─ word2vec (PMI 와의 관계) ─────────────────────────────┤
2016 ─ Wide & Deep (Google) ────────────────────────────────┤  Deep Learning 시대
2016 ─ YouTube candidate generation (DNN for retrieval) ───┤  진입
2017 ─ Neural Collaborative Filtering (NCF, He et al.) ────┤
2019 ─ Two-Tower (YouTube) ────────────────────────────────┤  Two-Tower 정착
2019 ─ DLRM (Meta) ────────────────────────────────────────┘  Ranking 표준
```

MF (2006-2009) 가 **사용자/아이템 latent embedding** 이라는 패러다임을 만들고, 그 위에 deep learning 이 얹어진 진화 사슬이다.

---

## 10. 흔한 함정 7가지

| # | 함정 | 실제 |
|---|---|---|
| 1 | "SVD 를 그대로 추천에 쓴다" | Missing value 때문에 불가능. FunkSVD 또는 ALS 사용 필수. SVD 이름만 차용. |
| 2 | "Explicit ALS 를 클릭 데이터에 쓴다" | Trivial solution. Implicit ALS (`implicitPrefs=true`) 필수. |
| 3 | "Latent dimension k 는 클수록 좋다" | Overfit. Sparse 영역에서 점수 신뢰도 하락. cross validation 필수. |
| 4 | "Regularization 없이도 된다" | Overfit. λ=0.01~0.1 권장. |
| 5 | "ALS 가 SGD 보다 항상 빠르다" | 데이터 규모에 따라 다름. 단일 머신 + 작은 데이터에서는 SGD 가 빠를 수 있음. |
| 6 | "MF 의 latent factor 가 해석 가능하다" | 일반적으로 NO. PCA 같은 명시적 의미 없음. 해석 가능성이 필요하면 별도 분석. |
| 7 | "MF 만 있으면 충분" | Side feature, context, non-linear interaction 못 살림. Two-Tower / DLRM 으로 발전 필요. |

---

## 11. 꼬리 질문 (§26 면접 카드 후보)

1. **SVD 가 추천 시스템에 직접 사용되지 못하는 이유는?**
   - 답: (1) Missing value 처리 불가 — SVD 는 완전한 행렬을 요구. rating matrix 의 missing 을 0 으로 채우면 popular item bias. (2) 계산 비용 — O(min(m²n, mn²)). (3) Missing 에서 학습 신호가 없음. → FunkSVD/ALS 가 observed entries 만 학습하는 방식으로 우회.

2. **Implicit ALS (Hu et al. 2008) 의 핵심 두 가지 통찰은?**
   - 답: (1) Confidence 도입 — binary preference (p_ui) 와 confidence weight (c_ui) 분리. count 가 많을수록 신뢰. (2) 모든 (u, i) 쌍을 학습 데이터로 사용 — 비관측 쌍도 낮은 confidence 로 포함해서 trivial solution 회피. ALS 의 효율적 closed-form 계산이 이를 가능하게 함.

3. **Explicit vs Implicit MF 의 차이는?**
   - 답: Explicit — 별점 같은 numeric rating. observed entries 만 학습. Pearson/MAE/RMSE 로 평가. Implicit — 클릭/구매 같은 binary. 모든 (u,i) 쌍 confidence 차등으로 학습. NDCG/Recall@K 로 평가. 산업은 implicit 이 주류.

4. **MF 와 Two-Tower 의 관계는?**
   - 답: Two-Tower 는 **deep MF**. MF 의 user/item embedding lookup 을 신경망 출력으로 교체. dot product 구조는 동일. Two-Tower 는 side feature, non-linear, context 활용 가능 — MF 의 한계 극복.

5. **Latent dimension k 를 어떻게 정하나?**
   - 답: 데이터 규모에 따라. 1만 사용자 → k=10~30, 100만 → k=50~100, 1억 → k=100~200. 5-fold cross validation 으로 NDCG@K 또는 RMSE 최소화. 너무 크면 sparse 영역 overfit, 너무 작으면 신호 손실.

6. **Bias term 이 왜 필요한가?**
   - 답: 사용자별 평점 분포 차이 (b_u) + 아이템별 인기 차이 (b_i) + 전체 평균 (μ) 를 분리해서 학습. p_u · q_i 가 **순수한 interaction** 의미만 잡도록. §02 §7 의 Pearson 이 user bias 를 mean-centering 으로 빼는 것과 같은 정신이지만 학습 가능한 파라미터로 만든 게 진보.

7. **ALS 의 분산 학습이 SGD 보다 유리한 이유는?**
   - 답: 각 user/item 의 latent vector 업데이트가 독립 → Spark map 으로 parallel. Closed-form 이라 hyperparameter (lr) 없음. SGD 는 sequential 이라 분산 어려움. 대규모 데이터에서 ALS 가 표준.

---

## 12. cross-ref

| 주제 | 연결된 study |
|---|---|
| Pearson correlation (mean-centering) | §02 §7 (MF 의 bias term 과 동일 정신) |
| Word2vec ↔ MF 관계 | §02 §13 Q5 (PMI 행렬 분해 = word2vec) |
| Two-Tower 모델 deep-dive | Phase 6 §13 (deep matrix factorization) |
| DLRM (sparse + dense feature) | Phase 6 §14 |
| Spark CF 잡 PoC (msa 구현) | Phase 10 §23 (ALS 적용) |
| FAISS / HNSW ANN 색인 | Phase 5 §10 (MF embedding 의 ANN 서빙) |
| Wilson / Bayesian smoothing | §06 (sparse 영역 점수 보정 — MF 의 cold-start 와 cross-ref) |
| Negative sampling | Phase 6 §13 (Two-Tower 학습 시 implicit ALS 의 confidence 와 비교) |
