---
parent: 20-recommendation-modeling
seq: 02
title: CF 유사도 메트릭 deep-dive — Jaccard / Cosine / PMI / Lift / Pearson 수식과 popular item bias
type: deep
created: 2026-05-12
---

# 02. CF 유사도 메트릭 deep-dive

> **이 파일은 사용자 약점 영역**. 수식을 직관과 함께 풀어쓴다. 산업에서 가장 자주 잘못 선택하는 메트릭이 cosine 이라는 점을 미리 강조.

---

## 1. 왜 유사도 메트릭이 CF 의 핵심인가

CF (Collaborative Filtering, 협업 필터링) 의 모든 알고리즘은 결국 다음 한 줄로 환원된다:

```
recommend(user) = top_k { sim(item_i, item_j) : item_i ∈ user_history }
```

즉, **사용자가 본 아이템 i 와 비슷한 아이템 j 를 찾는 것**. 이때 `sim(i, j)` 의 정의가 CF 의 성능을 좌우한다.

같은 데이터 (user × item interaction) 라도 sim 함수가 다르면 추천 결과가 완전히 달라진다. §01 §3-2 에서 본 "popular item bias" 도 sim 함수 선택의 직접적 결과다.

### 1-1. 5종 메트릭의 한 줄 요약

| 메트릭 | 본질 | 데이터 가정 | 산업 활용 |
|---|---|---|---|
| **Jaccard** | 집합 교집합 / 합집합 | binary (봤다/안 봤다) | implicit feedback CF |
| **Cosine** | 벡터 각도 | 가중치 있는 vector | 가장 흔하게 쓰임 (그러나 함정) |
| **PMI** | 확률 기반 (P(i,j) / P(i)P(j)) | binary or count | popular item bias 보정 |
| **Lift** | PMI 의 비대수 형태 | binary | 장바구니 분석 origin |
| **Pearson** | 정규화 cosine (평균 빼기) | numeric rating (별점) | explicit rating CF |

산업에서 흔히 잘못된 선택:
- 클릭 데이터 (binary) 에 cosine 적용 → **popular item bias**
- sparse 데이터에 cosine 적용 → **데이터 부족 상품 점수 왜곡**
- implicit feedback 에 Pearson → 평균 정의 자체가 무의미

---

## 2. 데이터 모델 — Interaction Matrix

CF 의 입력은 항상 **user × item interaction matrix** 다.

```
        item_1  item_2  item_3  item_4  ...
user_A    1       0       1       0    ...
user_B    1       1       0       0    ...
user_C    0       1       1       1    ...
user_D    1       0       0       1    ...
```

행렬 원소 의미 (데이터 종류별):
- **Binary (implicit)**: 1 = 봤다 / 0 = 안 봤다
- **Count**: 본 횟수 (예: 5번 클릭)
- **Rating (explicit)**: 1~5 별점
- **Weighted**: 행동 가중합 (예: reservation×100 + click×20 + ...)

### 2-1. Item-Item CF 의 데이터 변환

Item-Item CF (산업 표준) 는 위 행렬을 **item 관점** 으로 본다:

```
item_1 의 interaction vector: [user_A=1, user_B=1, user_C=0, user_D=1]
item_2 의 interaction vector: [user_A=0, user_B=1, user_C=1, user_D=0]

sim(item_1, item_2) = ?  ← 두 vector 의 유사도
```

두 아이템을 모두 본 사용자가 많을수록 유사도가 높다는 직관. 어떻게 **"많을수록"** 을 정의하느냐가 메트릭의 차이다.

---

## 3. Jaccard 유사도 — 집합 교집합

### 3-1. 수식

```
Jaccard(A, B) = |A ∩ B| / |A ∪ B|
```

A, B 는 **아이템 i 와 j 를 본 사용자 집합**.

직관: 두 아이템을 모두 본 사용자 ÷ 둘 중 하나라도 본 사용자.

### 3-2. 예시 계산

