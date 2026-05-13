---
parent: 19-search-engine
seq: 45
title: 검색 평가 두 번째 축 — Offline vs Online · Bias 보정 · 3-Tier 파이프라인
type: deep-dive
created: 2026-05-13
updated: 2026-05-13
status: completed
related:
  - 34-eval-metrics-precision-recall-ndcg.md
  - 09-hybrid-search-rrf.md
  - 10-reranking-cross-encoder-ltr.md
  - 15-msa-search-grounding.md
  - 19-improvements.md
  - 42-bayesian-beta-thompson.md
  - 43-mab-algorithms.md
  - 44-msa-bandit-grounding.md
sources:
  - "Joachims et al., 'Unbiased Learning-to-Rank with Biased Feedback', WSDM 2017"
  - "Bottou et al., 'Counterfactual Reasoning and Learning Systems', JMLR 2013"
  - "Schnabel et al., 'Recommendations as Treatments', ICML 2016"
  - "Hofmann et al., 'A Probabilistic Method for Inferring Preferences from Clicks', CIKM 2011 (Interleaving)"
catalog-row: "§F.online-offline-axis · §F.exposure-bias · §F.ips-counterfactual · §F.three-tier-eval · §F.online-metrics-catalog · §F.offline-overfitting"
---

# 45. Offline vs Online · Bias 보정 · 3-Tier 평가 파이프라인

> §34 가 "메트릭 자체의 수식" 이라면 §45 는 **그 메트릭을 어디서 / 어떤 데이터로 / 어떤 위험을 안고 측정하는가** — 평가 파이프라인 그 자체.
> 학습 시간 예상: ~2h · 자가평가 입구 레벨: B+

---

## 1. 한 줄 핵심

> **검색 평가에는 두 개의 직교 축이 있다 — (a) Stage 축: Retrieval(Recall) vs Ranking(Precision/nDCG), (b) Setting 축: Offline(과거 로그) vs Online(실 트래픽).**
> Offline 메트릭 (nDCG / MRR / Recall@K) 은 빠른 iteration 의 proxy, Online 메트릭 (CTR (Click-Through Rate, 클릭률) / CVR (Conversion Rate, 전환율) / GMV (Gross Merchandise Value, 총 거래액)) 은 비즈니스 진실. 둘 사이 gap 은 **position bias / exposure bias / feedback loop** 라는 3종 편향에서 온다. **IPS (Inverse Propensity Scoring, 역경향 스코어링) + 일부 random exploration (5%) + 3-tier 파이프라인 (offline → shadow/interleaving → online A/B → ramp-up)** 이 표준 대응 패턴.

---

## 2. 왜 §34 만으로는 부족한가

### 2-1. §34 의 사각지대

§34 는 "메트릭 정의 + Stage 축" 까지 다룬다:

- Stage 1 후보 생성 → Recall@K
- Stage 2 ranking → nDCG@10 / MRR / Precision@10
- judgment list 만드는 두 갈래 (전문가 라벨 vs 클릭 로그)
- Position bias 와 IPW (Inverse Propensity Weighting, 역경향 가중) 의 존재

빠진 것:

- **Setting 축** — 같은 nDCG@10 이 "어제 로그로 계산한 nDCG" 와 "오늘 라이브 A/B 노출 후 클릭으로 계산한 nDCG" 는 의미가 완전히 다르다.
- **노출 안 된 상품의 학습 부재** — feedback loop. Position bias 와 별개의 더 깊은 문제.
- **3-tier 평가 파이프라인** — Offline → Shadow / Interleaving → Online A/B → Ramp-up. 실무 검색팀의 표준.
- **Online metric 카탈로그 확장** — CTR/CVR 외 GMV / Retention / Bounce / Diversity.
- **Offline overfitting 의 구체적 위험** — popular 편향, diversity 붕괴, 신상품 사망.

본 파일은 이 5 영역을 메운다.

### 2-2. 이 파일을 읽어야 할 사람

- §34 까지 마치고 "그러면 NDCG 가 올랐는데 매출이 안 오르면 왜인가" 가 답이 안 되는 사람.
- §10 LTR (Learning To Rank, 랭킹 학습) 의 IPW 한 줄 언급에서 더 들어가고 싶은 사람.
- §42~§44 MAB (Multi-Armed Bandit, 다중 슬롯 머신) 트랙이 "왜 검색 평가 라인에 들어가는가" 의 연결 고리가 약했던 사람.

---

