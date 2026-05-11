---
parent: 19-search-engine
seq: 43
title: MAB 알고리즘 비교 — ε-greedy / UCB1 / Thompson / LinUCB / Neural Bandit
type: deep
created: 2026-05-12
related:
  - 10-reranking-cross-encoder-ltr.md
  - 35-field-value-factor-modifiers.md
  - 42-bayesian-beta-thompson.md
  - 44-msa-bandit-grounding.md
sources:
  - private session — MAB 정렬 개념 설명
  - https://tor-lattimore.com/downloads/book/book.pdf (Bandit Algorithms — Lattimore & Szepesvári)
---

# 43. MAB 알고리즘 비교

> §42 가 "왜 분포(Beta) + 샘플링(TS) 이 통하는가" 의 원리라면, 본 파일은
> "탐색(exploration) 을 어떻게 만들 것인가" 의 알고리즘 카탈로그.

## 1. 한 줄 핵심

> **모든 MAB (Multi-Armed Bandit, 멀티 암드 밴딧) 알고리즘은 결국 한 가지 결정** — "다음 트래픽을
> 어디에 쓸 것인가" 를 푸는데, exploration 을 만드는 방식이 다르다.
> ε-greedy=균등랜덤, UCB1=결정적 보너스, Thompson=확률적 샘플링, LinUCB=문맥 결합, Neural=비선형 결합.

## 2. 공통 문제 정의

K 개 arm(상품), 각 arm 의 진짜 보상(CTR / CVR / 클릭당 매출) 은 미지수. 매 라운드 t 마다:

1. arm 하나(또는 top-K) 선택
2. 보상 관측 (클릭/구매 여부)
3. 통계 업데이트

목표: T 라운드 누적 보상 최대화 ↔ **regret (= 최적 arm 대비 손실)** 최소화.

trade-off 한 줄:

> "지금 잘 되는 arm 을 활용(exploit) 하면서, 미래의 좋은 arm 을 탐색(explore) 한다."

## 3. ε-greedy ("엡실론 그리디")

### 3-1. 동작

```
매 라운드:
    if rand() < ε:
        random_arm()             // 균등 랜덤 탐색
    else:
        argmax(mean_reward)      // 활용
```

### 3-2. 특성

- 가장 단순 — 10 줄로 구현 가능
- exploration 비율이 **ε 고정 상수** (typical 0.05 ~ 0.20)
- 변형: `ε-decreasing` (시간 지날수록 ε 감소)

### 3-3. 약점

- **탐색이 멍청** — 명백히 나쁜 arm 도 동일 확률로 노출됨
- regret 가 시간에 선형 (Θ(T)) — 이론 최적(Θ(log T)) 보다 나쁨
- ε 튜닝이 도메인 의존

### 3-4. 언제 쓰나

- arm 수 ≤ 수십, 학습 데이터 거의 없는 초기 부트스트랩
- "코드 단순성" 우선의 PoC
- 운영 검증 없는 신규 서비스

## 4. UCB1 (Upper Confidence Bound)

### 4-1. 공식

```
UCB(arm) = mean_reward(arm) + c × √( ln(N_total) / n_arm )
                              └─────── exploration bonus ───────┘
```

- `n_arm` 작음 (덜 시도된 arm) → 두 번째 항 크게
- `N_total` 증가 → 보너스 천천히 증가 (`ln`)
- `c` 는 탐색 강도 (보통 √2 또는 1)

### 4-2. 직관

> "평균이 같으면 데이터 적은 쪽이 더 매력적이다. 시간이 갈수록 그 매력은 줄어든다."

### 4-3. 특성

- **결정적** — 같은 통계면 늘 같은 선택. flicker 없음
- Hoeffding inequality 기반 — regret O(log T) 보장
- 평균 + 보너스 두 컴포넌트로 분리 → 디버깅/설명 쉬움

### 4-4. 약점

- prior 결합이 어색 — 보너스가 "분포" 가 아니라 "한 숫자" 라 empirical Bayes 와 자연 결합 ❌
- `c` 튜닝 민감
- delayed reward (클릭이 노출 한참 후 발생) 에 약함

### 4-5. 변형