```
item_1 을 본 사용자: {A, B, D}     → |item_1| = 3
item_2 를 본 사용자: {B, C}        → |item_2| = 2
교집합: {B}                         → |item_1 ∩ item_2| = 1
합집합: {A, B, C, D}                → |item_1 ∪ item_2| = 4

Jaccard(item_1, item_2) = 1 / 4 = 0.25
```

### 3-3. 특성

**장점**:
- ✅ 직관적 — 집합 연산만으로 정의
- ✅ binary (implicit feedback) 에 자연스러움
- ✅ 0~1 범위로 정규화됨

**한계**:
- ❌ **count / rating 못 다룸** — 별점이나 빈도 정보 무시
- ❌ **자주 함께 나타나는 인기 아이템 쌍에 편향** — popular item 이 다 1 이라 교집합이 크게 나옴
- ❌ 0 (안 봤다) 의 정보 무시 — implicit feedback 에서 0 의 의미가 항상 "안 좋아함" 은 아닌데도

### 3-4. 산업 활용

- 장바구니 분석 (Market Basket Analysis) 원조 메트릭
- 실시간 추천에서 가장 가벼움 — `redis SINTERSTORE` / Spark `intersect` 한 줄로 계산
- View Together (vt) / Buy Together (bt) 같은 동시 행동 CF 에서 흔히 사용

---

## 4. Cosine 유사도 — 벡터 각도

### 4-1. 수식

```
cosine(A, B) = (A · B) / (||A|| × ||B||)

           = Σ(A_i × B_i) / sqrt(Σ A_i²) × sqrt(Σ B_i²)
```

A, B 는 **아이템의 interaction vector** (사용자 차원, 길이 = 사용자 수).

직관: 두 벡터의 각도. 같은 방향이면 1, 직교면 0, 반대 방향이면 -1.

### 4-2. 예시 계산

```
item_1 vector: [1, 1, 0, 1]   (user A, B, C, D 가 봤는지)
item_2 vector: [0, 1, 1, 0]

내적 (A · B) = 1×0 + 1×1 + 0×1 + 1×0 = 1
||A|| = sqrt(1+1+0+1) = sqrt(3) ≈ 1.732
||B|| = sqrt(0+1+1+0) = sqrt(2) ≈ 1.414

cosine = 1 / (1.732 × 1.414) = 1 / 2.449 ≈ 0.408
```

### 4-3. 특성

**장점**:
- ✅ count / weighted 데이터 자연스럽게 다룸
- ✅ 0~1 범위 (binary 데이터의 경우)
- ✅ 수학적으로 친숙 — 모든 ML 라이브러리가 지원

**한계 — 산업에서 가장 자주 잘못 쓰는 부분**:
- ❌ **Popular item bias 가 가장 심함** — 인기 아이템 vector 가 1 을 많이 갖고 있어서 다른 인기 아이템과 cosine 이 자동으로 높아짐
- ❌ **희소 아이템 (적은 노출) 의 점수 신뢰도 낮음** — 노출 한 번이 cosine 점수 크게 흔듦
- ❌ Pearson 과 달리 **평균 차이 무시** — 모든 사용자에게 후한 점수를 주는 사람과 까다로운 사람의 차이 못 잡음 (rating 데이터에서)

### 4-4. Popular item bias 실증

가상의 시나리오:
```
item_HARRY_POTTER (인기 도서, 1000명이 봄): vector 의 대부분이 1
item_NICHE_NOVEL (희소 도서, 50명이 봄): vector 의 대부분이 0

다른 인기 도서 item_LORD_OF_RINGS (인기, 900명이 봄):
   cosine(HP, LOTR) → 매우 높음 (둘 다 1 이 많음, 교집합 크기 막대함)

다른 희소 도서 item_OBSCURE_NOVEL (희소, 30명이 봄):
   cosine(HP, OBSCURE) → 낮음 (교집합 적음)

→ 결과: 해리포터 본 사용자에게 항상 인기 도서만 추천됨
```