## 3. 평가의 두 축 — Stage × Setting 2×2 프레임워크

```
                    Setting 축 →
                ┌────────────────────┬────────────────────┐
                │     Offline        │      Online        │
                │  (과거 로그)        │   (실 트래픽)       │
Stage 축 ↓     ├────────────────────┼────────────────────┤
                │                    │                    │
 Retrieval     │ Recall@100 / 1000  │ "검색 결과 없음"    │
 (recall)      │ ANN recall (HNSW)  │  비율, Zero-Hit %  │
                │ latency p95        │ 빈 결과 retry율     │
                │                    │                    │
                ├────────────────────┼────────────────────┤
                │                    │                    │
 Ranking       │ nDCG@10            │ CTR / CVR          │
 (precision)   │ MRR / MAP          │ GMV / AOV          │
                │ Precision@10       │ Retention / Bounce │
                │                    │ Position-1 CTR     │
                │                    │                    │
                └────────────────────┴────────────────────┘
```

### 3-1. 4 분면 의미

| 분면 | 무엇을 답하는가 | 데이터 출처 |
|---|---|---|
| **Offline · Retrieval** | "정답이 후보 안에 살아남았나?" | 과거 클릭/구매 로그 + judgment list |
| **Offline · Ranking** | "과거 행동을 가장 잘 재현하는 순서인가?" | 같은 로그 |
| **Online · Retrieval** | "Zero-Hit (결과 없음) 이 늘었나?" | 실시간 검색 응답 로그 |
| **Online · Ranking** | "이 순서가 실제 매출을 늘리는가?" | A/B 노출 후 사용자 행동 |

### 3-2. 흔한 혼동 — "NDCG = offline only" 가 아니다

NDCG 는 본질적으로 "(query, doc, relevance)" 트리플만 있으면 계산 가능. 그래서:

- **Offline NDCG** — 과거 로그의 클릭/구매를 등급화한 judgment 로 계산.
- **Online NDCG** — A/B 노출 후 사용자가 실제 클릭한 위치 기반으로 즉시 계산 (Position-1 CTR 의 일반화).

본 파일에서 "Offline metric" 이라고 쓸 때는 **과거 로그 기반** 이라는 의미. NDCG 라는 메트릭 자체가 offline 인 게 아니다.

### 3-3. Recall 이 §34 5-1 표와 다른 위치에 있는 이유

§34 5-1 은 "메트릭 → 어느 stage 평가" 의 1:1 매핑.
§45 3 은 "stage × setting" 2D. Recall@K 는 **양쪽 모두 offline 분면에 있지만 retrieval 행** — 즉 두 축이 직교한다는 게 본 파일의 핵심 메시지.

---

## 4. Offline 평가 — 빠른 iteration 의 proxy

### 4-1. 장점

- **싸다** — 컴퓨팅 자원만 필요. 사용자 트래픽 불필요.
- **빠르다** — 모델 50개 비교를 하루에 가능.
- **무위험** — 매출 영향 없음.
- **재현 가능** — 같은 judgment + 같은 쿼리셋이면 결과 동일.

### 4-2. 표준 워크플로우

```
1. test query set 분리 (query-level split, train 과 leak ❌)
2. 각 알고리즘으로 검색 수행
3. judgment 와 비교해 nDCG@10 / MRR / Recall@100 계산
4. paired t-test 로 통계적 유의성 검증
5. 의미 있는 차이만 다음 단계 (Shadow / A/B)
```

### 4-3. judgment 의 두 출처와 한계

| 출처 | 양 | 정확도 | 한계 |
|---|---|---|---|
| 도메인 전문가 라벨링 | ↓ (수백~수천) | ↑ | 비쌈, query intent 다양성 ↓ |
| 클릭/구매 로그 (implicit) | ↑ (수십만+) | ⚠ bias 오염 | position / exposure / feedback loop bias |

### 4-4. graded relevance 등급 — 5단계 표준

§34 8-2 의 "0=노출, 1=클릭, 2=카트, 3=구매" 보다 한 단계 정밀한 5단계 권장:

| relevance | 사용자 행동 | 의미 |
|---|---|---|
| 0 | 노출만 됨 (skip) | 무관 |
| 1 | 클릭 | 관심 |
| 2 | 상세 페이지 30초+ dwell | 약한 의도 |
| 3 | 장바구니 추가 | 강한 의도 |
| 4 | 구매 / 결제 완료 | 완벽 정답 |

