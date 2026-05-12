---
parent: 20-recommendation-modeling
seq: 06
title: Wilson score / Bayesian smoothing — 적은 노출 상품의 점수 왜곡 방지 수식 deep-dive
type: deep
created: 2026-05-12
---

# 06. Wilson Score / Bayesian Smoothing

> **사용자 약점 deep-dive**. §02 §10 과 §05 §4-2 에서 미뤘던 "노출 5번에 CTR 100% 는 신뢰할 수 있나?" 의 정답. 수식과 직관을 균형있게.

---

## 1. 문제 정의 — Empirical CTR 의 거짓

### 1-1. 시나리오

추천 ranking 에 CTR (Click-Through Rate, 클릭률) 을 score 로 쓴다고 하자.

```
item_A: 노출 10000, click 500   → CTR = 5.0%
item_B: 노출 10,    click 5     → CTR = 50.0%   ← Top-1?
item_C: 노출 1,     click 1     → CTR = 100.0%  ← Top-0?
```

**상식적으로**: B 와 C 가 A 보다 정말 5배~20배 좋은 상품일까? 아니다. 노출이 너무 적어서 통계적 의미가 없다.

**문제**: empirical (관측) CTR 그대로 ranking 에 쓰면 노출 적은 상품이 위로 올라온다. 추천 시스템에 치명적.

### 1-2. 직관적 해결책의 한계

**시도 1**: 최소 노출 필터 — `impressions >= 100` 인 아이템만 고려.
- ✅ 단순
- ❌ 100 vs 99 의 임의 경계
- ❌ 신상품은 영원히 추천 불가

**시도 2**: Bayesian average — `(count × score + prior × global_mean) / (count + prior)`
- ✅ 연속적 보정
- ❌ prior 강도 (smoothing 양) 결정 어려움

**시도 3**: Wilson score lower bound — 신뢰구간의 하한을 score 로 사용
- ✅ 통계적으로 견고
- ✅ 노출 적은 아이템은 score 자동 하향
- ✅ 노출 많은 아이템은 empirical CTR 에 수렴
- → **이게 산업 표준**

---

## 2. 신뢰구간이라는 개념 — Wald vs Wilson

CTR 추정의 통계 모델:
- 노출 n 번 중 click k 번 관측
- 참 CTR p̂ 가 있다고 가정 — 추정하려는 것
- 관측 = Bernoulli 시행 n 번, 각 시행이 확률 p̂ 로 성공

empirical estimate:
```
p_observed = k / n
```

하지만 진짜 p̂ 는 p_observed 와 다를 수 있다. 신뢰구간 (confidence interval) 으로 표현.

### 2-1. Wald Interval (전통적)

가장 흔히 배우는 신뢰구간:
```
p ∈ p_observed ± z × sqrt( p_observed × (1 - p_observed) / n )

z = 1.96 (95% 신뢰)
```

**문제**:
- ❌ p_observed = 0 일 때 분산 추정 = 0 → 신뢰구간 폭 0 (말도 안 됨)
- ❌ n 작을 때 정확도 낮음 — 정규분포 근사가 깨짐
- ❌ p_observed ≈ 0 또는 1 근처에서 [0, 1] 범위 벗어남 (음수 또는 1 이상)

추천 ranking 에 그대로 못 쓴다.

### 2-2. Wilson Score Interval

Edwin B. Wilson 이 1927년에 제안한 개선. **n 작거나 p 가 극단일 때도 정확**.

수식:

```
p ∈ ( p_observed + z²/(2n) ± z × sqrt( p_observed×(1-p_observed)/n + z²/(4n²) ) )
    / ( 1 + z²/n )
```

핵심 차이:
- ✅ p_observed = 0 이어도 신뢰구간이 0 이상의 폭을 가짐
- ✅ n 작을 때도 [0, 1] 범위 보장
- ✅ 큰 n 에서는 Wald 와 수렴

---

## 3. Wilson Score Interval — 수식 derivation

### 3-1. 유도 (직관 위주)

Wilson 의 아이디어: **참 p 가 어떤 값일 때 관측된 p_observed 가 z 표준편차 이내에 들어갈 확률 95%** 라는 조건을 직접 푼다.