- **UCB-V** — 분산까지 고려
- **KL-UCB** — KL divergence 기반, Bernoulli 도메인에 더 강함
- **Bayesian UCB** — posterior 의 quantile 사용 (TS 와 결정적/확률적 차이만)

## 5. Thompson Sampling

§42 에서 풀어쓴 그 알고리즘. 요약:

```
α  =  clicks + priorAlpha
β  =  impressions − clicks + priorBeta
sample ~ Beta(α, β)
rank by sample
```

### 5-1. 강점

- **이론** — Bayesian regret O(log T), frequentist 도 UCB 와 동등
- **prior 결합 자연스러움** — empirical Bayes 직결
- **광고/추천 산업 표준** (Microsoft, Yahoo, LinkedIn 의 다수 논문)

### 5-2. 약점

- 매 요청 sampling → flicker 가능 → session cache 필요
- 디버깅이 직관 어려움 (확률적 결정)
- 분포 가정 (Bernoulli, Gaussian) 이 깨지면 보정 필요

## 6. Contextual Bandit — LinUCB

기존 MAB 는 모든 사용자/세그먼트를 동일하게 봄. 현실은 다름:

```
사용자 X(20대 남성)  → arm A (액티비티) 가 좋음
사용자 Y(40대 가족)  → arm B (리조트) 가 좋음
```

### 6-1. LinUCB 동작

feature 벡터 `x ∈ ℝ^d` (사용자 × arm × 시간 등) 가정.

```
예측 CTR:           μ_arm = x^T · θ_arm
uncertainty:        s_arm = √( x^T · A_arm^(-1) · x )
                    A_arm = Σ x x^T (관측 누적, ridge regression)
선택:              argmax_arm  (μ_arm + α × s_arm)
```

업데이트:

```
A_arm   += x x^T
b_arm   += reward × x
θ_arm    = A_arm^(-1) · b_arm
```

### 6-2. 특성

- arm 마다 작은 ridge regression 모델
- d 가 작으면 (~10) 매우 효율적
- exploration 은 UCB 와 동일 — `s_arm` 보너스
- arm 추가/제거에 비교적 강함

### 6-3. 약점

- 선형 가정 — 비선형 관계는 못 잡음 → Neural Bandit 로
- arm 수 폭발 시 메모리 (각 arm 마다 A, b)
- feature engineering 필요

### 6-4. Hybrid Linear (LinUCB-Hybrid)

```
arm-specific feature  +  shared feature (모든 arm 공통)
```

→ 신규 arm (자기 데이터 없음) 이 shared 로 부트스트랩.

## 7. Neural Bandit

LinUCB 의 비선형 확장. arm × context → 보상 매핑을 DNN 으로.

- **Deep Bayesian Bandit** — BNN posterior 에서 sampling (TS 의 신경망 버전)
- **NeuralUCB** — DNN gradient 기반 uncertainty 추정
- **BootstrapDQN** — 여러 DNN 의 disagreement = exploration

YouTube, TikTok, 대형 광고 시스템에서 사용.

### 7-1. 약점

- 학습 비용 + 운영 복잡도
- exploration 보장이 이론 약함 (실증적으로 잘 됨)
- "explainability" 거의 0

## 8. 비교표

| 축 | ε-greedy | UCB1 | Thompson | LinUCB | Neural |
|---|---|---|---|---|---|
| 탐색 방식 | 균등 랜덤 | uncertainty bonus | posterior 샘플링 | LinUCB bonus | DNN posterior |
| 결정적/확률적 | 확률 | 결정 | 확률 | 결정 | 둘다 |
| context 결합 | ❌ | ❌ | △ (arm 별) | ✅ (선형) | ✅ (비선형) |
| 이론 regret | Θ(T) | O(log T) | O(log T) | O(√(dT log T)) | 약함 |
| 구현 난이도 | 1 | 2 | 3 | 4 | 5 |
| 디버깅 | 1 | 2 | 4 | 4 | 5 |
| prior/empirical Bayes | ❌ | △ | ✅ | △ | △ |
| 신규 arm 부트스트랩 | △ | △ | ✅ | △ (hybrid) | ✅ |
| 운영 표준 산업 | 작은 서비스 | 중규모 | 광고/추천 | 추천 | 초대형 |

## 9. ES `gauss(created_at)` decay 와 다시 비교