→ NDCG 의 `2^rel - 1` 공식과 자연스럽게 맞물려, 구매가 클릭보다 **기하급수적** 으로 큰 보상 (`2^4 - 1 = 15` vs `2^1 - 1 = 1`).

---

## 5. Online 평가 — 비즈니스 진실

### 5-1. 핵심 메트릭 카탈로그

§34 는 CTR / CVR 두 개만 짧게 언급. 실무 검색팀이 실제로 보는 건 다음 7~10 개.

| 메트릭 | 정의 | 무엇을 잡는가 |
|---|---|---|
| **CTR** (Click-Through Rate) | 클릭 수 / 노출 수 | 1차 매력도, 썸네일·제목 영향 큼 |
| **CTR@1** | 1위 결과 클릭률 | 랭킹 품질의 가장 민감한 단일 신호 |
| **Position-K CTR 분포** | k 위치별 CTR | position bias 추정에 사용 |
| **CVR** (Conversion Rate) | 구매 수 / 클릭 수 (또는 / 노출 수) | 실 구매 의도 매칭 |
| **GMV** (Gross Merchandise Value) | 검색 유입 매출 합 | 비즈니스 가치 단일 숫자 |
| **AOV** (Average Order Value) | GMV / 주문 수 | 객단가 — 고가 상품 편향 감지 |
| **Bounce Rate** | 결과 페이지에서 즉시 이탈 비율 | "정답 없음" 신호 |
| **Re-search Rate** | 같은 세션에서 query 재입력 비율 | 첫 검색 실패 신호 |
| **Retention** | N일 후 재방문 / 재검색 비율 | 장기 만족도 |
| **Diversity** (intra-list) | top10 의 카테고리/브랜드 분산 | 단조로움 진단 |
| **Zero-Hit Rate** | 검색 결과 0 건 비율 | retrieval 부실 신호 (online·retrieval 분면) |

### 5-2. North-Star 1 개 + 가드레일 2~3 개 패턴

A/B 의사결정은 **단일 핵심 메트릭 + 가드레일** 로:

```
North-Star: GMV per search session
Guardrail 1: CTR@1 (-5% 이내)
Guardrail 2: Diversity score (-10% 이내)
Guardrail 3: Re-search rate (+3% 이내)
```

→ GMV 가 올라도 diversity 가 무너지면 reject. **시니어 검색 팀의 의사결정 단위는 단일 메트릭이 아니라 다차원 벡터**.

### 5-3. Online 메트릭의 함정

- **CTR ↑ ≠ 검색 품질 ↑** — 낚시 썸네일 / 자극적 카피로 클릭만 늘 수 있음 → CVR 동반 확인 필수.
- **GMV ↑ ≠ 사용자 만족 ↑** — 고가 상품만 노출하면 단기 GMV ↑ 가능, 장기 retention ↓ 위험.
- **Position-1 CTR 만 보면** — 1위 클릭 했는데 30초 후 이탈 (dwell time 측정 필요).

---

## 6. Bias 3종 — Position / Exposure / Feedback Loop

§34 6-3 은 position bias 한 가지만. 실제로는 세 가지가 다른 층위에서 작용한다.

### 6-1. Position Bias (위치 편향)

> "위에 있는 결과가 본질적으로 클릭이 더 많다 — 관련도와 무관하게."

```
실험 데이터 (eye-tracking + click 분포):
  Position 1: CTR 30%
  Position 2: CTR 15%
  Position 3: CTR 10%
  Position 5: CTR 5%
  Position 10: CTR 1.5%
```

- **원인** — 사용자는 위에서부터 보고, 위가 좋을 거라는 사전 신뢰.
- **결과** — 같은 doc 을 위에 두면 클릭 많이, 아래 두면 적게.
- **위험** — 그걸 그대로 학습하면 "위 위치 = 관련도 ↑" 로 학습. **현재 ranking 강화 no-op**.

### 6-2. Exposure Bias (노출 편향)

> "**노출 자체가 안 된 상품은 영원히 학습 데이터에 등장하지 않는다.**"

- Stage 1 retrieval 이 후보 100개 안에 doc X 를 안 넣었다면 → 사용자는 그 doc 을 볼 수 없음 → 클릭/구매 데이터 0 → 다음 모델 학습에서도 관련도 0 → 영원히 retrieval 후보에 못 들어감.
- **신상품 / cold-start item 의 사망** 메커니즘.

position bias 와의 차이:

| 항목 | Position Bias | Exposure Bias |
|---|---|---|
| 발생 위치 | 노출은 됐지만 위치가 낮음 | 노출 자체가 없음 |
| 보정 도구 | IPS (위치별 가중치) | exploration (random injection) |
| 적용 stage | Ranking | Retrieval |
| 가시성 | 클릭 분포로 추정 가능 | 보이지 않음 — 진단 어려움 |

### 6-3. Feedback Loop (피드백 루프)

> "Position 과 Exposure bias 가 결합해 **자기 강화** 한다."

```
시점 t:    랭커가 A 를 1위, B 를 7위에 둠
            → A 클릭 많음, B 클릭 적음
            → 학습: A 관련도 ↑, B 관련도 ↓

시점 t+1: 학습 결과 반영 → A 더 위로, B 더 아래
            → 격차 더 벌어짐
            → 학습: A 더 ↑, B 더 ↓
            ...
```

- **수렴점** — 극소수 상품만 노출, long-tail 사망.
- **사용자 입장** — 늘 비슷한 결과만 보임 → 만족도 정체 / 신선도 ↓.
- **시니어 진단 신호** — top 10 의 carousel 가 매주 거의 동일 / 신규 상품의 30일 노출률 < 1%.

### 6-4. 셋의 관계

```
[랭커가 위치 결정] ──┐
                     │
                     ▼
        ┌──── Position Bias ────┐
        │   (보인 것 중에서)    │
        ▼                        │
   [클릭 데이터]                  │
        │                        │
        ▼                        │
   [다음 모델 학습] ──────────────┘
        │
        ▼
   [노출 정책 변화]
        │
        ▼
   ┌── Exposure Bias ──┐
   │ (애초에 안 보임)   │
   └────────────────────┘
        │
        ▼
   [Feedback Loop] ── 위 사이클이 t → t+1 반복
```

---

## 7. IPS — Inverse Propensity Scoring 의 수식과 직관

### 7-1. 한 줄 정의

> "각 클릭 이벤트에 **노출 확률의 역수** 를 곱해서 위치 편향을 빼는 가중 평균."

### 7-2. 수식

```
weighted_click(d, q) = click(d, q) / propensity(position(d))

LTR loss (IPS-corrected):
  L = Σ_clicked (1 / p_k) × loss(model, d, q)
    where p_k = propensity of position k where d was shown
```

- `propensity(k)` = "사용자가 k 위치를 examine 할 사전 확률". 보통 `p_k = (1/k)^η`, η ≈ 1.
- 1위 클릭 → 가중치 1 / 1.0 = 1.0 (보통)
- 7위 클릭 → 가중치 1 / 0.14 = 7.0 (강하게 보상)
- 결과: **낮은 위치에서 클릭된 doc 은 "어려운 정답" 으로 인정**.

### 7-3. propensity 추정 방법

| 방법 | 설명 | 정확도 | 비용 |
|---|---|---|---|
| **Position-based heuristic** | `1/k` 또는 `(1/k)^η` | ↓ | ↓ |
| **EM (Expectation-Maximization)** | examine vs relevant 잠재변수 추정 | 중 | 중 |
| **Random Swap intervention** | 일부 결과를 무작위 순서로 노출해 위치별 CTR 측정 | ↑ | ↑ (트래픽 일부 희생) |
| **Click model 학습** (PBM / DBN / UBM) | 사용자 클릭 행동 모델링 | ↑↑ | ↑↑ |

### 7-4. IPS 의 한계와 발전

- **High variance** — 낮은 propensity (예: 100 위) 클릭에 가중치 100 → noise 폭발.
- **Clipping** — `p_k = max(p_k, ε)` 로 하한 둠 (예: ε = 0.01 → 최대 가중치 100 cap).
- **Doubly Robust (DR) estimator** — IPS + direct method 결합. variance ↓.
- **Off-Policy Evaluation (OPE)** — counterfactual: "만약 다른 랭킹을 보였다면 CTR 은 얼마였을까" 를 과거 로그로 추정.

---

## 8. Random Exploration — Feedback Loop 깨는 처방

### 8-1. 직관

> "노출 정책에 의도적으로 **랜덤성 5%** 를 섞어, exposure bias 의 사각지대를 채운다."

```
production traffic 100%:
  ├─ 95%: 기존 랭킹 (exploitation)
  └─  5%: 무작위 / 균등 노출 (exploration)
       └─ 이 5% 에서 발생한 클릭이 unbiased judgment 의 source
```

