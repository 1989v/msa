---
parent: 20-recommendation-modeling
seq: 19
title: 추천 평가 — Online/Offline metrics, A/B 설계, MAB (Thompson sampling)
type: deep
created: 2026-05-12
---

# 19. 추천 평가 — A/B + 메트릭 + MAB

> **Phase 9 단일 파일**. §01 §6 에서 미뤘던 "A/B 가 추천의 유일한 신뢰 평가" 의 deep-dive. Offline/Online 메트릭, A/B 설계, MAB exploration.

---

## 1. Offline 메트릭 — Hill-Climbing 보조

### 1-1. Recall@K — Retrieval 평가

```
Recall@K = (Top-K 안에 들어간 진짜 positive) / (전체 진짜 positive)
```

예: test set 에서 사용자가 클릭한 영상 100개. 모델이 Top-10 추천 — 그 안에 12개 일치 → Recall@10 = 12/100 = 0.12.

**용도**: Retrieval 모델 (Two-Tower) 평가. "후보군 안에 좋은 거 들어갔는가."

### 1-2. NDCG@K (Normalized Discounted Cumulative Gain)

```
DCG@K = Σ_{i=1..K} (rel_i / log_2(i+1))
   rel_i: position i 의 아이템의 relevance (0 or 1, 또는 rating)

IDCG@K = 최선의 정렬 시 DCG (sort by relevance descending)

NDCG@K = DCG@K / IDCG@K  ∈ [0, 1]
```

**해석**: 위쪽 위치의 정확도에 더 큰 가중치. Recall 보다 정렬 순서 중요.

**용도**: Ranking 모델 평가. "Top-K 의 순서가 진짜 선호도 순서와 일치하는가."

### 1-3. MAP (Mean Average Precision)

```
AP@K = (1/|positives|) × Σ_{i=1..K} (precision@i × rel_i)
MAP@K = mean(AP@K) across all users
```

Precision 의 가중 평균. 산업에서는 NDCG 보다 덜 사용.

### 1-4. AUC (Area Under ROC Curve)

```
AUC = P( score(positive) > score(negative) )
```

**해석**: 무작위 positive 와 negative 를 골랐을 때 positive 의 score 가 더 높을 확률.

**용도**: Ranking model 의 일반 평가. CTR prediction 표준.

### 1-5. Offline 메트릭의 한계 (§01 §6-1 재확인)

```
함정 1: Counterfactual — 모델이 노출 안 한 item 은 라벨 없음
함정 2: Position bias — 위에 노출된 item 의 click 이 본질 가치와 무관
함정 3: Selection bias — 학습 데이터 자체가 과거 모델의 출력
함정 4: Long-term effect 측정 불가
```

→ Offline 메트릭은 **방향성 + 빠른 hill climbing** 용도. 최종 결정은 online A/B.

---

## 2. Online 메트릭 — 비즈니스 가치

### 2-1. Top-line 메트릭

| 메트릭 | 정의 | 비즈니스 의미 |
|---|---|---|
| **CTR** | clicks / impressions | 사용자 관심 유발 |
| **CVR** | conversions / clicks | 구매 의도 변환 |
| **GMV** | Σ (price × purchases) | 매출 직결 |
| **AOV** | Average Order Value | 객단가 |
| **Sessions per User** | 세션 수 / 사용자 수 | 재방문 |
| **Retention (DAU/WAU/MAU)** | 활성 사용자 비율 | 장기 만족 |

### 2-2. Diversity 메트릭

추천이 너무 좁아지면 filter bubble. 측정:

```
Intra-list diversity = avg pairwise distance between items in Top-K
Category diversity = unique categories in Top-K / K
```

**중요**: Diversity 만 추구 → relevance 손실. Trade-off 균형 필요.

### 2-3. Novelty / Serendipity

- **Novelty**: 사용자가 본 적 없는 새로운 item 의 비율
- **Serendipity**: 의외성 — 사용자가 기대 못 한 좋은 발견

측정 어려움 — 사용자 survey 필요. 추천 시스템의 장기 만족도 핵심.

### 2-4. Dwell Time / Watch Time

- 추천한 item 에서 사용자가 머문 시간
- 클릭만 보면 click bait 함정 — dwell time 으로 보완

---

## 3. A/B 테스트 설계

### 3-1. 가설 설정

```
H0 (null): 새 모델 A 와 기존 모델 B 의 CTR 차이 없음 (μ_A = μ_B)
H1 (alternative): 차이 있음 (μ_A ≠ μ_B)

α (유의수준): 0.05 (5% false positive 허용)
β (검정력의 보충): 0.2 (20% false negative 허용)
power = 1 - β = 0.8
```