| 축 | ES decay | MAB 일반 |
|---|---|---|
| 입력 | 시간 (`created_at`) | 클릭/노출/문맥 |
| 학습 | 없음 (mapping 고정) | 있음 (online) |
| exploration | 없음 | 있음 |
| 신상품 처리 | "최신이면 boost" | "확신 약하면 가끔 실험" |
| 운영 비용 | 매우 낮음 | 중간 ~ 높음 |

→ 보완 관계 — `gauss` 는 신상품 seed boost, MAB 는 실측 기반 미세 조정. **함께 쓰는 것이 표준**.

## 10. Hybrid Score — ML Ranker × MAB

실무에서 단일 알고리즘만 쓰는 경우는 드물다.

### 10-1. 표준 파이프라인

```
[Retrieve] BM25 + filter + vector (Hybrid)         (§07 §09)
     ↓
[Stage-1 rank] function_score                     (§06 §35)
     ↓
[Stage-2 rank] LTR / LambdaMART (오프라인 학습)    (§10)
     ↓
[Stage-3 rerank] MAB (Thompson)                   (§42 §43, top-N)
     ↓
[Business rule] 광고 boost / 카테고리 균형         (§10)
```

### 10-2. 점수 결합 방식

```
final = w₁ × esNorm(es_score)
      + w₂ × ltr_score
      + w₃ × sample~Beta(...)
```

- w₁ + w₂ + w₃ = 1 (또는 자유 가중)
- 가중 비율을 A/B 로 결정

### 10-3. Cascade 패턴

- Stage-1 비싼 모델 ❌ → 후보 100~1000 추림
- Stage-2 LTR 미세 결정 → 100
- Stage-3 TS rerank → 20
- 비용 ↓ + 품질 ↑

## 11. 운영 튜닝 카탈로그

### 11-1. Prior (Thompson 전용)

- 글로벌 default: `Beta(1, 9)` (CTR 10% 가정)
- 카테고리별 override: `Beta(catCtr × k, (1−catCtr) × k)`
- `k` = prior 강도 — 작을수록 실측이 빠르게 prior 를 덮음

### 11-2. Exploration 강도

| 알고리즘 | 노브 | 효과 |
|---|---|---|
| ε-greedy | ε | 큼 → 탐색 ↑ |
| UCB1 | `c` | 큼 → 탐색 ↑ |
| Thompson | prior `k` | 작음 → 분포 넓음 → 탐색 ↑ |

추가 패턴: `sample^temperature` — temperature > 1 이면 격차 축소(탐색 ↑).

### 11-3. Decay (시간 감쇠)

```
effectiveClicks      = clicks × exp(−λ × ageDays)
effectiveImpressions = impressions × exp(−λ × ageDays)
```

- 트렌드 변동 큰 도메인(여행/패션) → λ 크게 (반감기 ~7일)
- 안정적 도메인 → λ ≈ 0

### 11-4. Impression Threshold

- `impressions < threshold` (예: 50) → prior 만 사용
- 1~2 노출에 첫 클릭으로 폭주하는 noise 방지

### 11-5. Flicker 방지

- session cache: 같은 `(userId|sessionId, query)` 면 N 초간 동일 sample
- top-N 만 TS, 나머지는 결정적 순서 유지
- "위치별 sampling" 으로 1~3 위만 보존

### 11-6. Position Bias

- 위에 있을수록 클릭률 ↑ (관련도와 무관)
- 보정: **IPW (Inverse Propensity Weighting)** — 클릭을 `1 / P(노출 | 위치)` 로 가중
- Phase 3 도입 후보

## 12. 알고리즘 선택 의사결정 트리

```
arm 수 ≤ 50 + 트래픽 작음
  └ ε-greedy 또는 작은 UCB1 — PoC 빠르게

arm 수 100~수천 + 클릭 풍부 + context 없음
  └ Thompson — 운영 표준

arm 수 동일 + 사용자 context 활용 가능
  └ LinUCB (or Thompson + context feature)

arm 수 만 ↑ + 비선형 + 인프라 풍부
  └ Neural Bandit (단 ROI 사전 검증)

arm 수 폭발 + 데이터 풍부 + 안정 도메인
  └ LTR (LambdaMART) — 오프라인 학습 우선, MAB 는 rerank top-N 만
```

## 13. 면접 한 줄 답변