### 8-2. 두 가지 구현 패턴

| 패턴 | 설명 | 대표 알고리즘 |
|---|---|---|
| **Pure Random** | 5% 트래픽에 완전 random ranking 노출 | — |
| **Bandit-driven** | exploitation/exploration 자동 조절 | ε-greedy, UCB1, Thompson Sampling, LinUCB |

→ §42 (Bayesian / Beta / Thompson) 와 §43 (MAB 알고리즘 카탈로그), §44 (msa 적용) 가 이 라인의 본격 deep file.

### 8-3. 왜 MAB 가 검색 평가 라인에 들어오는가

| 시점 | 기술 |
|---|---|
| 검색 결과 보여줄 때 | Stage 1 (BM25 + kNN + RRF) + Stage 2 (LTR / cross-encoder) |
| **그 결과에 일부 exploration 섞을 때** | **Thompson Sampling / ε-greedy** |
| 사용자 행동 받을 때 | clickstream → Kafka |
| **arm posterior 업데이트** | **Beta posterior (§42) / LinUCB (§43)** |
| 다음 검색에 반영 | bandit score 가 `w·esNorm + (1-w)·sample` 형태로 LTR score 와 혼합 (§44) |

→ MAB 는 검색 ranking 자체를 대체하는 게 아니라 **feedback loop 깨는 일부 트래픽 의사결정자**.

### 8-4. exploration 비용

- **단기 CTR ↓** — random 5% 는 정의상 sub-optimal ranking.
- **장기 학습 품질 ↑** — bias 보정된 judgment 확보 → 다음 모델 더 좋아짐.
- **이커머스에서 통상 1~5% 트래픽 할당** — 5% 초과는 매출 손실이 큼.

---

## 9. 3-Tier 평가 파이프라인 — Offline → Shadow → Online → Ramp-up

### 9-1. 4 단계 전체 흐름

```
[Tier 0] 모델 후보 학습
   │  judgment + LTR / cross-encoder 학습
   ▼
[Tier 1] Offline Evaluation
   │  nDCG@10 / MRR / Recall@100
   │  paired t-test
   │  통과 기준: baseline 대비 +X% & p<0.05
   ▼
[Tier 2] Shadow / Interleaving
   │  실 트래픽이지만 사용자에게 영향 없음 / 최소 영향
   ▼
[Tier 3] Online A/B (small)
   │  1~5% 트래픽
   │  핵심 메트릭 + 가드레일 모니터링
   ▼
[Tier 4] Ramp-up
   │  10% → 25% → 50% → 100%
   │  각 단계마다 가드레일 재검증
   ▼
[Production]
```

### 9-2. Tier 2 — Shadow vs Interleaving

| 방식 | 동작 | 사용자 영향 | 신호 강도 |
|---|---|---|---|
| **Shadow traffic** | 새 모델이 실 query 받아 결과 계산하지만, 사용자에겐 기존 결과 노출. 두 결과 차이만 로깅. | 0 (완전 무영향) | ↓ (사용자 행동 없음) |
| **Interleaving** (TDI / Probabilistic Interleave) | 두 모델 결과를 **하나의 list 로 섞어** 노출. 사용자 클릭 위치로 어느 쪽이 이겼는지 측정. | 약간 (혼합 결과) | ↑↑ (A/B 보다 10~100배 적은 트래픽으로 같은 통계력) |

#### 9-2-a. Interleaving 예시

```
모델 A 결과: [d1, d2, d3, d4, d5]
모델 B 결과: [d6, d7, d2, d8, d9]

Team-Draft Interleaving:
  - 동전 던지기로 A 부터 시작
  - 교대로 한 개씩 pick (중복 제거)
  - 노출: [d1(A), d6(B), d2(A), d7(B), d3(A), d8(B), ...]

클릭 발생: d6, d7
  → B 가 2점, A 가 0점 → B 우세
```

- **장점** — 같은 사용자 같은 query 안에서 직접 비교 → 사용자 분산 noise 제거.
- **한계** — 일부 검색 UX (광고 / personalize) 와 충돌. interleaving 후 후처리 룰 적용 시 신호 오염.

### 9-3. Tier 3 — A/B Test 의 통계 기본기