### 3-2. 표본 크기 계산

```
n = (z_{α/2} + z_β)² × 2σ² / δ²

   z_{0.025} = 1.96
   z_{0.2} = 0.84
   σ²: 메트릭의 분산
   δ: 측정하려는 최소 효과 (MDE — Minimum Detectable Effect)
```

예시 (CTR baseline 5%, MDE 1%):
```
σ² = 0.05 × 0.95 = 0.0475
δ = 0.01
n = (1.96 + 0.84)² × 2 × 0.0475 / 0.01² = 7.84 × 0.095 / 0.0001 ≈ 7,448 / group
```

**즉 그룹당 ~7500 사용자** 필요. 노출 수 × CTR 5% → impressions ~ 150,000 / group.

### 3-3. 실험 기간

```
하루 트래픽 1만 사용자 → 그룹당 5000 (50:50 split)
필요 7500 → 1.5일 이상

실제 권장: 1주~2주 (요일 변동 흡수)
```

### 3-4. Statistical Power 의 함정

```
실험을 일찍 멈춤 → underpowered → false negative (좋은 모델 놓침)
필요 표본 못 채우고 결정 → 의미 없는 결과
```

산업 표준: **실험 시작 전 sample size 계산 + 도달 전까지 결과 안 봄 (peeking 금지)**.

### 3-5. Multiple Testing 보정

10개 변경 동시 실험 → 5%×10 = 50% 의 잘못된 positive 가능. Bonferroni 보정:

```
α_adjusted = α / n_tests = 0.05 / 10 = 0.005
```

또는 FDR (False Discovery Rate) 통제 (Benjamini-Hochberg).

---

## 4. A/B 실험 인프라 (msa `experiment` 서비스)

### 4-1. 실험 정의

```yaml
experiment_id: rec_two_tower_vs_cb
variants:
  control:
    weight: 50
    algorithm: cb (룰 기반 Category Best)
  treatment:
    weight: 50
    algorithm: two_tower (Phase 6)
metrics:
  primary: ctr
  secondary: [cvr, gmv, dwell_time]
duration: 14 days
min_sample_size: 7500
```

### 4-2. 사용자 할당 (Bucketing)

```python
def assign_variant(user_id, experiment_id):
    hash_input = f"{user_id}-{experiment_id}"
    hash_value = hashlib.md5(hash_input.encode()).hexdigest()
    bucket = int(hash_value, 16) % 100
    
    if bucket < 50:
        return 'control'
    else:
        return 'treatment'
```

**핵심**:
- ✅ Deterministic — 같은 사용자가 같은 그룹
- ✅ Sticky — 실험 중 그룹 안 바뀜
- ✅ Independent — 실험 간 독립 (experiment_id 포함)

### 4-3. 메트릭 수집

```
사용자 노출 → analytics 서비스 → ClickHouse 저장
   {user_id, experiment_id, variant, item_id, action, timestamp}

분석 query:
   SELECT variant, 
          sum(if(action='click', 1, 0)) / sum(if(action='impression', 1, 0)) AS ctr,
          sum(if(action='purchase', 1, 0)) / sum(if(action='click', 1, 0)) AS cvr
   FROM experiment_log
   WHERE experiment_id = 'rec_two_tower_vs_cb'
   GROUP BY variant
```

### 4-4. 통계 검정

```python
from scipy import stats

# 2-proportion z-test (CTR 비교)
control_clicks, control_impressions = 5000, 100000
treatment_clicks, treatment_impressions = 5200, 100000

p_control = control_clicks / control_impressions
p_treatment = treatment_clicks / treatment_impressions

p_pool = (control_clicks + treatment_clicks) / (control_impressions + treatment_impressions)
se = (p_pool * (1 - p_pool) * (1/control_impressions + 1/treatment_impressions)) ** 0.5

z = (p_treatment - p_control) / se
p_value = 2 * (1 - stats.norm.cdf(abs(z)))

print(f"Z = {z:.3f}, p-value = {p_value:.4f}")
# p < 0.05 → 통계적으로 유의
```

---

## 5. MAB — Multi-Armed Bandit Exploration

### 5-1. A/B vs MAB