**왜 이게 나쁜가**: 사용자가 이미 인기 도서는 알고 있다. 추천의 가치는 **잠재 의도 발견** 인데, 인기 아이템 추천은 그 가치를 못 살린다.

### 4-5. 산업 활용

- 가장 흔히 사용되는 default 메트릭 — 모든 라이브러리 지원
- Sentence-BERT 같은 dense embedding 의 표준 메트릭
- 그러나 **binary implicit feedback CF 에는 PMI / Jaccard 가 더 안전** — cosine 은 popular item bias 의 직격탄

---

## 5. PMI — Pointwise Mutual Information (점별 상호정보량)

### 5-1. 수식

```
PMI(i, j) = log( P(i, j) / (P(i) × P(j)) )

P(i, j) = (i 와 j 를 함께 본 사용자 수) / (전체 사용자 수)
P(i)    = (i 를 본 사용자 수) / (전체 사용자 수)
P(j)    = (j 를 본 사용자 수) / (전체 사용자 수)
```

직관: **두 아이템이 함께 나타날 확률** 을 **각각 독립일 때 기대값** 으로 나눔. 1보다 크면 같이 등장하는 경향, 1보다 작으면 회피하는 경향. log 를 씌워서 대칭 (positive ↔ negative).

### 5-2. 예시 계산

```
전체 사용자: 1000명
item_1 본 사람: 200명 → P(1) = 0.2
item_2 본 사람: 100명 → P(2) = 0.1
둘 다 본 사람: 50명 → P(1,2) = 0.05

PMI(1, 2) = log(0.05 / (0.2 × 0.1))
         = log(0.05 / 0.02)
         = log(2.5)
         ≈ 0.916   (natural log)
```

비교를 위한 다른 예 (인기 아이템 쌍):
```
item_A 본 사람: 800명 → P(A) = 0.8
item_B 본 사람: 700명 → P(B) = 0.7
둘 다 본 사람: 600명 → P(A,B) = 0.6

PMI(A, B) = log(0.6 / (0.8 × 0.7))
         = log(0.6 / 0.56)
         = log(1.071)
         ≈ 0.069
```

**핵심 관찰**: item_A 와 item_B 가 함께 등장한 횟수 (600) 가 item_1, item_2 (50) 보다 12배 많지만, **PMI 는 item_1-2 가 더 높다** (0.916 > 0.069). 왜냐하면 인기 아이템은 그냥 같이 나타날 가능성이 본래 높기 때문.

→ **PMI 는 popular item bias 를 자동으로 보정한다**. 이게 PMI 의 핵심 가치.

### 5-3. PPMI (Positive PMI) — 산업 표준 변형

원래 PMI 는 음수가 나올 수 있다 (P(i,j) < P(i)P(j) 일 때). 음수 PMI 는 신뢰도가 낮은 경우가 많아서 0 으로 자르는 **PPMI (Positive PMI)** 가 산업 표준이다.

```
PPMI(i, j) = max(0, PMI(i, j))
```

### 5-4. 특성

**장점**:
- ✅ **popular item bias 자동 보정** — 확률 기반이라 빈도 정규화 내장
- ✅ NLP 의 word embedding (word2vec) 이론적 토대 — 학술적으로 견고
- ✅ 희소 아이템에도 의미 있는 점수

**한계**:
- ❌ **데이터가 적으면 점수 변동성 큼** — P(i,j) 추정이 불안정. smoothing 필요.
- ❌ 음수 PMI 의 해석 어려움 → PPMI 로 우회
- ❌ 계산 비용 cosine 보다 약간 높음 (확률 추정 추가)
- ❌ Negative interaction (싫어함) 정보를 못 활용 — explicit rating 에는 부적합

### 5-5. 산업 활용

- **implicit feedback CF 의 안전한 default** — cosine 의 popular item bias 회피
- NLP 의 word2vec, GloVe 의 이론적 기초
- 추천 시스템 학술 논문에서 baseline 으로 자주 등장

---

## 6. Lift — 마케팅 분석 Origin

