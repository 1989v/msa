---
parent: 20-recommendation-modeling
seq: 05
title: 행동 가중합 + CTR/CVR/GMV KPI — `100:20:10:1` 비율의 도출, KPI 별 weight 차이, dynamic weight
type: deep
created: 2026-05-12
---

# 05. 행동 가중합 + CTR/CVR/GMV KPI

> **사용자 익숙 영역 — 압축**. `reservation×100 + click×20 + addwish×10 + pageview×1` 패턴 자체는 운영 경험으로 알지만, **이 비율이 왜 산업 표준인가** 와 **KPI 별로 달라야 한다** 는 부분을 deep-dive.

---

## 1. 행동 가중합의 본질 — Prior Knowledge Encoding

추천 시스템에서 가장 흔히 쓰는 score 공식:

```
score(user, item) = Σ_action  w_action × count(action, user, item)
```

각 행동을 그대로 합산하지 않고 **가중치** 를 매기는 이유:
- 페이지뷰 1번 = 구매 1번 의 가치가 아니다
- 노출 → 클릭 → 위시 → 구매 의 funnel 에서 뒤로 갈수록 신호 강함
- 가중치는 **사람이 산업 도메인 지식으로 주입하는 prior**

이게 ML 의 "feature engineering" 의 정신과 같다 — raw count 대신 의미 있는 변환.

### 1-1. 산업 표준 비율 `100 : 20 : 10 : 1`

```
score = reservation × 100
      + click × 20
      + addwish × 10
      + pageview × 1
```

**숫자의 의미** (절대값이 아닌 **비율**):
- 예약 1번의 가치 = 페이지뷰 100번
- 클릭 1번의 가치 = 페이지뷰 20번
- 위시 1번의 가치 = 페이지뷰 10번

### 1-2. 왜 이 비율이 산업 표준이 됐나 — Funnel 변환률 역수

실측 데이터 (여행 OTA 도메인 일반 평균):

```
Funnel 단계        평균 변환률 (다음 단계로 진행)
─────────────────────────────────────────────
pageview          100%       (=1 노출 기준)
→ click           5%~10%     (CTR)
→ addwish         0.5%~2%    (찜률)
→ reservation     0.5%~1.5%  (CVR)
```

비율의 역수가 가중치와 거의 일치:
- pageview → reservation: 약 1/100 → 가중치 100
- pageview → click: 약 1/20 → 가중치 20
- pageview → addwish: 약 1/10 → 가중치 10

**즉 가중치 = "이 행동에 도달한 사용자가 페이지뷰만 한 사용자 N 명의 가치를 갖는다"**. funnel 의 희소성에 비례.

### 1-3. 다른 도메인의 비율 차이

| 도메인 | 가중치 비율 | 이유 |
|---|---|---|
| **여행 OTA** | reservation:click:addwish:pageview = 100:20:10:1 | 예약 funnel 깊음 |
| **e-commerce (저가)** | purchase:cart:click:view = 50:10:5:1 | 구매 funnel 비교적 짧음 |
| **콘텐츠 추천 (YouTube)** | watch_time:like:click:impression = 200:50:5:1 | watch_time 이 가장 강한 signal |
| **SNS 피드** | share:like:comment:view = 100:30:50:1 | share 가 가장 가치 (외부 유입) |
| **음악 스트리밍** | finished:liked:clicked:played = 50:30:5:1 | "끝까지 들음" 이 핵심 |

→ **가중치는 도메인의 funnel 구조에 따라 다름**. 산업 표준 `100:20:10:1` 은 여행 OTA 의 funnel 에서 도출된 것.

---

## 2. KPI 별 Weight 차이 — CTR vs CVR vs GMV

**같은 가중치를 모든 KPI 에 쓰면 안 된다**. 무엇을 최적화하느냐에 따라 가중치가 달라야 한다.

### 2-1. KPI 3종 정의

| KPI | Full Name | 정의 | 비즈니스 의미 |
|---|---|---|---|
| **CTR** | Click-Through Rate (클릭률) | clicks / impressions | 사용자 관심 유발 (top funnel) |
| **CVR** | Conversion Rate (전환률) | conversions / clicks | 구매 의도 변환 (bottom funnel) |
| **GMV** | Gross Merchandise Volume (총 거래액) | Σ (price × purchases) | 매출 직결 |

추가:
- **Retention** — 재방문률, 리텐션 비율
- **LTV** — Lifetime Value (생애 가치)

### 2-2. KPI 별 weight 권장