- **표본 크기** — `n = 16 × (σ/δ)²`. CTR 1% → 0.1pp 차이 잡으려면 query 수 ≥ 수십만.
- **검정** — Welch t-test (분산 다른 두 집단) / 이항분포면 chi-square / 멱등성 보장 시 paired.
- **p-value 함정** — 매일 들여다보고 유의해지면 중단 = **peeking bias**. SPRT (Sequential Probability Ratio Test) / Bayesian A/B 가 대안.

### 9-4. Tier 4 — Ramp-up 패턴

```
1%  (24h)   ← canary, 큰 outage 가드레일만
10% (48h)   ← 통계적 유의성 확보 첫 게이트
25% (72h)   ← 가드레일 (diversity / retention) 정상 확인
50% (1 week)← 장기 retention 신호 시작
100%        ← 전체 ramp
```

- 각 단계 통과 기준은 **사전 정의** (의사결정 자동화).
- 단계 사이 ≥ 24h 권장 — daily seasonality 흡수.

### 9-5. Tier 별 메트릭 매핑

| Tier | 메트릭 | 의사결정 단위 |
|---|---|---|
| 1 Offline | nDCG@10 / MRR / Recall@100 | ML 엔지니어 |
| 2 Shadow | A vs B 결과 차이 비율 / 후보 overlap | ML 엔지니어 + 검색 PM |
| 2 Interleaving | wins / losses ratio | 검색 PM |
| 3 A/B small | CTR / CVR / Bounce + 가드레일 | 검색 PM + Growth |
| 4 Ramp-up | GMV / Retention / Diversity | Growth + 사업 |

---

## 10. Offline overfitting — 메트릭만 보고 갔다 망하는 패턴

§34 6-7 은 "메트릭만 보고 UX 무시" 한 줄. 구체적 실패 모드 5종:

### 10-1. Popular item 편향 강화

- LTR 이 popularity feature 에 과적합 → 인기 상품이 top10 을 도배.
- Offline nDCG ↑ (인기 상품 = 클릭 데이터 많음 = 라벨 풍부 = 학습 잘 됨).
- Online: long-tail 사망 / discovery ↓ / retention ↓.

### 10-2. Diversity 붕괴

- 같은 카테고리 / 같은 브랜드 상품 5+ 개가 top10 점령.
- nDCG 는 카테고리 분산 무시 → 메트릭 ↑, 사용자는 단조롭다고 인지.
- 대응: intra-list diversity loss / MMR (Maximal Marginal Relevance) post-processing.

### 10-3. 신상품 사망

- 신상품은 클릭/구매 로그 0 → judgment relevance 0 → 학습에서 음의 신호처럼 작동.
- 대응: cold-start prior / exploration / freshness feature.

### 10-4. Position bias 강화

- IPS 없이 학습 → 위 위치 = 관련도 학습 → 현재 ranking 모방.
- offline nDCG 좋아 보이지만 본질적으로 no-op.

### 10-5. Test set leakage

- query-level split 안 함 → 같은 query 의 doc 들이 train/test 양쪽 → 비정상적으로 ↑.
- nDCG 0.95 같은 비현실적 숫자 → 의심 신호.

---

## 11. msa 적용 가이드

### 11-1. 현재 상태 (§15 / §44 grounding)

- `analytics` 서비스 (Kafka Streams + ClickHouse) — 클릭/구매 로그 수집 인프라 존재.
- `experiment` 서비스 — A/B 테스트 플랫폼 (구현 상태는 CLAUDE.md 의 service 표 참조).
- `recommendation` 서비스 — Phase 3 Two-Tower + Phase 4 Wide & Deep (ADR-0046/0047) — LTR 라인은 있음.
- ADR-0043 (search bandit) — Thompson Sampling 기반 일부 트래픽 exploration. §44 deep file.

### 11-2. 빠진 인프라

1. **judgment table** (graded relevance 0~4) — clickstream → 5단계 등급 mapping 의 ETL.
2. **IPS propensity 추정** — position-based heuristic 부터 시작 → 점진적으로 click model.
3. **Shadow traffic infra** — 새 search 알고리즘이 실 트래픽 받지만 응답 무시.
4. **Interleaving** — search API 가 두 알고리즘 결과를 받아 TDI 로 섞는 layer.
5. **Diversity / freshness / re-search 메트릭** — analytics 에서 daily 집계 + Grafana 대시보드.
6. **Ramp-up 자동화** — experiment 서비스의 traffic ratio 게이트 + 가드레일 자동 abort.

### 11-3. 단계별 도입 제안