```
| p_observed - p | / sqrt( p × (1-p) / n )  ≤  z

→ ( p_observed - p )² ≤ z² × p × (1-p) / n

→ p² × (n + z²) - p × (2n × p_observed + z²) + n × p_observed² ≤ 0
```

p 에 대한 2차 방정식. 근의 공식:

```
p = ( 2n × p_observed + z² ± sqrt( (2n × p_observed + z²)² - 4(n + z²) × n × p_observed² ) ) 
    / ( 2(n + z²) )

= ( p_observed + z²/(2n) ± z × sqrt( p_observed×(1-p_observed)/n + z²/(4n²) ) ) 
    / ( 1 + z²/n )
```

이게 Wilson score interval. 양의 부호 = upper bound, 음의 부호 = lower bound.

### 3-2. Lower Confidence Bound (LCB) — Ranking 에 쓰는 부분

추천 ranking 에는 **lower bound 만** 쓴다.

```
LCB = ( p_observed + z²/(2n) - z × sqrt( p_observed×(1-p_observed)/n + z²/(4n²) ) )
      / ( 1 + z²/n )
```

**왜 lower bound 인가**:
- "최소한 이 정도는 확실하다" 의 점수
- 노출 많은 아이템은 LCB ≈ p_observed (확신)
- 노출 적은 아이템은 LCB << p_observed (보수적)

### 3-3. 예시 계산 (z = 1.96, 95% 신뢰)

```
item_A: 노출 10000, click 500
   p = 0.05, n = 10000
   LCB ≈ ( 0.05 + 1.96²/20000 - 1.96 × sqrt(0.05×0.95/10000) ) / (1 + 1.96²/10000)
       ≈ ( 0.05 + 0.00019 - 1.96 × 0.00218 ) / 1.0004
       ≈ ( 0.05019 - 0.00427 ) / 1.0004
       ≈ 0.0459
   → 실제 CTR ≈ 5%, LCB ≈ 4.59% (거의 같음 — 노출 많아서 확신)

item_B: 노출 10, click 5
   p = 0.5, n = 10
   LCB ≈ ( 0.5 + 1.96²/20 - 1.96 × sqrt(0.5×0.5/10 + 1.96²/400) ) / (1 + 1.96²/10)
       ≈ ( 0.5 + 0.192 - 1.96 × sqrt(0.025 + 0.0096) ) / 1.384
       ≈ ( 0.692 - 1.96 × 0.186 ) / 1.384
       ≈ ( 0.692 - 0.364 ) / 1.384
       ≈ 0.237
   → 실제 CTR = 50%, LCB ≈ 23.7% (크게 하향)

item_C: 노출 1, click 1
   p = 1.0, n = 1
   LCB ≈ ( 1.0 + 1.96²/2 - 1.96 × sqrt(1×0/1 + 1.96²/4) ) / (1 + 1.96²)
       ≈ ( 1.0 + 1.92 - 1.96 × 0.98 ) / 4.84
       ≈ ( 2.92 - 1.92 ) / 4.84
       ≈ 0.207
   → 실제 CTR = 100%, LCB ≈ 20.7% (가장 크게 하향)

순위:
   empirical: C (100%) > B (50%) > A (5%)
   LCB:       A (4.59%) > B (23.7%) > C (20.7%)
                                     ^^^
                                     A 가 1위로 올라옴 (정답)
```

**핵심**: empirical 에서 1위였던 C 가 LCB 에서 마지막. 노출 많은 A 가 1위. **이게 추천 시스템에서 우리가 원하는 결과**.

### 3-4. n 별 LCB 패턴

```
실제 p = 0.5 (CTR 50%) 일 때 n 변화에 따른 LCB:

n = 1:    LCB = 0.21   (-29% 하향)
n = 10:   LCB = 0.24   (-26%)
n = 100:  LCB = 0.40   (-10%)
n = 1000: LCB = 0.47   (-3%)
n = 10000: LCB = 0.49  (-1%)
n = ∞:    LCB = 0.50   (수렴)
```

n 이 클수록 LCB ↑ empirical 에 가까워짐. n 적으면 보수적.

---

## 4. Bayesian Smoothing — Beta-Binomial Conjugate Prior

Wilson 은 frequentist (빈도주의) 접근. Bayesian (베이즈) 접근은 다른 멘탈 모델.

### 4-1. Beta Distribution 직관