| | A/B 테스트 | MAB |
|---|---|---|
| 패러다임 | Frequentist | Bayesian (또는 frequentist) |
| 그룹 할당 | 고정 (예: 50:50) | **동적** (좋은 그룹에 더 많이 할당) |
| 목표 | 가설 검정 | 누적 reward 최대화 |
| 학습 | 실험 종료 후 | 실시간 |
| 사용 시나리오 | 큰 변경 (모델 교체) | 작은 변형 (작은 weight 튜닝) |

### 5-2. Thompson Sampling — 산업 표준

§06 §4 + §08 §6 의 Thompson sampling 을 A/B 대체로:

```python
from numpy.random import beta

# 각 variant 의 Beta(α, β) posterior
posteriors = {
    'control': {'alpha': 1, 'beta': 1},      # uniform prior
    'treatment': {'alpha': 1, 'beta': 1},
}

# 매 노출 시
def select_variant():
    samples = {
        name: beta(post['alpha'], post['beta'])
        for name, post in posteriors.items()
    }
    return max(samples, key=samples.get)

# 관측 후 업데이트
def update(variant, clicked):
    if clicked:
        posteriors[variant]['alpha'] += 1
    else:
        posteriors[variant]['beta'] += 1
```

**효과**:
- 좋은 variant 가 점점 더 많이 할당 → reward 누적 ↑
- 나쁜 variant 노출 손실 적음
- 그러나 A/B 의 statistical rigor (p-value) 약함

### 5-3. UCB (Upper Confidence Bound)

Frequentist MAB:
```
UCB(variant) = empirical_mean + c × sqrt( log(t) / n_variant )

t: 총 시도 수
n_variant: variant 의 시도 수
c: exploration parameter (보통 √2)
```

매번 UCB 가장 높은 variant 선택.

### 5-4. Contextual Bandit (LinUCB)

§08 §6-5 의 Contextual Bandit. 사용자 feature 를 context 로:

```
사용자 A → context (device, time, history) → bandit → best variant for A
사용자 B → 다른 context → bandit → different best variant
```

개인화 + exploration 통합.

### 5-5. A/B + MAB 결합 패턴

산업 표준:
1. **Phase 1 (A/B)**: 큰 변경 (새 모델 도입) — A/B 로 통계적 결정
2. **Phase 2 (MAB)**: 세부 튜닝 (weight 조정) — MAB 로 빠른 최적화
3. **Phase 3 (Contextual)**: 개인화 — Contextual Bandit

#19 §42-44 의 MAB 학습 자산이 본 파일에서 활용.

---

## 6. Drift Detection

### 6-1. 3종의 Drift

| 종류 | 정의 | 예시 |
|---|---|---|
| **Data Drift** | input 분포 변화 | 사용자 demographics 변화 |
| **Concept Drift** | y 의 의미 변화 | 같은 행동이 다른 의도 (예: COVID 후 여행 행동 변화) |
| **Feedback Loop Bias** | 모델 출력이 학습 데이터에 영향 | popular item 추천 → 더 popular |

### 6-2. 측정

**Data Drift**: KL divergence, PSI (Population Stability Index)
```
PSI = Σ_i (P_new(i) - P_old(i)) × log(P_new(i) / P_old(i))
   PSI > 0.25 → significant drift
```

**Concept Drift**: Online metrics 변화 모니터링
```
하루 단위 CTR 변동성 ↑ → 모델 가정 변화 의심
```

**Feedback Loop**: Diversity 메트릭 모니터링
```
시간 흐름에 따라 노출 카테고리 분포 좁아짐 → bias
```

### 6-3. 대응

- 정기 재학습 (data drift 흡수)
- 모델 re-architecture (concept drift)
- Forced exploration (feedback loop 보정)

---

## 7. Counterfactual Evaluation — 추천 특유의 평가

### 7-1. 문제

```
새 모델 A 를 production 배포 전에 offline 평가하고 싶음
→ 과거 로그는 기존 모델 B 의 노출 결과
→ A 가 다른 것을 노출했을 거면 어떻게 평가?
```

이게 §01 §6 의 counterfactual problem.

### 7-2. IPS (Inverse Propensity Scoring) Estimator

```
expected_reward(A) = (1/n) Σ_i  (reward_i × P_A(action_i | context_i) / P_B(action_i | context_i))

P_B: 과거 모델 B 의 action 확률
P_A: 새 모델 A 의 action 확률
```

A 가 B 와 같은 action 을 더 자주 했을 거면 weight ↑ — 그 reward 가 의미 있음.

### 7-3. 한계와 보완