```
Phase 1 (judgment infra)
  └─ analytics → clickstream events → graded relevance (0~4) mapping
  └─ test query set sampling (top 1000 + long-tail 1000)

Phase 2 (offline pipeline)
  └─ ES _rank_eval 일배치 (nDCG@10 / MRR / Recall@100)
  └─ Grafana 대시보드 + baseline 추적

Phase 3 (online metric catalog)
  └─ CTR / CVR / GMV / Bounce / Re-search / Diversity / Zero-Hit
  └─ North-Star (GMV per search session) + 가드레일 3종 정의

Phase 4 (Tier 2 shadow + interleaving)
  └─ search 서비스에 dual-algorithm 노출 인프라
  └─ interleaving 결과 클릭 로깅 + win-rate 측정

Phase 5 (IPS + exploration)
  └─ position-based propensity 추정
  └─ LTR loss 에 IPS 가중치 통합 (Phase 3 candidate of ADR-0043)
  └─ exploration 트래픽 5% 분리 (§44 Thompson Sampling 과 통합)

Phase 6 (ramp-up 자동화)
  └─ experiment 서비스의 traffic ratio 자동 ramp-up
  └─ 가드레일 위반 시 자동 rollback
```

### 11-4. ADR 후보

> **ADR-XXXX: 검색 평가 파이프라인 — 3-tier evaluation + IPS + exploration loop break**
>
> 결정 후보:
> - judgment 등급 0~4 통일 (§45 4-4)
> - North-Star = GMV per search session, 가드레일 = CTR@1 / Diversity / Re-search
> - Tier 2 에 interleaving (TDI) 도입
> - LTR 학습에 IPS-clipped loss (clip ε=0.01)
> - exploration 트래픽 5% (Thompson Sampling, §44 와 통합)
> - Ramp-up 자동화 (1% → 10% → 25% → 50% → 100%, 단계당 24h)

→ §19-improvements 의 search 품질 ADR 라인에 본 항목 추가.

---

## 12. 면접 한 줄 답변 모음

### Q. Offline NDCG 와 Online CTR 의 관계는?

> "Offline NDCG 는 과거 로그 기반의 빠르고 싼 proxy 입니다. 양의 상관관계는 있지만 100% 매핑되지 않습니다. NDCG 가 올라도 popular 편향 / diversity 붕괴 / 신상품 사망으로 online CTR/GMV 가 떨어질 수 있어, North-Star + 가드레일 + 3-tier 파이프라인이 필요합니다."

### Q. Position bias 와 Exposure bias 의 차이는?

> "Position bias 는 노출은 됐는데 위치가 낮아서 클릭이 안 된 경우 — IPS 로 위치별 가중치 보정합니다. Exposure bias 는 노출 자체가 안 된 경우 — random exploration 또는 bandit 으로 일부 트래픽을 의도적으로 random/exploration 에 할당해 깨야 합니다. 두 가지가 결합해 feedback loop 가 됩니다."

### Q. IPS 의 수식과 직관을 설명해 보세요.

> "`weighted_click = click / propensity` 입니다. 1위 클릭은 가중치 1, 7위 클릭은 가중치 약 7 — 낮은 위치에서 발생한 클릭을 '어려운 정답' 으로 강하게 보상합니다. propensity 는 보통 `(1/k)^η` heuristic 으로 시작해, 정밀해지면 random swap intervention 또는 click model 로 추정합니다. variance 폭발 방지 위해 clipping (ε=0.01) 필수."

### Q. Interleaving 이 A/B 보다 우월한 점은?

> "같은 사용자가 같은 query 안에서 두 모델 결과를 동시에 보기 때문에 사용자 분산 noise 가 제거됩니다. A/B 와 비교해 10~100배 적은 트래픽으로 같은 통계력을 확보할 수 있어, 짧은 iteration 에 유리합니다. 단점은 광고/개인화 후처리 룰과 충돌할 수 있어 모든 검색 UX 에서 가능한 건 아닙니다."

### Q. Feedback loop 를 어떻게 깰까요?

> "노출 자체가 안 된 doc 은 평가 데이터가 없으니 random exploration (보통 5% 트래픽) 또는 Thompson Sampling 같은 bandit 으로 일부 트래픽을 의도적으로 비-greedy 노출에 할당합니다. 단기 CTR 일부 손실이 있지만 unbiased judgment 와 신상품 discovery 가 회복되어 장기 retention 이 개선됩니다."

### Q. Ramp-up 을 왜 단계적으로 하나요?