### Q. ε-greedy 와 UCB1 의 본질 차이는?

> "ε-greedy 는 ε 확률로 균등 랜덤 — 명백히 나쁜 arm 도 동일 확률로 노출됩니다. UCB1 은 결정적이며
> 데이터 적은 arm 에 `√(ln N / n)` 보너스를 줍니다. ε-greedy 는 regret 가 시간에 선형, UCB1 은 O(log T)."

### Q. Thompson Sampling 이 광고/추천에서 선호되는 이유는?

> "prior 결합이 자연스럽고(Beta-Bernoulli conjugate), 분포 자체가 exploration 강도를 정해서 별도
> 튜닝 노브가 적습니다. Microsoft / Yahoo 의 산업 논문이 LinUCB 대비 동등 이상의 실증 성능을 보고했고,
> 코드는 Beta sampling 한 줄이라 운영도 간결합니다."

### Q. LinUCB 와 Thompson 차이는?

> "LinUCB 는 context feature 의 선형 결합 + UCB 보너스로 **결정적** 선택, Thompson 은 posterior 에서
> **확률적** 샘플링입니다. context 가 명확하면 LinUCB, prior 가 명확하면 TS — 실무는 둘을 결합해
> 'context 별 Beta posterior + 샘플링' 도 흔합니다."

### Q. MAB 와 LTR (LambdaMART) 의 관계는?

> "직교축입니다. LTR 은 오프라인 학습 — judgment list 로 nDCG 최적화. MAB 는 온라인 학습 —
> 실시간 클릭으로 분포 업데이트. 표준 파이프라인은 retrieve → function_score → LTR → MAB rerank
> 순으로 cascade 합니다."

### Q. flicker 가 뭐고 어떻게 방지하나요?

> "TS 가 매 요청마다 새로 sampling 해서 같은 사용자에게 다른 순위가 나오는 현상입니다. session cache
> (같은 query 60s 같은 샘플), top-N 만 TS 적용, 위치별 부분 sampling 으로 mitigation 합니다."

## 14. 흔한 오해 정정

> **"MAB 는 ML 보다 우월하다"**

⚠ — 직교. LTR / cross-encoder 와 결합이 표준. 단독 비교는 잘못된 frame.

> **"Thompson 은 ε-greedy 의 개선판이다"**

⚠ — 둘은 다른 원리. ε-greedy 는 평균 + 랜덤, TS 는 분포 + 샘플링.

> **"LinUCB 가 Thompson 보다 정확하다"**

⚠ — context 가 강하면 그렇고, 약하면 반대. 도메인 검증 필요.

> **"MAB 만으로 ranking 끝낼 수 있다"**

❌ — retrieval / Stage-1 ranker 부실하면 MAB 가 살릴 수 없음. 후보가 좋아야 한다.

> **"explore 비율이 높을수록 좋다"**

❌ — 과탐색은 사용자 경험 저하. regret 곡선이 안 좋아짐. 도메인 별 sweet spot.

> **"UCB 의 `c` 값 늘리면 exploration 강화"**

✅ — 단 너무 크면 결정적 + 늘 데이터 적은 arm 선호로 노이즈 폭증.

## 15. 회독 체크리스트

> §43 회독 체크리스트:
> - [ ] ε-greedy / UCB1 / Thompson 의 exploration 메커니즘 차이 한 줄로 답
> - [ ] regret 의 시간 복잡도 (선형 vs log) 의미
> - [ ] LinUCB 의 ridge regression 업데이트 직관
> - [ ] Contextual Bandit 의 hybrid feature (arm-specific + shared)
> - [ ] gauss decay 와 MAB 의 직교성
> - [ ] Cascade 파이프라인 — retrieve → function_score → LTR → MAB
> - [ ] 운영 노브 6종 (prior / 탐색강도 / decay / threshold / cache / position bias)
> - [ ] 알고리즘 선택 트리 — 도메인별 권장

## 16. 다음 학습

- §44 — msa 의 ThompsonReranker 구현 + Redis state + Kafka 흐름 grounding
- §10 — LTR (LambdaMART) 와 cascade
- §35 — function_score modifier (결정적 saturation) 와 비교
- §34 — nDCG@k / MRR / CTR 평가 메트릭 (MAB A/B 평가)
