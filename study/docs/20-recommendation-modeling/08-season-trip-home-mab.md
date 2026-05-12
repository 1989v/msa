---
parent: 20-recommendation-modeling
seq: 08
title: 시즌·통합스코어·MAB 후보 — sba sliding window, Trip Home feature_score, stb → MAB 진화
type: deep
created: 2026-05-12
---

# 08. 시즌 / 통합 스코어 / MAB 후보

> **Phase 4 단일 파일**. 시즌성 (sba), 통합 스코어 (Trip Home), section preference (stb → MAB) 의 패턴을 통합 정리. §19 (#19 §42-44 의 MAB) 와 cross-ref 가 핵심.

---

## 1. Phase 4 의 위치 — Retrieval 룰 기반 + Ranking 보정

§01 §5 Funnel 에서 Phase 4 의 자리:

```
Stage 1: Retrieval
   ├─ CF / Two-Tower / Geo / Content
   └─ 룰 기반  ← 이 Phase
        ├─ cb / cb2 (도시×카테고리 인기, Phase 2)
        ├─ sba (시즌 인기)            ← §08
        ├─ th (Trip Home 통합)         ← §08
        ├─ ctr-best (단기 CTR)         ← §08
        └─ resale-best (재구매)        ← §08

Stage 3: Re-rank / Boost
   ├─ stb (section preference)        ← §08
   ├─ MAB exploration                 ← §08
   └─ diversity / cold-start
```

Phase 4 는 **2가지 영역에 걸쳐 있다**:
- Retrieval 의 룰 기반 인기 점수 (sba, th, ctr-best, resale-best)
- Re-rank 의 section preference + MAB exploration (stb 의 진화)

---

## 2. 시즌성 추천 (sba) — Sliding Window 패턴

### 2-1. 문제 — 시즌이 무엇인가

여행 OTA 의 시즌성:
- **계절 시즌**: 여름 (해변/풀빌라), 겨울 (스키/온천)
- **이벤트 시즌**: 연휴 (설/추석), 크리스마스
- **로컬 시즌**: 벚꽃 (4월 한국), 단풍 (10월), 라벤더 (7월 프로방스)
- **항공권 시즌**: 비수기/성수기 (운임 차이 3~5배)

→ "지금 인기 상품" 이 1년 통계 평균 ≠ 현재 사용자 의도에 맞는 상품.

### 2-2. Sliding Window — `예약일 ±7일` 패턴

산업 표준 sba (Season Best Accommodation) 의 핵심 아이디어:

```
사용자가 8월 15일 예약 검색
   ↓
"8월 8일 ~ 8월 22일 사이에 체크인한 예약" 만 집계
   ↓
이 시즌 (여름 휴가철) 의 진짜 인기 숙소
```

**왜 ±7일인가**:
- 너무 좁음 (±1일): 데이터 부족 (sparse)
- 너무 넓음 (±30일): 시즌 신호 희석 (8월 평균은 7월/9월 다 섞임)
- ±7일 = 1주 = "같은 시즌" 의 정의

### 2-3. Spark Sliding Window 구현 패턴

```scala
import org.apache.spark.sql.functions._

// 예약 데이터에 sliding window 적용
val reservations = spark.table("reservations")
  .select($"offer_id", $"city_id", $"checkin_date", $"reservation_count")

val seasonalScores = reservations
  .withColumn(
    "window_start", date_sub($"checkin_date", 7)
  )
  .withColumn(
    "window_end", date_add($"checkin_date", 7)
  )
  // 자기 자신을 window 로 join (cross product of dates within window)
  .as("r1")
  .join(
    reservations.as("r2"),
    expr("""
      r1.offer_id = r2.offer_id
      AND r2.checkin_date BETWEEN r1.window_start AND r1.window_end
    """)
  )
  .groupBy($"r1.offer_id", $"r1.city_id", $"r1.checkin_date")
  .agg(sum($"r2.reservation_count").as("seasonal_reservation_count"))
```

**관찰**: self-join 으로 sliding window 구현. Spark 의 `window` 함수도 가능하지만 sliding 이 명시적으로 표현되어 디버깅 친화적.

**비용**: cross-product join 이라 데이터 큼. 보통 일별 partition + 30일 lookback 으로 batch 산출.

### 2-4. season-best-tna 변형

TNA (Tour & Activity) 도메인은 액티비티 시즌이 더 명확:
- 스키 (12-2월)
- 다이빙 (6-9월, 적도 부근)
- 트레킹 (가을, 봄)

→ sba 와 동일 패턴 + 카테고리별 sliding window 폭 조절.

### 2-5. 시즌성 vs Long-term 의 trade-off

| | 시즌성 (sba, ±7일) | Long-term (90일 평균) |
|---|---|---|
| 정확성 | ✅ 현재 시즌 반영 | ❌ 시즌 평균 |
| 안정성 | ❌ 노이즈 큼 | ✅ 안정 |
| Cold-start | ❌ 시즌별 데이터 부족 | ✅ 충분 데이터 |
| Bayesian 보정 | 필수 | 권장 |

산업 표준: **두 score 의 결합**
```
score = α × seasonal_score + (1-α) × long_term_score

α: 시즌 명확성에 따라 (스키 시즌은 α=0.9, 일반 시즌은 α=0.5)
```

---

## 3. Trip Home (th) — 통합 Feature Score

### 3-1. 문제 — 메인 페이지의 "다양한 상품 통합 랭킹"

여행 앱의 메인 페이지 (Trip Home):
- 호텔, 액티비티, 항공, 패키지가 한 화면에 섞임
- 도메인이 다른 상품의 점수를 어떻게 비교?
- 호텔 1박 5만원 vs 액티비티 5만원 의 click 가치는?

→ **도메인 cross 통합 score** 가 필요.

### 3-2. 산업 패턴 — Weighted Feature Score

```
trip_home_score(item)
  = w_pop × normalized_popularity(item)
  + w_personal × user_match_score(item)
  + w_freshness × freshness_score(item)
  + w_diversity × diversity_bonus(item)
  + w_business × business_priority(item)

w_pop, w_personal, w_freshness, w_diversity, w_business: hyperparameter
```

**핵심**: 각 항을 **0~1 범위로 정규화** 한 후 가중 합산.

### 3-3. 정규화 — Min-Max / Z-score / Rank Normalization

다른 분포의 score 를 결합할 때 정규화 방법:

**Min-Max**:
```
normalized = (score - min) / (max - min)
```
- ✅ 0~1 범위 보장
- ❌ outlier 에 민감

**Z-score**:
```
normalized = (score - mean) / std
```
- ✅ 분포 모양 보존
- ❌ 범위 [-∞, ∞]

**Rank Normalization** (산업 default):
```
normalized = rank / total_count
```
- ✅ outlier robust
- ✅ 0~1 범위
- ✅ 분포 무관 (어떤 score 든 동일 효과)

산업의 trip_home_score 는 **Rank Normalization 후 가중 합산** 패턴.

### 3-4. Domain Cross 의 함정

```
호텔 평균 popularity: 1000 (도메인 작음, 인기 집중)
액티비티 평균 popularity: 100 (도메인 큼, 인기 분산)

raw popularity 비교 → 호텔이 압도. 액티비티 노출 사라짐.
```

해결: **도메인별 정규화 후 결합**.

```python
# 도메인별로 rank 매기고 합산
hotels_ranked = rank(hotels, by='popularity')
activities_ranked = rank(activities, by='popularity')
unified = merge(hotels_ranked, activities_ranked)  # 두 도메인의 rank 가 0~1 로 동등
```

### 3-5. 산업 카탈로그의 th 엔진 — TNA + 통합 숙박 풀 결합

산업 th 엔진의 source:
```
th_score = α × tna3_score + β × union_stay_score

tna3_score: TNA (투어/액티비티) 3대 카테고리 통합 score
union_stay_score: 통합 숙박 풀 (호텔 + 민박 + 패키지) 통합 score
```

α, β 는 메인 페이지의 비즈니스 우선순위에 따라 (예: 숙소 우선이면 β > α).

---

## 4. ctr-best — 단기 CTR 기준 Ranking

### 4-1. 시그널 — 중기 CTR 피처

```
mid_term_ctr(offer) = clicks_14d / impressions_14d
```

14일 윈도우. 단기 (1일) 도 아니고 long-term (90일) 도 아닌 중간. 시즌 변화 + 캠페인 효과를 잡으면서도 변동성 통제.

### 4-2. 도시 × product_type 단위 Top-N

```sql
WITH ctr_14d AS (
  SELECT
    city_id,
    product_type,
    offer_id,
    SAFE_DIVIDE(SUM(click_count), SUM(impression_count)) AS ctr,
    SUM(impression_count) AS total_impressions
  FROM offer_actions
  WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
  GROUP BY city_id, product_type, offer_id
  HAVING total_impressions >= 100  -- 최소 노출 필터
),
wilson_ctr AS (
  SELECT
    *,
    -- §06 의 Wilson LCB
    SAFE_DIVIDE(
      ctr + 1.96*1.96/(2*total_impressions)
      - 1.96 * SQRT(ctr*(1-ctr)/total_impressions + 1.96*1.96/(4*total_impressions*total_impressions)),
      1 + 1.96*1.96/total_impressions
    ) AS wilson_ctr
  FROM ctr_14d
),
ranked AS (
  SELECT
    city_id,
    product_type,
    offer_id,
    wilson_ctr,
    ROW_NUMBER() OVER (
      PARTITION BY city_id, product_type
      ORDER BY wilson_ctr DESC
    ) AS rank
  FROM wilson_ctr
)
SELECT * FROM ranked WHERE rank <= 50
```

**관찰**: §06 의 Wilson LCB 을 그대로 사용 — 학습 자산 재활용.

### 4-3. ctr-best 의 한계

- ❌ Position bias — 위에 노출된 것이 자동 CTR ↑
- ❌ Selection bias — 노출 자체가 과거 모델 결정 (§01 §6-1)
- ❌ Long-term 효과 무시 — click 후 만족도/retention 무관

→ **IPW (Inverse Propensity Weighting, 역경향성 가중치)** 보정이 이상적 (Phase 7 §17). 하지만 운영 복잡 → 산업은 단순 CTR + Wilson LCB 가 default.

---

## 5. resale-best — 재구매 시그널

### 5-1. Loyalty 신호

```
resale_score(offer) = unique_users_with_repeat_purchase(offer)
```

같은 사용자가 같은 상품을 **2번 이상 구매** 한 횟수.

**왜 강력한 시그널인가**:
- 1회 구매는 충동 / 광고 영향 / 시즌 일회성 가능
- 2회 구매는 **품질 검증된 신호** — 만족했기에 다시 구매
- LTV (Lifetime Value, 생애 가치) 와 직접 상관

### 5-2. 도메인별 resale 의미

| 도메인 | 재구매 의미 | resale-best 가치 |
|---|---|---|
| **호텔 (단기)** | 여행 좋아한 도시 재방문 | 중간 (지역 의존) |
| **액티비티** | 같은 액티비티 재이용 (반복 가치) | 높음 |
| **장기 숙박** | 거주지 재예약 | 매우 높음 |
| **항공권** | 같은 노선 재이용 | 통근/출장 |

### 5-3. resale-best 의 단점

- ❌ 신상품 cold-start 가장 심함 (재구매 데이터 자체 없음)
- ❌ 데이터 sparse — 대부분 사용자가 한 상품 한 번만 구매
- ❌ 시간 누적 필요 (최소 6개월~1년)

→ resale-best 는 **다른 score 와 결합** 해서 사용. 단독 ranking 은 부적합.

---

## 6. stb — Section Preference + MAB 진화

### 6-1. stb (Section preference) 의 본질

여행 앱 메인 페이지의 섹션:
- "오늘의 추천 호텔"
- "지금 인기 액티비티"
- "이번 주말 추천 여행"
- ...

각 섹션이 사용자에게 임프레션 → 사용자가 어느 섹션을 클릭/스크롤하느냐 측정.

```
stb_score(section, user) = clicks(section, user) / impressions(section, user)
```

사용자별로 어떤 섹션을 좋아하는지 학습.

### 6-2. 기본 stb 의 한계

```
사용자 A: 섹션 [호텔, 액티비티, 항공] 노출
   → A 는 호텔만 클릭 → stb 가 학습
   → 다음 노출도 호텔 위주
   → A 는 액티비티 본 적 없음 (모델이 노출 안 해줬으니까)
   → vicious cycle (악순환): exploration 부족
```

이게 §01 §6-1 의 **selection bias** 의 직접 발현. 사용자가 좋아할 수도 있는 액티비티를 영원히 못 만남.

### 6-3. MAB (Multi-Armed Bandit) 의 등장

해결책: **MAB 로 exploration / exploitation 균형**.

```
MAB 비유:
   슬롯머신 N대 (= 추천 섹션 N개)
   각 머신의 진짜 reward (= CTR) 모름
   목표: 시도하면서 best 머신을 찾는 동시에 reward 최대화
   
   순수 exploitation: empirical best 만 계속 → 다른 머신 발견 못 함
   순수 exploration: 균등 시도 → empirical reward 손실
   최적: 균형 (e.g., Thompson sampling)
```

**MAB 알고리즘 3종** (#19 §42-44 cross-ref):
- **Epsilon-greedy**: 90% 시간 empirical best, 10% 시간 random
- **UCB (Upper Confidence Bound)**: empirical mean + 신뢰구간 상한
- **Thompson Sampling**: Bayesian posterior 에서 sample → 그 sample 의 best 선택

### 6-4. Thompson Sampling — Bayesian 의 자연스러운 응용

§06 의 Bayesian smoothing 이 직접 연결:

```
각 section 의 click rate 를 Beta(α, β) 로 모델링
   α = success count + prior α₀
   β = failure count + prior β₀

매 노출 시:
   1. 각 섹션에서 Beta(α, β) 분포에서 한 번 sampling
   2. 가장 높은 sample 의 섹션을 노출
   3. click/no-click 으로 α 또는 β 업데이트

장점:
   - posterior 가 확실한 섹션은 sample 도 확실 (best 라면 거의 항상 best 선택)
   - posterior 가 불확실한 섹션은 sample 변동 큼 (가끔 best 로 sampling 됨)
   → 자동 exploration / exploitation 균형
```

### 6-5. stb → MAB 진화 시나리오

산업 카탈로그의 stb 는 **단순 empirical CTR 기반** 이지만, 진화 후보:

**Phase 1: 현재 stb**
```
stb_score = clicks / impressions
```
→ vicious cycle 문제.

**Phase 2: + Wilson LCB**
```
stb_score = wilson_lcb(clicks, impressions)
```
→ 적은 노출 섹션 보수적 하향. exploration 여전히 부족.

**Phase 3: Thompson Sampling 도입**
```
매 노출 시 Beta(clicks+α, impressions-clicks+β) 에서 sample → 그 sample 로 ranking
```
→ 자동 exploration. vicious cycle 해소.

**Phase 4: Contextual Bandit (LinUCB / Neural Bandit)**
```
사용자 context (device, time, location) 도 input
→ 사용자별 다른 section preference 자동 학습
```
→ 개인화 + exploration 통합.

**산업 진화 경로**: 대부분 추천 시스템이 Phase 2 (Wilson LCB) 단계. Thompson sampling 도입은 광고/MAB 산업에서 시작해서 일반 추천으로 확산 중.

---

## 7. 산업 코드 — Thompson Sampling for stb

### 7-1. Python 구현

```python
import numpy as np

class ThompsonSampler:
    """
    Beta-Binomial Thompson Sampling for section preference (stb).
    
    각 section 의 click rate 를 Beta(alpha, beta) 로 모델링.
    """
    def __init__(self, n_sections: int, alpha_prior: float = 1.0, beta_prior: float = 10.0):
        self.alpha = np.full(n_sections, alpha_prior)  # success counts
        self.beta = np.full(n_sections, beta_prior)    # failure counts
    
    def select(self) -> int:
        """샘플링으로 섹션 선택"""
        samples = np.random.beta(self.alpha, self.beta)
        return int(np.argmax(samples))
    
    def update(self, section: int, clicked: bool):
        """관측 후 업데이트"""
        if clicked:
            self.alpha[section] += 1
        else:
            self.beta[section] += 1
    
    def expected_ctr(self) -> np.ndarray:
        """posterior 평균"""
        return self.alpha / (self.alpha + self.beta)
    
    def confidence(self) -> np.ndarray:
        """posterior 분산 (불확실성)"""
        n = self.alpha + self.beta
        return (self.alpha * self.beta) / (n*n * (n+1))


# 사용 예
sampler = ThompsonSampler(n_sections=5)

for impression in range(10000):
    section = sampler.select()
    clicked = simulate_user(section)  # 사용자 응답
    sampler.update(section, clicked)

print("Final CTR estimates:", sampler.expected_ctr())
print("Confidence (1 - variance):", 1 - sampler.confidence())
```

### 7-2. Contextual Bandit (Phase 6 §13 의 Two-Tower 와 결합)

```python
class ContextualThompsonSampler:
    """
    사용자 feature 를 추가로 사용하는 contextual bandit.
    Two-Tower (Phase 6) 의 user embedding 을 context 로.
    """
    def __init__(self, user_dim: int, n_sections: int):
        # 각 section 별 linear regression coefficients (Bayesian)
        self.n_sections = n_sections
        self.A = [np.eye(user_dim) for _ in range(n_sections)]  # precision matrices
        self.b = [np.zeros(user_dim) for _ in range(n_sections)]
    
    def select(self, user_vec: np.ndarray) -> int:
        """user_vec context 에서 best section 선택"""
        samples = []
        for s in range(self.n_sections):
            mu = np.linalg.solve(self.A[s], self.b[s])
            cov = np.linalg.inv(self.A[s])
            theta = np.random.multivariate_normal(mu, cov)
            samples.append(theta @ user_vec)
        return int(np.argmax(samples))
    
    def update(self, section: int, user_vec: np.ndarray, reward: float):
        self.A[section] += np.outer(user_vec, user_vec)
        self.b[section] += reward * user_vec
```

이게 **사용자별 맞춤 stb** — Phase 6 의 Two-Tower 와 결합 가능.

---

## 8. 흔한 함정 7가지

| # | 함정 | 실제 |
|---|---|---|
| 1 | "시즌성 = 1년 통계 평균" | 1년 평균은 시즌 신호 희석. 예약일 ±7일 sliding window 가 표준. |
| 2 | "Trip Home 의 도메인 cross 를 raw score 비교" | 도메인별 분포 다름. Rank Normalization 후 결합. |
| 3 | "ctr-best 의 단순 CTR 이 ranking 으로 충분" | Position bias + Selection bias. Wilson LCB + IPW 보정 필요. |
| 4 | "resale-best 를 단독 ranking 으로" | sparse data + cold-start 가장 심함. 다른 score 와 결합 필수. |
| 5 | "stb 의 vicious cycle 무시" | exploration 부족 → 사용자가 다른 섹션 영원히 못 봄. MAB 도입 가치. |
| 6 | "MAB 는 학술적, 산업 적용 어려움" | Thompson sampling 은 단순 (Beta 분포 sampling 한 줄). 광고 / 동영상 추천 산업 표준. |
| 7 | "sba ±7일이 모든 도메인에 맞다" | 스키 시즌은 ±14일도 OK, 일일 마감 액티비티는 ±3일. 도메인별 튜닝. |

---

## 9. 꼬리 질문 (§26 면접 카드 후보)

1. **시즌성 추천에서 sliding window 가 long-term 평균보다 우월한 이유는?**
   - 답: long-term 평균은 시즌 신호를 희석. ±7일 sliding window 가 "같은 시즌" 의 정의를 명시. 단, 단기 변동에 노이즈 큼 → sba + long-term 평균 결합 (`α × seasonal + (1-α) × long_term`) 이 산업 표준.

2. **Trip Home 의 도메인 cross 통합 ranking 의 핵심 기법은?**
   - 답: Rank Normalization. raw score (호텔 popularity vs 액티비티 popularity) 비교는 도메인 분포 차이로 함정. 각 도메인 내에서 rank → 0~1 정규화 후 가중 합산. Min-Max / Z-score 도 가능하지만 outlier robust 한 rank 가 default.

3. **ctr-best 가 Wilson LCB 결합이 필요한 이유는?**
   - 답: empirical CTR 만 쓰면 적은 노출 아이템 (§02 §10, §06 §1) 의 거짓 1.0 CTR 함정. Wilson LCB 로 보수적 보정 후 ranking. 추가로 position bias / selection bias 도 있어서 IPW 가 이상적이지만 복잡 → Wilson LCB 가 산업 default.

4. **resale-best 가 단독 ranking 으로 부적합한 이유는?**
   - 답: 재구매 데이터 sparse (대부분 사용자가 한 상품 한 번만 구매). 신상품 cold-start 가장 심함. 다른 score 와 가중 결합 또는 specific 카테고리 (장기 숙박, 반복 액티비티) 에만 적용.

5. **stb 의 vicious cycle 이 MAB 로 해결되는 메커니즘은?**
   - 답: stb 의 empirical CTR ranking 은 사용자가 본 적 없는 섹션을 영원히 노출 안 함 (selection bias). Thompson sampling 은 Beta posterior 에서 sampling 으로 자동 exploration — 불확실한 섹션이 가끔 best 로 sampling 되어 노출 → 학습. exploration/exploitation 균형.

6. **Thompson sampling 이 Epsilon-greedy / UCB 보다 우월한 이유는?**
   - 답: (1) Bayesian posterior 사용 → 자연스러운 uncertainty 표현. (2) Hyperparameter 적음 (UCB 의 c, epsilon-greedy 의 ε 같은 튜닝 불필요). (3) 산업 검증 — 광고 / 동영상 추천에서 가장 좋은 성능. 단, Beta-Binomial conjugate 같은 분포 가정 필요.

7. **Contextual Bandit 이 일반 MAB 보다 추천에 적합한 이유는?**
   - 답: 사용자 feature (device, time, history) 를 context 로 사용 → 사용자별 다른 best section. 일반 MAB 는 모든 사용자에게 같은 best 가정 (현실에 안 맞음). Contextual bandit + Two-Tower 의 user embedding 결합이 차세대 추천 표준.

---

## 10. cross-ref

| 주제 | 연결된 study |
|---|---|
| Wilson LCB / Bayesian smoothing | §06 (ctr-best, stb 의 보정 기법) |
| MAB · Thompson Sampling · UCB | **#19 §42-44** (이미 학습한 자산 직접 활용) |
| Position bias / Selection bias | §01 §6 (counterfactual problem) |
| 행동 가중합 popularity | §05 (sba, ctr-best 의 popularity source) |
| Time decay | §05 §4-2 (sba 의 시즌 윈도우는 cliff 형태 decay) |
| Rank Normalization | Phase 9 §19 (A/B 메트릭 결합) |
| Two-Tower context | Phase 6 §13 (Contextual Bandit 의 user embedding) |
| IPW (Inverse Propensity Weighting) | Phase 7 §17 (cold-start 와 함께 deep-dive) |
| 광고 입찰 MAB | 산업 사례 (Thompson sampling 가장 큰 사용처) |