> "1% canary 는 outage 위험만 잡고, 10% 에서 통계적 유의성 첫 확인, 25%/50% 에서 가드레일 (diversity / retention / bounce) 정상 확인, 100% 가 전체 적용입니다. 각 단계 ≥24h 권장 — daily seasonality 흡수. 가드레일 위반 시 자동 rollback 게이트가 핵심입니다."

### Q. North-Star 메트릭 하나만 보면 안 되는 이유는?

> "단일 메트릭은 over-optimize 위험이 큽니다. GMV 만 보면 고가 상품 도배 → diversity 붕괴 → 장기 retention ↓. North-Star (예: GMV per search session) + 가드레일 2~3개 (CTR@1, Diversity, Re-search rate) 의 다차원 벡터로 의사결정 합니다."

---

## 13. 흔한 오해 정정

> **"NDCG 가 올랐으면 검색 잘하는 거다"**

- ❌ Offline NDCG ↑ 와 Online GMV ↑ 는 다른 layer. Popular/Diversity 함정 5종 (§10) 점검 필수.

> **"Position bias 만 보정하면 충분하다"**

- ⚠ IPS 는 노출된 doc 의 위치 문제만 해결. Exposure bias (애초에 안 보임) 는 별도 — exploration 필요.

> **"A/B 가 가장 강력하므로 항상 A/B 만 쓴다"**

- ❌ A/B 는 비싸고 느리고 위험. 모든 후보를 A/B 로 거르면 iteration 속도 ↓. Offline → Shadow/Interleaving → A/B 의 깔때기가 표준.

> **"Random exploration 은 매출 손실이라 안 함"**

- ⚠ 단기 손실 vs 장기 학습 품질 trade-off. 1~5% 면 매출 영향 미미, judgment 품질·신상품 discovery·retention 회복 효과가 큼.

> **"Interleaving 은 사용자한테 이상해 보일 것"**

- ⚠ TDI 는 두 좋은 list 의 ranked union 이라 보통 인지 불가. 단 후처리 룰 (광고/diversity) 와 충돌 가능.

> **"GMV 만 보면 된다, 비즈니스가 진실이다"**

- ❌ 단일 메트릭 함정. North-Star + 가드레일 2~3개.

> **"Bandit 은 추천 시스템 이야기지 검색이랑 무관하다"**

- ❌ §42~§44 에서 보듯 검색 ranking 의 exploration layer 로 직결. Feedback loop 깨는 표준 도구.

---

## 14. 연결 학습

- §34 — 메트릭 자체의 수식·정의 (본 파일이 그 메트릭을 어떤 setting 에서 측정하는가의 축을 확장)
- §10 §5-4 — LTR judgment 와 position bias 의 간단 언급 (본 파일 §6 §7 이 풀어 씀)
- §15 — msa 의 analytics → judgment 파이프라인 grounding
- §19-improvements — 검색 품질 ADR 라인의 본 항목 추가 후보
- §42 — Bayesian / Beta / Thompson Sampling 의 수학 토대
- §43 — MAB 알고리즘 카탈로그 (ε-greedy / UCB / LinUCB)
- §44 — msa bandit 적용 (ADR-0043) — 본 파일의 exploration 트랙 실 구현

---

## 15. 회독 체크리스트

> §45 회독 체크리스트:
> - [ ] Stage × Setting 2×2 프레임워크 4 분면 의미
> - [ ] graded relevance 5 단계 (0=노출 ~ 4=구매) 와 `2^rel-1` 의 매핑
> - [ ] Online metric 11종 카탈로그 + North-Star + 가드레일 패턴
> - [ ] Position / Exposure / Feedback Loop 3 bias 의 차이와 보정 도구 매핑
> - [ ] IPS 수식 `click/propensity` 와 propensity 추정 4가지 방법
> - [ ] Clipping (ε=0.01) 이 IPS variance 폭발 막는 이유
> - [ ] Random exploration 5% 가 feedback loop 깨는 메커니즘
> - [ ] MAB (Thompson Sampling) 가 검색 평가 라인에 들어오는 위치 (§44 와 통합)
> - [ ] 3-tier 파이프라인: Offline → Shadow / Interleaving → Online A/B → Ramp-up
> - [ ] Interleaving (TDI) 가 A/B 보다 10~100배 효율적인 이유
> - [ ] Offline overfitting 5종 (popular / diversity / 신상품 사망 / position 강화 / test leak)
> - [ ] msa 의 Phase 1~6 도입 단계