### 6-1. 수식

```
Lift(i, j) = P(i, j) / (P(i) × P(j))
         = exp(PMI(i, j))
```

PMI 와 동일한 비율이지만 **log 를 씌우지 않은 형태**. 1 보다 크면 함께 등장 경향, 1 보다 작으면 회피, 1 이면 독립.

### 6-2. 예시 계산

위 §5-2 예시 사용:
```
Lift(1, 2) = 0.05 / (0.2 × 0.1) = 0.05 / 0.02 = 2.5  → 함께 등장 2.5배 강함
Lift(A, B) = 0.6 / (0.8 × 0.7) = 0.6 / 0.56 = 1.071 → 거의 독립
```

### 6-3. 특성과 활용

- 장바구니 분석 (Apriori, FP-Growth) 의 표준 메트릭 — "맥주를 산 사람이 기저귀를 살 확률이 평균 대비 몇 배인가?"
- 비즈니스 보고서에서 직관적 — "X 를 본 사람이 Y 를 볼 확률이 평소보다 2.5배 높음"
- PMI 와 동일한 정보 — log 만 다름

**산업 선택 기준**:
- 추천 알고리즘 내부 score: **PMI / PPMI** (log 가 합산 친화적)
- 비즈니스 분석/리포트: **Lift** (비율이 직관적)

---

## 7. Pearson Correlation — 평점 기반 CF

### 7-1. 수식

```
Pearson(A, B) = Σ ( (A_i - mean_A) × (B_i - mean_B) ) 
              / sqrt( Σ (A_i - mean_A)² × Σ (B_i - mean_B)² )
```

**= 평균을 뺀 후의 cosine**. 즉 mean-centered cosine.

### 7-2. 왜 평균을 빼는가 — User Bias 제거

Explicit rating (별점) 시나리오:
```
user_A 의 평균 별점: 4.5 (모든 영화에 후함)
user_B 의 평균 별점: 2.5 (까다로움)

영화 X 에 대한 평점:
   user_A: 5.0  → A 입장에서는 평균보다 약간 높음
   user_B: 3.5  → B 입장에서는 평균보다 1.0 높음 (강한 긍정)

cosine 으로 계산하면: user_A 의 5 와 user_B 의 3.5 → 다른 점수로 취급
Pearson 으로 계산하면: user_A 의 (5 - 4.5) = 0.5, user_B 의 (3.5 - 2.5) = 1.0
                     → B 가 더 강하게 좋아한다는 신호 살아남음
```

이게 Pearson 이 explicit rating CF 에서 cosine 보다 우월한 이유.

### 7-3. 특성

**장점**:
- ✅ user bias 제거 — 후한/까다로운 평가자 차이 제거
- ✅ rating 데이터에서 자연스러움

**한계**:
- ❌ **implicit feedback (binary) 에는 부적합** — 평균 정의가 무의미 ("봤다=1" 의 평균이 뭐냐)
- ❌ 평균 추정에 데이터 필요 — 평점 수 적은 사용자는 평균이 불안정
- ❌ -1 ~ +1 범위 (음수 발생) — 추천 score 로 직접 사용은 추가 처리 필요

### 7-4. 산업 활용

- Netflix Prize 시대 (2006-2009) explicit rating CF 의 표준
- 현재는 implicit feedback 이 주류라 사용 빈도 감소
- 그래도 별점 시스템 (Yelp, 책 리뷰, 게임) 에서는 여전히 1순위

---

## 8. 메트릭 선택 의사결정 트리

```
데이터 종류는?
│
├─ Binary (봤다/안 봤다, implicit feedback)
│   │
│   └─ Popular item bias 우려가 큼?
│       ├─ 예 (e-commerce, 영상 추천) → PMI / PPMI
│       └─ 아니오 (계산 단순성 우선) → Jaccard
│
├─ Count (본 횟수, 가중치)
│   │
│   └─ Sparse data 인가?
│       ├─ 예 → PMI (cosine 은 위험)
│       └─ 아니오 → cosine (편리)
│
└─ Rating (별점, explicit feedback)
    │
    └─ user bias 우려?
        ├─ 예 → Pearson Correlation
        └─ 아니오 (이미 정규화됨) → cosine
```