Beta distribution Beta(α, β) 는 **0~1 사이 확률 p 의 분포**.

```
Beta(α, β):
  α: 가상의 성공 수 (pseudo-successes)
  β: 가상의 실패 수 (pseudo-failures)
  평균: α / (α + β)
  분산: α × β / ((α+β)² × (α+β+1))
```

직관: "Beta(α=2, β=8) 분포는 평균 0.2, 그러나 0.5 정도도 가능성 있는 분포".

대표 형태:
- Beta(1, 1) = Uniform (균등 분포, 0~1 모두 똑같이 가능)
- Beta(100, 100) = N(0.5, 작은 분산) (0.5 강하게 믿음)
- Beta(2, 8) = 0.2 근처 분포 (왼쪽 치우침)

### 4-2. Conjugate Prior 의 의미

CTR 추정의 Bayesian 모델:
```
Prior:      Beta(α, β)              ← 학습 전 "내가 믿는 CTR 분포"
Likelihood: Binomial(n, p)           ← 관측 (n번 노출 중 k번 click)
Posterior:  Beta(α + k, β + n - k)   ← 학습 후 "업데이트된 CTR 분포"
```

**Conjugate (켤레)**: Beta prior + Binomial likelihood → Beta posterior. 같은 형태가 유지되는 마법.

**의미**: prior 가 "가상의 노출 α+β 번, 그 중 click α번 봤다고 미리 믿음" 이라고 해석.

### 4-3. Bayesian smoothing 의 식

```
smoothed_score = (k + α) / (n + α + β)

k: 관측된 click
n: 관측된 노출
α, β: prior (가상의 click, 가상의 non-click)
```

**해석**:
- 노출 n 이 적을 때 (n << α+β): score ≈ α/(α+β) = global mean 으로 수렴
- 노출 n 이 클 때 (n >> α+β): score ≈ k/n = empirical
- α, β 가 클수록 prior 영향 강 → 보수적

### 4-4. Prior 설정 — Empirical Bayes

α, β 를 어떻게 정하나? **데이터에서 추정** (Empirical Bayes):

```python
# 모든 아이템의 CTR 분포에서 평균/분산 추정
mu = mean(all_item_ctrs)
var = variance(all_item_ctrs)

# Beta 분포의 method of moments
alpha = mu × ((mu × (1-mu) / var) - 1)
beta = (1-mu) × ((mu × (1-mu) / var) - 1)
```

또는 더 단순하게: **α + β = "smoothing strength"** 를 hyperparameter 로.

산업 표준 — `α + β` (effective sample size) 의 의미:
- α + β = 10: 약한 prior (가상의 노출 10번, 데이터 강하면 빨리 떨어져 나감)
- α + β = 100: 중간 prior (산업 default)
- α + β = 1000: 강한 prior (데이터 부족 영역에서 평균에 강하게 수렴)

### 4-5. 예시 계산

산업 default `α = 5, β = 95` 사용 (mean = 5% CTR 가정):

```
item_A: 노출 10000, click 500
   smoothed = (500 + 5) / (10000 + 100) = 505 / 10100 ≈ 5.00%
   (영향 없음 — 데이터 많음)

item_B: 노출 10, click 5
   smoothed = (5 + 5) / (10 + 100) = 10 / 110 ≈ 9.09%
   (50% → 9.09% 로 강하게 하향. 평균 5% 에 가까이)

item_C: 노출 1, click 1
   smoothed = (1 + 5) / (1 + 100) = 6 / 101 ≈ 5.94%
   (100% → 5.94%. 거의 평균)

순위:
   Bayesian: A (5.00%) > B (9.09%) > C (5.94%)
              ← 어 잠깐, A 가 1등이 아닌데?
   
실제로 다시 보면:
   A: 5.00%
   B: 9.09%  ← 1등?
   C: 5.94%

   순위: B > C > A
```

**관찰**: Bayesian smoothing 은 Wilson 보다 **덜 보수적**. B (n=10, 50%) 가 여전히 1위. 이게 좋은 건지 나쁜 건지는 prior 강도 (`α+β`) 에 달림.