| KPI 목표 | reservation | click_purchase | addwish | pageview | 이유 |
|---|---|---|---|---|---|
| **CTR 최적화** | 30 | 100 | 20 | 5 | click 자체를 늘리려면 click 가중치 강 |
| **CVR 최적화** | 200 | 30 | 50 | 1 | conversion 자체 (reservation) 강 |
| **GMV 최적화** | 100 × price | 20 | 10 | 1 | reservation 에 가격 곱 (큰 거래 우선) |
| **Retention** | 50 | 20 | 10 | 1 + tenure_bonus | 신규 사용자 weight 추가 |

**핵심**: KPI 가 바뀌면 가중치를 **재설계** 해야 함. 한 번 정한 `100:20:10:1` 을 모든 곳에 쓰면 잘못된 최적화.

### 2-3. KPI 충돌 사례

```
상황: CTR 만 최적화 → 자극적인 썸네일 / 미끼 상품 노출
   결과: CTR ↑ but CVR ↓ (사용자가 클릭해도 구매 안 함)
   GMV: 정체 또는 하락 (long-term retention 도 손상)
```

이게 추천 시스템에서 흔한 함정 — **single KPI 최적화의 함정**. 산업 표준 해결책:
- Multi-objective optimization (Pareto frontier)
- Score = α × CTR_score + β × CVR_score + γ × GMV_score (가중 합산)
- Constrained optimization — CTR 최대화하되 CVR > 1% 보장

> **시니어 백엔드 관점**: 추천 시스템 도입 시 **KPI 정의 가 알고리즘 선택보다 먼저** 다. 무엇을 최적화할지 비즈니스 합의가 없으면 모델 학습 자체가 무의미.

---

## 3. Dynamic Action Weight — lb / urb 의 카테고리별 보정

산업 추천 엔진 카탈로그의 lb (Landmark Best) 와 urb (Urban) 는 `dyn_action_weight` 컬럼을 사용한다 — 정적 weight 가 아닌 **동적 weight**.

### 3-1. 왜 동적이 필요한가

**문제 1: 카테고리별 funnel 차이**

```
호텔:     pageview → click 5%, click → reservation 2% (느린 funnel)
액티비티: pageview → click 8%, click → reservation 5% (빠른 funnel)
패키지:   pageview → click 3%, click → reservation 1% (가장 느린 funnel)
```

→ 호텔과 액티비티에 동일 weight `100:20:10:1` 적용하면 둘 다 부정확.

**문제 2: 시즌별 변동**

```
여름 성수기: click → reservation 4% (CVR 높음)
비수기:      click → reservation 1% (CVR 낮음)
```

→ 같은 click 이 시즌에 따라 다른 가치.

**문제 3: 신상품 effect**

```
신상품 출시: pageview 폭증, click 비례 증가 (호기심)
              but reservation 은 천천히 증가 (사용자 검토 시간)
```

→ 신상품에 일반 weight 적용 시 click 가중치 과대평가.

### 3-2. Dynamic Action Weight 의 BigQuery SQL 패턴

```sql
-- urb 의 동적 가중치 산출 예시
WITH category_funnel AS (
  SELECT
    city_id,
    category_id,
    SUM(reservation_count) / NULLIF(SUM(click_count), 0) AS cvr,
    SUM(click_count) / NULLIF(SUM(pageview_count), 0) AS ctr,
    SUM(addwish_count) / NULLIF(SUM(click_count), 0) AS wish_rate
  FROM offer_action_monthly
  WHERE month = CURRENT_MONTH
  GROUP BY city_id, category_id
),
dynamic_weights AS (
  SELECT
    city_id,
    category_id,
    -- 가중치 = funnel 변환률의 역수
    1.0 / NULLIF(cvr * ctr, 0)         AS w_reservation,
    1.0 / NULLIF(ctr, 0)               AS w_click,
    1.0 / NULLIF(wish_rate * ctr, 0)   AS w_addwish,
    1.0                                AS w_pageview
  FROM category_funnel
)
SELECT
  o.offer_id,
  o.city_id,
  o.category_id,
  -- 동적 가중합
  o.reservation_count * dw.w_reservation
  + o.click_count * dw.w_click
  + o.addwish_count * dw.w_addwish
  + o.pageview_count * dw.w_pageview AS score
FROM offer_action o
JOIN dynamic_weights dw USING (city_id, category_id)
```

**핵심**: weight 가 데이터에서 자동 산출. 사람이 `100:20:10:1` 을 박는 대신 **funnel 변환률의 역수** 를 계산.

### 3-3. 동적 vs 정적 trade-off

| | 정적 weight (cb 계열) | 동적 weight (lb, urb) |
|---|---|---|
| 단순성 | ✅ 매우 단순 | ❌ funnel 계산 추가 |
| 안정성 | ✅ 변동 없음 | ❌ 노이즈 민감 |
| 정확성 | ❌ 카테고리별 부정확 | ✅ 카테고리/시즌 보정 |
| 디버깅 | ✅ 쉬움 | ❌ weight 가 매번 다름 |
| 산업 사용 | 75% (대부분) | 25% (정밀 추천) |

