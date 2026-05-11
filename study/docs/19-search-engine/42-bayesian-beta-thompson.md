---
parent: 19-search-engine
seq: 42
title: Bayesian update + Beta(α,β) + Thompson Sampling — 원리
type: deep
created: 2026-05-12
related:
  - 06-tf-idf-bm25-scoring.md
  - 10-reranking-cross-encoder-ltr.md
  - 35-field-value-factor-modifiers.md
  - 43-mab-algorithms.md
  - 44-msa-bandit-grounding.md
sources:
  - private session — MAB 정렬 개념 설명
  - https://en.wikipedia.org/wiki/Conjugate_prior
  - https://en.wikipedia.org/wiki/Thompson_sampling
---

# 42. Bayesian update + Beta(α,β) + Thompson Sampling — 원리

> 본 파일은 §10 (Re-Ranking) 의 **오프라인 학습 트랙** 과 직교하는 **온라인 학습 트랙** 의 출발점.
> §43 에서 MAB (Multi-Armed Bandit, 멀티 암드 밴딧) 알고리즘 비교, §44 에서 msa 코드 적용으로 이어진다.

## 1. 한 줄 핵심

> **Beta 분포는 "CTR (Click-Through Rate, 클릭률) 평균" 이 아니라 "CTR 이 어디쯤일 가능성이 높은지" 를
> 두 숫자(α, β) 로 표현하는 함수**, Thompson Sampling 은 그 분포에서 **매 요청마다 랜덤 샘플**을
> 뽑아 ranking 한다.
> Beta-Bernoulli 가 conjugate prior 라서 업데이트가 `clicks += 1` / `impressions += 1` 두 카운터로 끝난다.

## 2. 일반 CTR 정렬의 한계

```
상품    클릭    노출    CTR
A      100    1000    10%
B      1      2       50%
```

CTR 만 보면 B 승. 하지만 B 는 **데이터가 2개뿐** — 진짜 CTR 이 1% 일 수도, 80% 일 수도 있다.
즉 평균은 같아도 **확신 정도(uncertainty, 불확실성)** 가 완전히 다르다.

```
상품    클릭/노출    평균CTR    확신
B      1/2          50%       매우 약함
C      500/1000     50%       매우 강함
```

CTR 한 숫자만 저장하면 이 차이를 **표현 자체가 불가능** — 정통 function_score 가 부딪히는 벽.

## 3. Bayesian 사고 — Posterior

베이지안 추론은 한 줄로:

> 새로운 데이터를 볼 때마다 **믿음(belief) 을 확률적으로 업데이트** 한다.

```
Prior (사전 믿음)  +  Data (관측)  →  Posterior (사후 믿음)
```

베이즈 정리:

```
P(θ | D) = P(D | θ) × P(θ) / P(D)
         ∝ Likelihood × Prior
```

여기서 θ = "이 상품의 진짜 CTR", D = 관측된 클릭/미클릭 시퀀스.

### 3-1. 동전 예시

- Prior: "동전은 보통 공정함" — `P(앞=0.5)` 근처가 가장 그럴듯.
- Data: 앞앞앞앞앞앞 (6연속 앞).
- Posterior: "이 동전 이상한데?" — `P(앞)` 가 0.5 보다 큰 쪽으로 이동.

→ 데이터가 더 들어오면 분포가 좁아지면서 한 점으로 수렴.

### 3-2. CTR 에 그대로 적용

- θ = 상품의 진짜 CTR (0~1 사이 미지수)
- D = 클릭/미클릭 Bernoulli 시퀀스

베이지안은 θ 를 **확률변수** 로 본다. 일반 통계는 점추정(point estimate, `clicks/impressions`) 으로 끝.

## 4. Beta 분포 — Bernoulli 의 Conjugate Posterior

### 4-1. 정의

```
Beta(α, β):  f(x) = x^(α−1) (1−x)^(β−1) / B(α, β),   x ∈ [0, 1]
```

두 숫자 α, β 만으로 `[0,1]` 구간의 확률분포 모양이 결정된다.

- α(alpha): "성공(클릭) 누적" 느낌
- β(beta): "실패(미클릭) 누적" 느낌

### 4-2. 직관 — 그림

```
density
  ↑
  │     Beta(50, 50)         Beta(500, 500)
  │       ⌃                     ⌃
  │      /│\                  /│\
  │     / │ \                /│\
  │    /  │  \              ─┘ └─
  │  Beta(1,1)            (좁고 뾰족)
  │  ────────────  (균등, 아무것도 모름)
  └────────────────────────────────→ x (CTR 후보)
   0          0.5                 1
```