### 8-1. 산업 표준 default

같은 데이터에 대한 **무난한 default 선택**:
- Item-Item CF + implicit feedback → **PPMI**
- Item-Item CF + explicit rating → **Pearson**
- 빠른 baseline → **Jaccard** (집합 연산 한 줄)
- ML 라이브러리 호환 / dense embedding → **cosine**

---

## 9. Popular Item Bias 보정 기법

cosine 등 단순 메트릭이 popular item bias 를 보일 때, 데이터 자체를 정규화하는 보정 기법:

### 9-1. TF-IDF 변형

```
weight(user_u, item_i) = tf(u, i) × idf(i)

tf(u, i)  = u 가 i 와 상호작용한 빈도 (단순히 1 또는 count)
idf(i)    = log( 전체 사용자 수 / i 를 본 사용자 수 )
```

idf 가 인기 아이템 (분모 큼) 의 가중치를 줄임. **검색의 TF-IDF 와 동일한 메커니즘** (#19 §06 cross-ref).

### 9-2. BM25-like 정규화

```
weight(u, i) = (k+1) × tf(u, i) / (k + tf(u, i)) × idf(i)
```

k 파라미터로 saturation 조절. 클릭 수가 100 인 사용자와 200 인 사용자의 차이를 줄이는 효과.

### 9-3. log-count 변환

```
weight(u, i) = log(1 + count(u, i))
```

count 가 클수록 추가 클릭의 가치 감소 — diminishing returns. 헤비 유저의 영향력 완화.

### 9-4. Negative subsampling

학습 시 popular item 을 negative example 로 더 자주 샘플링 — **word2vec 의 negative sampling 기법** 을 추천에 적용. Two-Tower 학습 (Phase 6 §13) 의 표준 트릭.

---

## 10. Sparse Data 의 함정 — 최소 노출 필터

실전에서 가장 자주 만나는 함정:

```
item_X: 단 3명이 봤는데, 마침 그 3명이 모두 item_Y 도 봤음
   → cosine(X, Y) = 1.0 (완벽한 유사도)
   → 신뢰할 수 있나?
```

**노출 5번** 으로 1.0 cosine 이 나왔다고 실제로 1.0 의 가치가 있는 게 아니다. 통계적으로 의미 없는 점수.

### 10-1. 보정 방법

| 방법 | 적용 | 효과 |
|---|---|---|
| **최소 노출 필터** | `interaction_count < threshold (예: 50)` 인 아이템 제외 | 가장 단순. 신뢰 안 되는 점수 제거 |
| **Bayesian smoothing** | `score_adjusted = (count × score + prior × mean) / (count + prior)` | 평균으로 회귀, prior 가 클수록 보수적 (§06 Wilson/Bayesian 에서 deep-dive) |
| **Wilson score lower bound** | 신뢰구간 하한 사용 — 데이터 적으면 score 하향 | §06 deep-dive |
| **Confidence weighting** | `final_score = sim × confidence(count)` 형태로 결합 | 통합 접근 |

산업 표준은 **(1) 최소 노출 필터로 노이즈 제거 + (2) Wilson/Bayesian smoothing 으로 점수 보정** 의 조합.

---

## 11. 코드 예제 — MovieLens-1M 으로 4종 메트릭 비교

Phase 6 §16 의 toy training 에서 실제 비교할 코드의 미리보기.

### 11-1. 데이터 로드

```python
import pandas as pd

# MovieLens-1M ratings.dat: userId :: movieId :: rating :: timestamp
ratings = pd.read_csv(
    'ml-1m/ratings.dat', sep='::',
    names=['user_id', 'item_id', 'rating', 'timestamp'],
    engine='python'
)

# implicit feedback 으로 변환 (rating >= 3 만 "봤다" 로 간주)
ratings['watched'] = (ratings['rating'] >= 3).astype(int)
interactions = ratings[ratings['watched'] == 1][['user_id', 'item_id']]
```

### 11-2. Co-occurrence Matrix 구성

```python
from scipy.sparse import csr_matrix
import numpy as np

n_users = interactions['user_id'].max() + 1
n_items = interactions['item_id'].max() + 1

# user × item 행렬
user_item = csr_matrix(
    (np.ones(len(interactions)),
     (interactions['user_id'], interactions['item_id'])),
    shape=(n_users, n_items)
)

# item × item 공출현 행렬 (X^T X)
co_occur = (user_item.T @ user_item).toarray()
item_counts = np.array(user_item.sum(axis=0)).flatten()  # 각 아이템 노출 수
total_users = n_users
```

### 11-3. 4종 메트릭 계산

```python
def jaccard_sim(co_occur, item_counts):
    # |A ∩ B| / |A ∪ B|
    union = item_counts[:, None] + item_counts[None, :] - co_occur
    return np.where(union > 0, co_occur / union, 0)

def cosine_sim(co_occur, item_counts):
    # (A · B) / (||A|| × ||B||)
    norm = np.sqrt(item_counts[:, None] * item_counts[None, :])
    return np.where(norm > 0, co_occur / norm, 0)

def pmi_sim(co_occur, item_counts, total_users):
    # log( P(i,j) / P(i)P(j) )
    p_ij = co_occur / total_users
    p_i = item_counts / total_users
    expected = np.outer(p_i, p_i)
    with np.errstate(divide='ignore', invalid='ignore'):
        pmi = np.log(np.where(p_ij > 0, p_ij / expected, 1))
    return np.maximum(pmi, 0)  # PPMI

def pearson_sim(user_item):
    # 평균 빼고 cosine (rating 데이터 가정 — 여기서는 implicit 이라 형식만)
    item_means = user_item.mean(axis=0)
    centered = user_item - item_means
    norms = np.sqrt((centered ** 2).sum(axis=0))
    return (centered.T @ centered) / np.outer(norms, norms)
```

### 11-4. 인기 영화로 Popular Item Bias 확인

```python
# 가장 인기 있는 영화 Top 5 골라서 cosine/PMI 결과 비교
top_popular = np.argsort(-item_counts)[:5]

print("Popular movies' top-10 similar (cosine):")
for movie in top_popular:
    similar = np.argsort(-cosine_sim_matrix[movie])[1:11]
    # 결과: 거의 다 popular 영화만 나옴 (popular item bias)

print("Popular movies' top-10 similar (PMI):")
for movie in top_popular:
    similar = np.argsort(-pmi_sim_matrix[movie])[1:11]
    # 결과: 장르적으로 유사한 niche 영화도 등장 (편향 완화)
```

### 11-5. 예상 결과 (산업 일반 패턴)

| 메트릭 | 인기 영화의 추천 결과 | niche 영화의 추천 결과 |
|---|---|---|
| Cosine | 거의 다 인기 영화 (편향) | 노출 적으면 점수 불안정 |
| Jaccard | 인기 편향 약간 완화 | 여전히 불안정 |
| PMI / PPMI | 장르적 유사도 잡힘 | sparse 데이터에서 더 안정적 |
| Pearson | (implicit 에 부적합) | (의미 없음) |

→ **결론**: implicit feedback CF 에서 PMI/PPMI 가 cosine 보다 안전. 산업에서 cosine 을 default 로 쓰는 관행은 검토 필요.

---

## 12. 흔한 함정 7가지

| # | 함정 | 실제 |
|---|---|---|
| 1 | "cosine 이 default 라 안전하다" | implicit feedback CF 에서 popular item bias 의 직격탄. PMI/PPMI 가 더 안전. |
| 2 | "Jaccard 가 가장 단순하니 무난" | binary 만 다룸. count/weighted 데이터 정보 무시. |
| 3 | "Pearson 이 cosine 보다 항상 우월" | rating 에서는 맞지만 implicit feedback 에서는 의미 없음 (평균 정의 모호). |
| 4 | "sparse data 에서 cosine = 1.0 이면 추천" | 노출 5번에 1.0 은 신뢰도 0. 최소 노출 필터 + Wilson/Bayesian 필수. |
| 5 | "PMI 가 popular item bias 해결" | 부분적으로 맞지만 sparse data 에서는 PMI 도 변동성 큼. smoothing 필요. |
| 6 | "유사도 메트릭은 cosine 한 번 정하면 끝" | 데이터 분포 변하면 메트릭 재검토 필요. 신상품 비중, 가중치 변화 등. |
| 7 | "메트릭 차이가 큰 영향 없을 거다" | A/B 실험에서 메트릭 변경만으로 CTR 10~30% 변동 흔히 관찰. 가장 큰 단일 결정. |

---

## 13. 꼬리 질문 (§26 면접 카드 후보)

1. **Cosine similarity 가 implicit feedback CF 에서 부적절한 이유는?**
   - 답: popular item bias. 인기 아이템 vector 가 1 을 많이 갖고 있어서 다른 인기 아이템과 cosine 이 자동 높아짐. 사용자가 이미 아는 인기 상품만 추천되어 추천 가치 손실. PMI/PPMI 가 확률 기반이라 popular 편향 자동 보정.

2. **PMI 와 Lift 의 차이는?**
   - 답: 동일한 비율 P(i,j)/(P(i)P(j))인데 PMI 는 log 를 씌운 형태, Lift 는 raw 형태. PMI 는 합산 친화적 (log 의 성질), Lift 는 비즈니스 보고서에 직관적. 정보량은 동일.

3. **Pearson correlation 이 rating 데이터에서 cosine 보다 나은 이유는?**
   - 답: user bias 제거. 후한 평가자 (평균 4.5) 의 5점과 까다로운 평가자 (평균 2.5) 의 3.5점이 같은 강도라는 사실을 평균 빼기로 잡음. cosine 은 raw 값만 봐서 이 차이 무시.

4. **Sparse data 에서 cosine similarity 가 1.0 인 아이템 쌍의 의미는?**
   - 답: 통계적으로 신뢰할 수 없는 점수. 노출 수가 적으면 한 사용자의 행동이 점수를 완전히 결정해버림. 최소 노출 필터 (예: count < 50 제외) + Wilson score lower bound 또는 Bayesian smoothing 으로 보정 필수.

5. **추천 알고리즘에서 PMI 와 word2vec 의 관계는?**
   - 답: word2vec 의 skip-gram with negative sampling 의 목적함수가 본질적으로 PMI 분해와 동등 (Levy & Goldberg 2014). 즉 추천 임베딩 학습 시 dense embedding 도 결국 PMI 의 행렬 분해. PMI 가 추천의 이론적 기초.

6. **TF-IDF 보정을 추천에 적용하는 이유는?**
   - 답: 인기 아이템의 가중치를 낮추기 위함. idf = log(N/df) 가 자주 등장하는 아이템의 weight 를 줄여서 popular item bias 완화. 검색의 TF-IDF 원리와 동일 (#19 §06 cross-ref).

---

## 14. cross-ref

| 주제 | 연결된 study |
|---|---|
| TF-IDF / BM25 의 idf | #19 §06 (검색의 IDF 가 추천의 popular bias 보정과 동일 메커니즘) |
| Wilson score / Bayesian smoothing | §06 (베스트 랭킹의 점수 왜곡 방지 — 동일 기법) |
| Word2vec ↔ PMI 관계 | NLP 임베딩 §09 (Sentence-BERT) 의 이론적 배경 |
| Matrix Factorization (ALS) | §03 (latent factor model — PMI 의 행렬 분해 형태) |
| Spark co-occurrence 구현 | Phase 10 §23 (CF Spark PoC) |
| Negative sampling | Phase 6 §13 (Two-Tower 학습 트릭) |