- ❌ P_B 추정 어려움 (B 가 deterministic 이면 불가)
- ❌ Variance 큼 (P_A / P_B 비율이 극단)
- 보완: Doubly Robust Estimator (Dudik et al.) — model-based estimator 와 IPS 결합

→ Counterfactual evaluation 은 학술 영역. 산업에서는 **online A/B 가 여전히 정답**.

---

## 8. 흔한 함정 7가지

| # | 함정 | 실제 |
|---|---|---|
| 1 | "Offline 메트릭 좋으면 production 도 좋다" | 30% 이상 격차 흔함. Online A/B 가 유일한 신뢰. |
| 2 | "A/B 실험 일찍 종료 (peeking)" | False positive 증가. Sample size 도달 전까지 결과 보지 말 것. |
| 3 | "Multiple testing 보정 무시" | 10개 실험 동시 → 50% false positive. Bonferroni 또는 FDR 보정. |
| 4 | "CTR 만 보고 결정" | Click bait 함정. CVR / GMV / dwell time / retention 종합. |
| 5 | "Diversity 측정 안 함" | Filter bubble. 장기 retention 손해. |
| 6 | "MAB 가 A/B 완전 대체" | MAB 는 누적 reward 최대화. A/B 는 가설 검정. 큰 변경은 A/B, 세부 튜닝은 MAB. |
| 7 | "Drift detection 안 함" | 시간 흐름에 따라 모델 성능 저하. 정기 모니터링 + 재학습 필수. |

---

## 9. 꼬리 질문 (§26 면접 카드 후보)

1. **Offline 메트릭 (Recall@K, NDCG) 이 production 성능을 보장 못 하는 이유는?**
   - 답: Counterfactual problem — 과거 모델이 노출한 데이터로만 평가. Position bias / Selection bias 포함. Long-term effect (retention) 측정 불가. Offline 은 hill-climbing 보조, 최종 결정은 online A/B.

2. **A/B 테스트의 sample size 계산은?**
   - 답: `n = (z_{α/2} + z_β)² × 2σ² / δ²`. α=0.05, β=0.2 (power 0.8) 가 표준. σ² = baseline metric 분산. δ = MDE (Minimum Detectable Effect). CTR 5% baseline + 1% 효과 측정 → 약 7,500 / group.

3. **Multiple testing 보정의 메커니즘은?**
   - 답: 동시 N개 실험 → 5% × N false positive 가능. Bonferroni — `α' = α/N` (보수적). FDR (Benjamini-Hochberg) — false discovery rate 통제 (덜 보수적). 산업 표준은 FDR.

4. **Thompson Sampling 이 A/B 보다 우월한 시나리오는?**
   - 답: 세부 튜닝 (weight 조정) 같은 작은 변경. 좋은 variant 가 점점 더 많이 할당 → 누적 reward 최대화. 단점 — 통계적 rigor 약함, 큰 모델 변경에는 A/B 가 적합. 산업은 둘 다 운영.

5. **Counterfactual evaluation 의 IPS 방법은?**
   - 답: `(reward × P_new / P_old)` — 과거 모델 P_old 의 노출 데이터로 새 모델 P_new 평가. P_A 가 P_B 와 같은 action 자주 했을 거면 weight ↑. 단점은 variance 큼 + P_B 추정 어려움. Doubly Robust 등 보완.

6. **추천에서 diversity 측정이 중요한 이유는?**
   - 답: Filter bubble 회피. Relevance 만 추구 → 같은 카테고리만 노출 → 장기 retention 손해. Intra-list diversity (pairwise distance) + Category diversity (unique categories / K). Relevance vs Diversity trade-off 균형 필요.

7. **Drift detection 의 3종은?**
   - 답: (1) Data drift — input 분포 변화 (PSI, KL divergence 로 측정). (2) Concept drift — y 의 의미 변화 (online metric 변동성 모니터). (3) Feedback loop bias — 모델 출력이 학습 데이터 영향 (diversity 좁아짐). 대응 — 정기 재학습, re-architecture, forced exploration.

---

## 10. cross-ref

| 주제 | 연결된 study |
|---|---|
| Counterfactual problem | §01 §6 |
| Position bias / IPW | §17 |
| Wilson / Bayesian | §06 |
| MAB / Thompson Sampling | §08 §6, #19 §42-44 |
| msa experiment 서비스 | experiment 서비스 (msa 본 레포) |
| analytics 메트릭 수집 | analytics 서비스 |
| ClickHouse 분석 | §18 |
| Phase 10 A/B 연동 | Phase 10 §25 |