| 파라미터 | 분포 형태 | 의미 |
|---|---|---|
| `Beta(1,1)` | 균등(0~1 모두 동등) | 아무 정보 없음 — uninformative prior |
| `Beta(2,1)` | 오른쪽 치우침 | 1 성공 0 실패 — "CTR 이 좀 높을 듯" |
| `Beta(1,2)` | 왼쪽 치우침 | 0 성공 1 실패 — "CTR 이 좀 낮을 듯" |
| `Beta(50,50)` | 0.5 중심, 넓음 | 평균 50%, 데이터 적당 |
| `Beta(500,500)` | 0.5 중심, 매우 좁음 | 평균 50%, 데이터 많음 — 확신 강함 |
| `Beta(100,900)` | 0.1 근처에 좁게 | CTR ≈ 10% 라고 강하게 믿음 |

### 4-3. 평균과 분산

```
E[X]  = α / (α + β)
Var[X] = αβ / [(α+β)² × (α+β+1)]
```

α+β 가 커질수록 분산이 작아진다 — **데이터가 많아질수록 분포가 좁아진다는 직관**과 정확히 일치.

### 4-4. Conjugate — 왜 Bernoulli 와 궁합인가

베이지안 일반은 posterior 계산이 적분으로 어렵다. 그런데 Bernoulli/Binomial 의 likelihood 가 Beta 의
prior 형태와 **동일한 항** (`x^a (1−x)^b`) 을 가져서, 곱하면 다시 Beta 가 된다.

```
Prior:       Beta(α₀, β₀)
Likelihood:  Bernoulli(x)^k × (1−x)^(n−k)   (n번 중 k번 성공)
Posterior:   Beta(α₀ + k, β₀ + (n − k))
```

즉 **데이터가 들어올 때마다 α 에 클릭 수를, β 에 미클릭 수를 더하면 끝**. 적분 없음.

이 성질을 **conjugate prior (켤레 사전분포)** 라고 한다 — 베이지안의 "마법 같은 trick" 의 핵심.

### 4-5. 누적 업데이트

```
초기:               Beta(1, 1)            ← 아무 정보 없음
클릭 1회 발생:        Beta(2, 1)            ← α += 1
미클릭 1회:          Beta(2, 2)            ← β += 1
미클릭 1회:          Beta(2, 3)
클릭 1회:           Beta(3, 3)
...
n번 중 k번 성공 시:    Beta(1 + k, 1 + n − k)
```

> 흔한 오해: "클릭 발생이면 Beta(2,1) 이다." 는 **첫 클릭 직후** 의 상태일 뿐.
> 같은 첫 클릭이라도 그 전 누적 상태가 `Beta(50, 100)` 이었다면 클릭 후는 `Beta(51, 100)` 이다.

## 5. Thompson Sampling

### 5-1. 동작

각 arm(상품) 에 대해:

```
α  =  clicks + priorAlpha
β  =  impressions − clicks + priorBeta
sample ~ Beta(α, β)         // 매 요청마다 새로 뽑음
```

샘플값 큰 순서로 정렬.

### 5-2. 왜 exploration 이 자동 발생하는가

```
상품 A:  Beta(101, 901)     → 샘플 거의 0.09 ~ 0.11 사이만 나옴 (좁음)
상품 B:  Beta(2, 2)         → 샘플 0.05 도, 0.85 도 가끔 나옴 (넓음)
```

A 는 분포가 좁아 늘 비슷한 점수, B 는 분포가 넓어 **가끔 매우 높은 샘플** 이 나온다. 즉

- 데이터가 많아 확신이 강한 arm → 평균 근처에서 결정적으로 선택/탈락
- 데이터가 적어 불확실한 arm → 가끔 상위로 진입해 **자동 실험**

이 된다. ε-greedy 처럼 "랜덤" 하지도, UCB 처럼 "보너스를 더해" 주지도 않고, **분포 자체의 폭**이
exploration 강도를 결정한다.

### 5-3. CTR "확대" 가 아닌 이유

자주 듣는 오해: "TS 는 CTR 을 좀 늘려서 점수 계산한다."

❌ — TS 는 평균을 손대지 않는다.

```
평균(A) = 101/1002 ≈ 0.1008
평균(B) = 2/4     = 0.5
```

평균만 비교하면 늘 B 가 이긴다. TS 는 평균이 아니라 **분포 모양** 자체에서 뽑기 때문에, 데이터 많은 A 는
평균 근처로 수렴하고, 데이터 적은 B 는 평균에서 멀리 떨어진 값도 자주 뽑힌다. 결과적으로