**의사결정**: 정적이 default. 정적이 성능 한계에 부딪힐 때 동적으로 전환.

---

## 4. 행동 가중합의 한계 + 보정 기법

행동 가중합이 산업 표준이지만 명확한 한계가 있다.

### 4-1. 한계 4가지

**한계 1: Popular item bias**
- 인기 아이템은 모든 행동 카운트가 큼 → score 도 큼
- **§02 §4-4 의 cosine bias 와 동일한 문제**

**한계 2: 적은 노출 상품의 점수 불안정**
- 노출 5번, click 1번 → CTR 20% (그러나 신뢰 0)
- **§06 의 Wilson / Bayesian smoothing 으로 보정 필요**

**한계 3: 행동의 의미 손실**
- 클릭 후 1초 만에 뒤로가기 vs 30분 머무름이 같은 click 1
- dwell time, scroll depth 같은 implicit signal 무시

**한계 4: 시간 흐름 무시**
- 1년 전 reservation 과 어제 reservation 이 같은 가치
- time decay 필요

### 4-2. 보정 기법

**보정 1: Time decay (시간 감쇠)**

```
score = Σ_action  w_action × Σ_event  exp(-λ × age_days(event)) × 1
```

오래된 이벤트의 가중치를 지수적으로 감쇠. λ 가 클수록 빠른 망각.

- 콘텐츠 추천 (트렌드): λ 큼 (1일 = 0.5 감쇠)
- 여행 추천 (시즌성): λ 중간 (1주 = 0.5 감쇠)
- 책 추천 (장기): λ 작음 (1개월 = 0.5 감쇠)

**보정 2: Saturation (포화)**

```
score_per_user = log(1 + count(action, user, item))
```

같은 행동 1번 → 5번 → 100번의 가치가 같지 않다 (diminishing returns). log 또는 sqrt 로 saturation.

**보정 3: User normalization**

```
score(user, item) = (raw_score - user_mean) / user_std
```

활발한 사용자의 모든 score 가 큰 것을 보정 (§02 의 Pearson 정신).

**보정 4: Bayesian smoothing (§06 deep-dive)**

```
adjusted_score = (count × score + prior × global_mean) / (count + prior)
```

데이터 적으면 global mean 으로 회귀.

### 4-3. 산업 표준 결합

산업에서 사용하는 **풀 score 공식**:

```
score(user, item, time) 
  = Σ_action  w_action(category, season)             ← dynamic weight
            × log(1 + count(action, user, item))     ← saturation
            × exp(-λ × age_days)                     ← time decay
            × confidence(item)                       ← Bayesian smoothing
```

복잡해 보이지만 각 항이 한 종류의 한계를 보정. Phase 6 §16 의 toy training 에서 이런 보정이 학습 결과에 미치는 영향 측정.

---

## 5. 산업 코드 패턴 — BigQuery SQL

cb (Category Best) 같은 룰 기반 엔진의 산업 표준 SQL 패턴:

```sql
-- 도시 × 카테고리 Top-N 인기 상품 산출
WITH offer_actions_30d AS (
  SELECT
    offer_id,
    city_id,
    category_id,
    SUM(IF(action_type = 'reservation', 1, 0)) AS reservation_cnt,
    SUM(IF(action_type = 'click_purchase', 1, 0)) AS click_cnt,
    SUM(IF(action_type = 'addwish', 1, 0)) AS addwish_cnt,
    SUM(IF(action_type = 'pageview', 1, 0)) AS pageview_cnt
  FROM offer_action_log
  WHERE event_date BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
                       AND CURRENT_DATE()
  GROUP BY offer_id, city_id, category_id
),
scored AS (
  SELECT
    *,
    -- 산업 표준 가중합
    reservation_cnt * 100
    + click_cnt * 20
    + addwish_cnt * 10
    + pageview_cnt * 1 AS score
  FROM offer_actions_30d
  WHERE reservation_cnt + click_cnt >= 5  -- 최소 노출 필터 (§02 §10)
),
ranked AS (
  SELECT
    offer_id,
    city_id,
    category_id,
    score,
    ROW_NUMBER() OVER (
      PARTITION BY city_id, category_id
      ORDER BY score DESC
    ) AS rank
  FROM scored
)
SELECT * FROM ranked WHERE rank <= 20
```

**관찰**:
- 30일 윈도우 — 일종의 time decay (cliff 형태)
- 최소 노출 필터 5 — sparse data 함정 방지
- 도시 × 카테고리 partition — 컨텍스트 분리
- ROW_NUMBER() 로 Top-N — Spark 의 takeOrdered 와 동등