**`α+β` 를 키우면** (예: 1000):
```
B: smoothed = (5 + 50) / (10 + 1000) = 55/1010 ≈ 5.45%
C: smoothed = (1 + 50) / (1 + 1000) = 51/1001 ≈ 5.10%
A: smoothed = (500 + 50) / (10000 + 1000) = 550/11000 ≈ 5.00%

순위: B (5.45%) > C (5.10%) > A (5.00%)
```

여전히 B 가 1위. 더 강하게 보수적으로 하려면 prior 더 키워야 함.

### 4-6. Bayesian 의 우월점 — Posterior Distribution

Bayesian 의 진짜 강점은 단일 score 가 아니라 **확률 분포** 를 갖는다는 점:

```
item B: 노출 10, click 5 → Posterior = Beta(10, 100)
   평균: 0.0909
   95% 구간: (0.0445, 0.1567)
   → "B 의 CTR 은 4.45% ~ 15.67% 사이에 95% 있다"

item C: 노출 1, click 1 → Posterior = Beta(6, 100)
   평균: 0.0594
   95% 구간: (0.0220, 0.1158)
   → "C 의 CTR 은 2.20% ~ 11.58% 사이에 95% 있다"
```

이 분포를 활용하면:
- **Thompson sampling** (#19 §42-44 cross-ref) — posterior 에서 샘플링해서 exploration
- **MAB (Multi-Armed Bandit, 다중 슬롯머신)** 의 표준 — exploration/exploitation 균형
- **Confidence-aware ranking** — 분포의 분산 자체를 ranking 신호로

---

## 5. Wilson vs Bayesian Trade-off

| 축 | Wilson Score LCB | Bayesian Smoothing |
|---|---|---|
| 철학 | Frequentist | Bayesian |
| 모델 | "참 p 가 있고 추정한다" | "p 는 확률 분포" |
| 출력 | 단일 score (LCB) | 확률 분포 (Beta) |
| Prior | 없음 (z 만 hyperparameter) | α, β 명시적 |
| Hyperparameter | z = 1.96 (95% 신뢰) | α + β (smoothing strength) |
| 보수성 | n 적을수록 매우 보수적 | prior 강도에 따라 조절 가능 |
| Exploration | 불가 (deterministic) | 가능 (Thompson sampling) |
| 산업 사용 | Reddit 댓글 ranking, Amazon 별점 | 광고 입찰, MAB |
| 계산 비용 | 한 번 (deterministic) | sampling 필요 (MAB) |

### 5-1. 언제 무엇을 쓰나

**Wilson Score LCB 가 적합**:
- 단일 score 가 필요한 ranking (deterministic)
- 가장 보수적으로 하고 싶을 때 (적은 노출 강하게 하향)
- prior 정보 없을 때
- 빠른 계산 필요 (Spark 잡, 실시간 추천)

**Bayesian smoothing 이 적합**:
- 확률 분포가 필요할 때 (MAB, A/B 동시 실험)
- 도메인 지식으로 prior 설정 가능할 때
- Exploration 이 필요할 때 (신상품 노출)
- Bayesian framework 가 이미 있을 때

**산업 표준**: 일반 추천 ranking 은 **Wilson LCB**. MAB/exploration 이 필요한 곳은 **Bayesian**.

---

## 6. 산업 코드 — Python 구현

### 6-1. Wilson Score LCB

```python
import math

def wilson_lcb(positives: int, total: int, z: float = 1.96) -> float:
    """
    Wilson score lower confidence bound for binomial proportion.
    
    z = 1.96  → 95% confidence
    z = 2.576 → 99% confidence (더 보수적)
    z = 1.645 → 90% confidence (덜 보수적)
    """
    if total == 0:
        return 0.0
    
    p = positives / total
    n = total
    
    numerator = p + z**2 / (2*n) - z * math.sqrt(p*(1-p)/n + z**2/(4*n**2))
    denominator = 1 + z**2 / n
    
    return max(0.0, numerator / denominator)

# 사용 예
items = [
    ('A', 500, 10000),
    ('B', 5, 10),
    ('C', 1, 1),
]
for item_id, clicks, impressions in items:
    score = wilson_lcb(clicks, impressions)
    print(f"{item_id}: empirical={clicks/impressions:.2%}, wilson_lcb={score:.4f}")

# 출력:
# A: empirical=5.00%, wilson_lcb=0.0459
# B: empirical=50.00%, wilson_lcb=0.2366
# C: empirical=100.00%, wilson_lcb=0.2065
```

### 6-2. Bayesian Smoothing

```python
def bayesian_smoothed_ctr(
    positives: int, total: int, 
    alpha: float = 5.0, beta: float = 95.0
) -> float:
    """
    Bayesian smoothing with Beta(alpha, beta) prior.
    Mean of posterior Beta(alpha + positives, beta + total - positives).
    
    alpha + beta = effective sample size (smoothing strength)
    alpha / (alpha + beta) = prior mean (가정한 평균 CTR)
    """
    return (positives + alpha) / (total + alpha + beta)


def empirical_bayes_prior(item_stats: list[tuple[int, int]]) -> tuple[float, float]:
    """
    Method of moments estimation for Beta prior.
    
    item_stats: list of (positives, total) per item
    """
    import statistics
    ctrs = [p/t for p, t in item_stats if t > 0]
    mu = statistics.mean(ctrs)
    var = statistics.variance(ctrs)
    
    # alpha, beta from method of moments
    common = mu * (1 - mu) / var - 1
    alpha = mu * common
    beta = (1 - mu) * common
    return alpha, beta

# 사용 예
alpha, beta = 5.0, 95.0  # 또는 empirical_bayes_prior(all_items)

for item_id, clicks, impressions in items:
    score = bayesian_smoothed_ctr(clicks, impressions, alpha, beta)
    print(f"{item_id}: empirical={clicks/impressions:.2%}, bayes_smoothed={score:.4f}")
```

### 6-3. BigQuery SQL 통합

```sql
-- Wilson LCB in BigQuery (95% confidence, z=1.96)
WITH item_stats AS (
  SELECT
    item_id,
    SUM(IF(action = 'click', 1, 0)) AS clicks,
    SUM(IF(action = 'impression', 1, 0)) AS impressions
  FROM action_log
  WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY item_id
),
wilson AS (
  SELECT
    item_id,
    clicks,
    impressions,
    -- empirical CTR
    SAFE_DIVIDE(clicks, impressions) AS empirical_ctr,
    -- Wilson LCB
    SAFE_DIVIDE(
      (SAFE_DIVIDE(clicks, impressions) + 1.96*1.96/(2*impressions))
      - 1.96 * SQRT(
          SAFE_DIVIDE(clicks * (impressions - clicks), impressions * impressions * impressions)
          + 1.96*1.96/(4*impressions*impressions)
        ),
      1 + 1.96*1.96/impressions
    ) AS wilson_lcb
  FROM item_stats
  WHERE impressions >= 10  -- 최소 필터 (그래도 안전망)
)
SELECT * FROM wilson ORDER BY wilson_lcb DESC LIMIT 100
```

---

## 7. 산업 사례

### 7-1. Reddit 댓글 Ranking (Wilson LCB 도입의 효시)

2009 년 Reddit 의 Randall Munroe 가 [블로그](https://www.evanmiller.org/how-not-to-sort-by-average-rating.html) 에서 Wilson score 를 댓글 ranking 에 도입. 이전에는:
- 단순 (upvotes - downvotes) — popular comment bias
- 단순 upvote ratio — 적은 표 함정

Wilson LCB 이후:
- ✅ 적은 vote 댓글이 보수적으로 hidden
- ✅ 많은 vote 댓글이 자연스럽게 상위
- ✅ 추천 시스템 전체에 영향

### 7-2. Amazon 별점 Ranking

Amazon 의 별점 정렬도 Bayesian smoothing 변형 사용. "5점 별 하나" 가 "4.5점 별 1000개" 위에 노출되는 함정 방지.

### 7-3. 광고 입찰 — Thompson Sampling

광고 ranking 에서 MAB 가 Bayesian smoothing 의 가장 큰 산업 사용처. 신규 광고 (n 작음) 의 exploration 을 posterior 분포에서 sampling 으로 자연스럽게.

→ Phase 9 §19 의 A/B + MAB 와 직결.

---

## 8. 흔한 함정 7가지

| # | 함정 | 실제 |
|---|---|---|
| 1 | "empirical CTR 그대로 ranking 에 쓴다" | 적은 노출의 거짓 점수. Wilson LCB 또는 Bayesian 필수. |
| 2 | "최소 노출 필터 (n ≥ 100) 만으로 충분" | 99 vs 100 의 임의 경계. 신상품 영원히 제외. LCB 가 연속적 보정. |
| 3 | "Wald confidence interval 쓴다" | p=0 또는 1 근처에서 깨짐. Wilson 이 정확. |
| 4 | "z = 1.96 이 유일 선택" | 99% (z=2.576) 가 더 보수적, 90% (z=1.645) 가 덜. 비즈니스 결정. |
| 5 | "Bayesian smoothing 의 prior 는 아무거나 OK" | prior 강도가 결정적. Empirical Bayes 로 데이터 기반 산출 권장. |
| 6 | "Wilson 과 Bayesian 은 동등하다" | Wilson 은 단일 score, Bayesian 은 분포. MAB 가 필요하면 Bayesian. |
| 7 | "노출 적은 아이템은 그냥 추천 안 한다" | Cold-start 문제. LCB + exploration (MAB) 가 산업 정답. |

---

## 9. 꼬리 질문 (§26 면접 카드 후보)

1. **Wilson score lower bound 가 empirical CTR 보다 ranking 에 적합한 이유는?**
   - 답: 노출 적은 아이템의 점수를 자동으로 보수적으로 하향. 노출 1번에 click 1번의 100% CTR 이 LCB ≈ 20% 로 보정되어, 노출 10000번에 5% CTR (LCB ≈ 4.6%) 보다 낮아짐. **추천에 적은 노출 함정 회피**.

2. **Wald confidence interval 대신 Wilson 을 쓰는 이유는?**
   - 답: Wald 는 p=0 또는 1 근처에서 분산 추정이 깨짐 (분산=0). [0,1] 범위 벗어남. Wilson 은 작은 n 과 극단 p 에서도 정확. 1927년 Wilson 의 핵심 기여.

3. **Bayesian smoothing 의 Beta-Binomial conjugate 관계는?**
   - 답: Prior Beta(α, β) + Binomial likelihood → Posterior Beta(α+k, β+n-k). 같은 분포 형태 유지. α+β = effective sample size (smoothing strength). α/(α+β) = prior mean.

4. **Wilson 과 Bayesian 의 선택 기준은?**
   - 답: Wilson — 단일 score, deterministic ranking, 보수적. Bayesian — 분포 활용 (MAB, Thompson sampling, exploration), prior 정보 활용. 일반 ranking 은 Wilson, exploration 필요하면 Bayesian.

5. **Bayesian smoothing 의 prior 를 어떻게 정하나?**
   - 답: Empirical Bayes — 데이터에서 method of moments 로 α, β 추정. 또는 hyperparameter (α+β = smoothing strength) 로 튜닝. `α+β` 가 클수록 보수적 (데이터 적을 때 평균에 강하게 회귀).

6. **Reddit 의 Wilson LCB 도입이 추천 시스템에 미친 영향은?**
   - 답: 2009년 Reddit 의 댓글 ranking 적용 후, "적은 vote 의 함정" 이 산업에 인식됨. 이후 Amazon 별점, e-commerce 인기 ranking, 추천 시스템 score 보정의 표준이 됨. 단순 average 의 위험성을 산업 전체가 학습.

7. **Wilson LCB 의 z 파라미터 선택 기준은?**
   - 답: z = 1.96 (95% 신뢰) 산업 default. 더 보수적 (z=2.576, 99%) — 신중한 ranking. 덜 보수적 (z=1.645, 90%) — exploration 허용. 비즈니스 결정 — false negative (좋은 아이템 누락) vs false positive (나쁜 아이템 노출) trade-off.

---

## 10. cross-ref

| 주제 | 연결된 study |
|---|---|
| Sparse data 함정 | §02 §10 (§06 가 정확한 해결책) |
| 행동 가중합 보정 | §05 §4-2 (Bayesian smoothing 적용) |
| Multi-Armed Bandit (MAB) | #19 §42-44 (Bayesian + Thompson sampling) |
| A/B 통계 power | Phase 9 §19 (신뢰구간 동일 개념) |
| msa 룰 기반 CB 의 score 보정 | Phase 10 §22 (BigQuery 의 Wilson SQL 패턴) |
| Cold-start 보정 | Phase 7 §17 (LCB + popularity fallback) |
| Beta distribution / Conjugate prior | 확률 / 통계 기초 (선수 지식) |