- B 가 진짜 좋은 arm 이면 → 높은 샘플이 자주 뽑혀 빠르게 상위 진입 → 클릭 누적 → 분포가 좁아지며 정착
- B 가 사실 나쁜 arm 이면 → 낮은 샘플도 자주 뽑혀 노출 줄어듦 → 자연 탈락

이게 "확률적 explore + 빠른 update" 의 본질.

## 6. ES `gauss(created_at)` decay 와의 본질 차이

| 축 | ES `gauss/exp/linear` decay | Thompson Sampling |
|---|---|---|
| 기반 | 시간 = 결정적 함수 | 클릭/노출 = 확률적 분포 |
| 입력 | `created_at` 만 | clicks, impressions, prior |
| exploration | 없음 (결정적) | 자동 (분포 폭) |
| online learning | 없음 (mapping 시 고정) | 있음 (이벤트마다 posterior 갱신) |
| randomness | 없음 | 매 요청 샘플링 |
| cold-start 신상품 | "최신이면 무조건 boost" | "불확실하니 가끔 실험" |
| 쓰레기 신규 도태 | ❌ (시간이 가야 자연 감쇠) | ✅ (클릭 안 나오면 분포가 즉시 좁아져 탈락) |

→ 둘은 **다른 축** — 같이 써도 무방. `gauss` 는 freshness seed, TS 는 실측 반응 기반 미세 조정.

## 7. Cold-start 와 Prior 튜닝 — Empirical Bayes

`Beta(1, 1)` 은 "아무것도 모른다" — 신규 상품이 클릭 1번만 받아도 `Beta(2, 1)` 으로 평균 0.67 폭주.

실무 해법: **글로벌/카테고리 평균 CTR** 을 prior 로 주입한다.

```
오사카 평균 CTR ≈ 0.10 → Beta(α₀, β₀) = (1, 9)  또는 (5, 45)   // "k" 가 prior 강도
```

- k 작음 (예: (1, 9)) → prior 영향 약함, 실측 데이터로 빠르게 덮임
- k 큼 (예: (50, 450)) → prior 영향 강함, 실측 데이터가 쌓여야 prior 가 흔들림

→ 이게 **empirical Bayes (경험 베이즈)** — "데이터에서 prior 자체를 추정".

## 8. Sparse 도메인 의사결정 가이드

| 상황 | 권장 |
|---|---|
| arm 수 만(10⁴) 이하 + 클릭 풍부 | `Beta(1,1)` prior 도 OK |
| 신규 arm 비율 높음 (이커머스 신상품) | empirical Bayes prior (`Beta(α₀, β₀)`) 필수 |
| 도메인 분할 명확 (카테고리/지역) | bucket 별 prior 분리 |
| 실시간성 약함 (B2B) | TS 보다 LTR 우선 — 정확도 ↑ |
| 트렌드 변동 큼 (여행/패션) | decay (`α, β` × `exp(−λ·age)`) 결합 |

## 9. 실무 저장 형태 — 분포는 저장하지 않는다

가장 흔한 오해: "분포를 저장해야 하니 데이터가 크지 않나?"

❌ — Beta 분포는 **두 숫자(α, β)** 가 모든 모양을 결정한다. 실무에서는 더 작게:

```
Redis hash:  bandit:state:{category}:{product}
             clicks       = 120          // 누적 클릭
             impressions  = 1000         // 누적 노출
             lastTs       = 1747...      // epoch millis
```

posterior 는 **조회 시점에 계산**:

```kotlin
val alpha = clicks + priorAlpha
val beta  = impressions - clicks + priorBeta
val sample = BetaDistribution(alpha, beta).sample()
```

업데이트는 atomic 카운터 두 개 (`HINCRBY clicks 1` / `HINCRBY impressions 1`) 면 끝.

## 10. msa 시사점 — §44 로 이어짐

본 파일은 원리. msa 의 `search` 서비스에 적용한 (categoryId, productId) 단위 reranker / Redis state /
prior 튜닝 / Kafka 흐름은 §44 (msa-bandit-grounding) 에서.

핵심 결정 (ADR-0043):

- arm 키: `(categoryId, productId)` — categoryId 없을 시 `_default_`
- prior: 글로벌 default `(1.0, 9.0)`, 카테고리별 override 가능
- decay: `λ` per day, default 0.02 (반감기 ~35일)
- hybrid: `final = w × esNorm + (1−w) × sample`, w default 0.8
- impression threshold: 50 — 그 미만은 prior 만 사용
- session cache: 60s — flicker 방지

## 11. 면접 한 줄 답변

### Q. Beta 분포가 왜 CTR 모델링에 자연스러운가요?