**Phase 10 §22 (msa 룰 기반 CB 구현)** 의 ClickHouse SQL 이 거의 동일한 형태가 될 것.

---

## 6. 흔한 함정 7가지

| # | 함정 | 실제 |
|---|---|---|
| 1 | "`100:20:10:1` 이 모든 도메인에 맞다" | 여행 OTA funnel 에서 도출. e-commerce / 콘텐츠 / SNS 다 다름. |
| 2 | "CTR 만 최적화하면 추천 잘 함" | CTR ↑ but CVR ↓ → 미끼 상품 함정. multi-objective 필수. |
| 3 | "가중치를 한 번 정하면 끝" | KPI 가 바뀌면 가중치도 재설계. 시즌/카테고리도 동적이 정확. |
| 4 | "정적 weight (cb) 가 항상 부족" | 75% 산업 사용. 단순성·안정성 가치. 한계 부딪힐 때 동적 전환. |
| 5 | "행동 count 그대로 합산" | popular item bias + 적은 노출 불안정. saturation + smoothing 필수. |
| 6 | "time decay 없어도 충분" | 시즌성 상품 / 트렌드 콘텐츠에서 큰 손실. exp(-λ × age) 표준. |
| 7 | "가중치를 머신러닝으로 학습" | 가능하지만 prior knowledge 손실 위험. hybrid 가 안전 (rule weight + ML correction). |

---

## 7. 꼬리 질문 (§26 면접 카드 후보)

1. **산업 표준 `100:20:10:1` 비율이 어떻게 도출됐나?**
   - 답: 행동 funnel 변환률의 역수. pageview → click 5%, click → reservation 2-3%, click → addwish 10% 라는 평균값에서 `reservation:click:addwish:pageview = 1/(0.05×0.02) : 1/0.05 : 1/0.10 : 1` ≈ `100:20:10:1`. **funnel 변환률의 역수가 가중치** 라는 통찰.

2. **CTR / CVR / GMV 최적화의 weight 차이는?**
   - 답: CTR — click 가중치 강 (자극적 노출 위험). CVR — reservation 가중치 강 (실제 구매). GMV — reservation × price (큰 거래). 산업 베스트는 multi-objective: `α × CTR + β × CVR + γ × GMV` weighted sum, 또는 constrained optimization (CTR 최대화 + CVR > threshold).

3. **Dynamic action weight 가 정적 weight 보다 우월한 시나리오는?**
   - 답: 카테고리별 funnel 변동률 차이가 클 때 (예: 호텔 CVR 2% vs 액티비티 5%). 시즌별 변동 큰 상품. 신상품 비중 높을 때. 그러나 노이즈에 민감하고 디버깅 어려움 — 75% 산업이 정적 default.

4. **Single KPI 최적화의 함정은?**
   - 답: CTR 만 최적화 → 미끼 상품 / 자극 썸네일 → CTR ↑ but CVR ↓ → GMV 정체 / retention 손상. Long-term effect 측정 어려움. Multi-objective 또는 constrained optimization 필수.

5. **행동 가중합에 time decay 가 필요한 이유는?**
   - 답: 1년 전 reservation 과 어제 reservation 이 같은 가치 아님. 시즌성 상품 (여름 호텔 vs 겨울) 의 신호 손상. `exp(-λ × age_days)` 표준. λ 는 도메인별 — 콘텐츠 빠른 감쇠, 책 추천 느린 감쇠.

6. **최소 노출 필터 (`reservation_cnt + click_cnt >= 5`) 의 정당화는?**
   - 답: 적은 노출 (5번) 에서 score 1.0 cosine 또는 CTR 100% 같은 점수는 통계적으로 의미 없음. **§02 §10** 의 sparse data 함정. 필터로 노이즈 제거 + §06 Wilson/Bayesian 로 점수 보정. 두 단계 결합이 산업 표준.

---

## 8. cross-ref

| 주제 | 연결된 study |
|---|---|
| Popular item bias (cosine bias) | §02 §4-4 (행동 가중합도 동일 문제) |
| Sparse data 함정 + 보정 | §02 §10 + §06 (Wilson / Bayesian smoothing) |
| Time decay + saturation | Phase 6 §16 (toy training 에서 효과 측정) |
| Multi-objective optimization | Phase 9 §19 (A/B 테스트 메트릭 설계) |
| Dynamic weight BigQuery SQL | §04 §3-4 (lb/urb 운영 패턴) |
| msa 룰 기반 CB 구현 | Phase 10 §22 (ClickHouse SQL — 동일 패턴) |
| KPI 정의 비즈니스 합의 | §01 §6 (A/B 가 유일한 신뢰 평가) |