> "Beta 는 `[0,1]` 구간의 확률을 모델링하고, Bernoulli(클릭/미클릭) 의 conjugate prior 라서
> posterior 계산이 `α += clicks`, `β += impressions − clicks` 두 카운터로 끝납니다. CTR 도 0~1
> 구간이라 도메인이 정확히 일치합니다."

### Q. Thompson Sampling 이 CTR 을 확대한다는 표현이 맞나요?

> "아니오. 평균은 그대로입니다. 분포 폭이 좁으면 평균 근처에서, 넓으면 평균에서 멀리도 뽑힙니다.
> 데이터가 적은 신규 arm 은 분포가 넓어 가끔 높게 뽑히는 효과로 탐색이 자동 발생합니다."

### Q. ES `gauss(created_at)` decay 와 Thompson 의 차이는?

> "decay 는 결정적 freshness boost — 시간만 보고 클릭 학습은 없습니다. TS 는 확률적 탐색 —
> 실제 반응으로 분포가 좁아지며 자동으로 좋은/나쁜 arm 을 갈라냅니다. 둘은 직교 — 같이 써도 됩니다."

### Q. Beta 분포 자체를 저장해야 하나요?

> "두 숫자(α, β) 만 저장합니다. 더 흔히는 그 원재료인 `clicks`, `impressions`, `lastTs` 를 Redis 에 두고
> 조회 시점에 prior 를 더해 `Beta(α, β)` 를 만듭니다. 함수의 파라미터일 뿐 분포 자체를 직렬화하지 않습니다."

### Q. cold-start 신상품을 어떻게 다루나요?

> "`Beta(1,1)` 은 평균 0.5 라 위험하므로 카테고리/지역 평균 CTR 을 prior 로 주입합니다 (empirical
> Bayes). 평균 CTR 10% 라면 `Beta(α₀, β₀) = (1, 9)` 또는 prior 강도 k 를 키워 `(5, 45)`. 클릭이 쌓이면
> 자연스럽게 실측으로 덮입니다."

## 12. 흔한 오해 정정

> **"분포를 저장해야 하니 무겁다"**

❌ — α, β 두 숫자. 더 흔히는 clicks/impressions 두 카운터.

> **"매 요청 샘플링이 비싸다"**

⚠ — Beta sampling 은 µs 단위. top-N(100) 후보에만 적용하면 무시 가능. 단, 전 상품에 적용은 ❌.

> **"TS 는 평균 CTR 을 올린다"**

❌ — 평균은 그대로. 분포 폭이 탐색 강도를 만든다.

> **"prior 는 `Beta(1,1)` 이 표준이다"**

⚠ — uninformative prior 일 뿐. 신규 arm 많은 도메인은 empirical Bayes 가 사실상 표준.

> **"클릭 0 인 신상품은 영원히 노출 못 받는다"**

❌ — `Beta(prior)` 의 폭이 가끔 높은 샘플을 만든다. 그게 exploration.

> **"베이지안은 항상 더 정확하다"**

⚠ — 데이터 풍부 + 빠른 결정 우선이면 점추정 + LTR 이 ROI 우수. TS 는 sparse / cold-start / 트렌드 변동
영역에서 강함.

## 13. 회독 체크리스트

> §42 회독 체크리스트:
> - [ ] CTR 평균만 저장하면 무엇이 사라지는가 (uncertainty / 분포 폭)
> - [ ] Bayesian 의 Posterior ∝ Likelihood × Prior 직관
> - [ ] Beta(α,β) 의 모양을 6가지 (1,1)/(2,1)/(1,2)/(50,50)/(500,500)/(100,900) 머릿속에 그리기
> - [ ] Conjugate prior — Beta-Bernoulli 가 α += 클릭 / β += 미클릭 으로 끝나는 이유
> - [ ] Thompson Sampling 이 exploration 을 만드는 메커니즘 (분포 폭)
> - [ ] gauss decay vs TS 의 본질 차이 (결정적 freshness vs 확률적 탐색)
> - [ ] empirical Bayes prior — 신규 arm 의 cold-start 방어
> - [ ] 실무 저장 형태 — clicks/impressions 두 카운터로 충분한 이유

## 14. 다음 학습

- §43 — MAB 알고리즘 비교 (ε-greedy / UCB1 / Thompson / LinUCB)
- §44 — msa 의 (categoryId, productId) Thompson Reranker grounding + ADR-0043 매핑
- §10 — 오프라인 학습 트랙 (LambdaMART / cross-encoder) 과의 직교성
- §35 — function_score modifier 가 다루는 또 다른 "saturation" 의 결정적 버전
