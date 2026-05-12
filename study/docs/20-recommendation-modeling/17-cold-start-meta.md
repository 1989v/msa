---
parent: 20-recommendation-modeling
seq: 17
title: Cold-start 3축 + 메타/스코어 보정 — 신규 유저/상품/도시 fallback, IPW, mr/c2dp/union-stay-score
type: deep
created: 2026-05-12
---

# 17. Cold-start + 메타/스코어 보정

> **Phase 7 단일 파일**. 추천 시스템의 cold-start 문제 3축 (신규 유저/상품/도시) 와 fallback 전략. 산업 메타 시스템 (mr/c2dp/union-stay-score) 의 정체. Position bias 보정 (IPW).

---

## 1. Cold-start 문제 — 정의와 영향

### 1-1. 3가지 cold-start

**1. New User Cold-start**
- 신규 가입자 — 행동 이력 없음
- CF 불가 (공출현 데이터 없음)
- Two-Tower 의 user embedding 학습 안 됨

**2. New Item Cold-start**
- 신상품 출시 — 노출/클릭 없음
- 행동 가중합 0
- CF 의 sim matrix 에 없음

**3. New Context / Domain Cold-start**
- 새 도시 / 카테고리 진출
- 도시별 인기 데이터 부족

### 1-2. 왜 cold-start 가 추천의 핵심 문제인가

- 매일 신규 사용자 + 신상품 발생
- cold-start 못 풀면 **악순환** — 신상품 노출 안 됨 → 데이터 없음 → 영원히 추천 안 됨
- 비즈니스 우선순위 — 신상품 launch 가 큰 매출 기회

### 1-3. 해결 원칙 — 다층 Fallback

```
정확한 개인화 (Two-Tower / DLRM) — 데이터 충분할 때
   ↓ 데이터 부족 fallback
Content-based (Sentence-BERT, §09) — 텍스트 임베딩
   ↓
Demographics (성별/연령/지역) — 평균 사용자 패턴
   ↓
Popularity (도시×카테고리 Top) — 최종 안전망
   ↓
Default preference (c2dp) — 비즈니스 룰
```

---

## 2. New User Cold-start 해결

### 2-1. 즉시 가용 신호

- **Demographics**: 성별, 연령, 지역 (가입 시 수집)
- **Onboarding survey**: "어떤 여행 좋아하세요?" 같은 질문
- **First click / view**: 첫 행동이 큰 신호

### 2-2. Demographics-based Default Preference (c2dp)

산업 c2dp (Category2 Default Preference) 의 정체:

```
신규 사용자 (성별=M, 연령=30s, 지역=KR) 
   → 같은 demographics 의 평균 사용자 행동 패턴 적용
   
c2dp_score(category2, demographics) = avg_score for users in demographics
```

**구현**:
```sql
WITH demographic_avg AS (
  SELECT
    gender, age_group, location_country,
    category2_id,
    AVG(score) AS avg_score
  FROM user_category2_score
  JOIN users USING (user_id)
  WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  GROUP BY gender, age_group, location_country, category2_id
)
SELECT * FROM demographic_avg
```

### 2-3. Onboarding Bandit

신규 사용자에게 **빠른 exploration**:
- 첫 N번 노출은 다양한 카테고리 (MAB exploration)
- 사용자 행동 학습되면 exploitation 전환
- §08 §6-3 의 Thompson sampling 활용

### 2-4. Transfer Learning

만약 사용자가 다른 서비스 (예: SNS 로그인) 에서 가져온 데이터 있다면:
- 다른 도메인 행동을 user embedding 의 input feature 로
- Cross-domain recommendation

---

## 3. New Item Cold-start 해결

### 3-1. Content-based Embedding (§09)

신상품의 **텍스트 / 이미지** 임베딩으로 기존 상품과 유사도 매칭:

```
신상품 X 의 제품 설명 → Sentence-BERT → embedding
기존 상품들의 embedding 과 cosine 계산
가장 유사한 상품의 인기 → X 의 초기 score

X 가 노출되며 데이터 누적 → CF / Two-Tower 학습
```

### 3-2. Item Tower 의 Side Feature 활용 (§13)

Two-Tower 의 item tower 가 **content embedding 을 input feature** 로 받으면:
- 신상품 → text embedding → item tower → item embedding 즉시 생성
- 학습 데이터 0개라도 retrieval 가능

이게 Two-Tower 가 MF 보다 cold-start 강한 이유.

### 3-3. Popularity Boost (Exploration)

신상품에 **초기 boost** 부여:

```
score(item) = base_score × (1 + boost × exp(-age_days / τ))

age_days: 신상품 출시 후 일수
τ: 부스팅 감쇠 (보통 14일 = exp(-1) decay)
boost: 초기 부스팅 강도 (보통 0.5~1.0)
```

신상품이 **자연 노출 기회** 얻음 → 데이터 누적 → 자체 score 로 전환.

### 3-4. Hard Cold-start vs Soft Cold-start

| | Hard | Soft |
|---|---|---|
| 행동 데이터 | 0 | 1~100 |
| 사용 알고리즘 | Content + boost | CF + smoothing |
| §06 Bayesian smoothing | N/A | 핵심 |

**Soft cold-start 의 보정** — §06 의 Bayesian smoothing:
```
smoothed_score = (k + α) / (n + α + β)
```
n 작을 때 평균에 회귀 → 신상품의 점수 과대평가 방지.

---

## 4. New Context Cold-start

### 4-1. 새 도시 진출

새 도시 — 데이터 없음. 해결:
- **Geographic transfer** — 비슷한 도시의 인기 패턴 차용 (서울 → 부산)
- **Category transfer** — 카테고리 분포만으로 추론
- **Manual curation** — 운영팀이 첫 N개 상품 직접 큐레이션 (cold start period)

### 4-2. 새 카테고리

- Content embedding 으로 기존 카테고리와의 거리 계산
- 비슷한 카테고리의 사용자 패턴 차용

---

## 5. 메타 시스템 (mr) — 섹션 매핑 Reference

산업 mr (Meta Reference) 엔진의 역할.

### 5-1. 추천 결과 → UI 섹션 매핑

```
백엔드 추천 산출:
   - vt: 동시 조회 추천
   - cb: 카테고리 베스트
   - lb: 랜드마크 인기
   - sba: 시즌 인기
   - ...

UI 섹션:
   - home_main_banner: 메인 배너
   - home_recommended_for_you: 추천 섹션
   - home_seasonal: 시즌 특집
   - detail_similar: 상품 상세의 유사 상품
   - detail_cross: 상품 상세의 cross-sell
   - xsell_post_booking: 예약 후 cross-sell
```

mr 의 DB:
```
section_id, recommendation_engine_id, priority, max_items, fallback_engine_id
   home_recommended_for_you, vt-deep, 1, 20, cb
   home_recommended_for_you, vt, 2, 20, cb
   detail_similar, morelike-offer, 1, 10, vt
   ...
```

**가치**: 운영자가 코드 수정 없이 섹션-엔진 매핑 변경. A/B 실험 시 새 엔진 binding 추가만으로 노출.

### 5-2. mr 의 Fallback 체인

```
section: home_recommended_for_you
   priority 1: vt-deep
      ↓ 결과 부족 시
   priority 2: vt
      ↓ 부족 시
   priority 3: cb (fallback)
```

각 섹션의 안전망 보장 — 빈 화면 절대 발생 안 함.

---

## 6. 스코어 부스팅 (union-stay-score) — Business Rule Injection

### 6-1. 운영 개입의 필요성

데이터로만 학습한 모델의 한계:
- 비즈니스 우선순위 (마진 높은 상품) 반영 못함
- 신상품 launch 캠페인 반영 못함
- 운영팀의 도메인 지식 반영 못함

→ **명시적 business rule injection** 필요.

### 6-2. union-stay-score 의 정체

산업 union-stay-score 의 의도:

```
final_score = ml_score × business_boost(item)

business_boost(item):
   - 우선순위 호텔 (계약 우선)
   - top-selling 추가 부스팅
   - 신상품 캠페인 부스팅
   - 카테고리 다양성 보정
```

### 6-3. Boost 의 정직성

**원칙**: business rule 은 명시적이어야 함.
- ✅ "이 호텔은 비즈니스 우선순위로 5% 부스팅" 명시
- ❌ ML score 에 숨겨서 boost — 디버깅 어려움 + 모델 책임 분리 안 됨

산업 표준:
```python
def final_ranking(ml_scores, items):
    final = []
    for item, ml_score in zip(items, ml_scores):
        boost = 1.0
        if item.business_priority == 'high':
            boost *= 1.10
        if item.is_new_release and item.age_days < 14:
            boost *= 1.05
        if item.is_top_selling:
            boost *= 1.02
        
        final_score = ml_score * boost
        final.append((item, final_score, ml_score, boost))  # 추적 가능
    
    return sorted(final, key=lambda x: -x[1])
```

각 boost 의 적용 이력을 별도 컬럼으로 → A/B 실험 + 디버깅 가능.

---

## 7. Position Bias 보정 — IPW (Inverse Propensity Weighting)

### 7-1. Position Bias 의 정체

```
사용자가 노출된 위치별 클릭 확률:
   1위:  10%
   2위:  6%
   3위:  4%
   ...
   10위: 1%

→ 1위에 노출된 것이 본질적으로 좋아서가 아니라 위치 때문에 click 많음
```

이 위치 효과를 무시하고 click 수만 보면 → "1위 항상 더 좋음" 학습 → **악순환**.

### 7-2. IPW 의 정의

```
IPW(item, position) = 1 / P(view | position)

P(view | position): 그 위치에 노출되었을 때 본 확률 (사용자가 그 위치까지 스크롤할 확률)
```

학습 시 각 click 에 1/P 가중치:
```
loss = Σ_i  IPW(i) × CE(model(x_i), y_i)

낮은 위치 (작은 P) → 큰 가중치 → 모델이 그 click 을 더 중요하게 학습
```

직관: "어렵게 발견된 click 은 진짜 신호. 쉬운 click 은 위치 효과."

### 7-3. P(view | position) 추정

실험으로 측정:
- Random position swap A/B — 같은 item 을 다른 위치에 노출
- 위치별 click 차이 → P(view | position)

또는 EM (Expectation-Maximization) 알고리즘으로 모델 학습과 동시에 추정 (Wang et al. 2016).

### 7-4. Counterfactual Evaluation (§01 §6-1 의 연결)

추천의 evaluation 자체에 IPW 활용:

```
expected_reward = Σ_i (reward_i × IPW_i)
```

과거 모델이 노출한 결과로 새 모델 평가 시 IPW 로 selection bias 보정.

---

## 8. 산업 전체 score 공식 — 통합

§05-08 + §17 의 모든 항을 결합:

```
final_score(user, item, context, time)
  = ml_score(user, item, context)            ← Two-Tower / DLRM
  × geo_decay(item.location, user.location)  ← §07 거리 패널티
  × time_decay(item.age)                     ← §05 §4-2
  × season_boost(item, current_date)         ← §08 sba
  × bayesian_smoothing(item)                 ← §06
  × business_boost(item)                     ← §17 union-stay-score
  / position_bias(slot)                      ← §17 IPW

cold_start_fallback:
   if no_history(user) → demographic_avg (c2dp)
   if no_history(item) → content_embedding (§09) + popularity boost
```

여기까지가 **현대 산업 추천 시스템의 풀 score**. 각 항이 명확한 의미를 가지고 디버깅 + A/B 가능.

---

## 9. 흔한 함정 7가지

| # | 함정 | 실제 |
|---|---|---|
| 1 | "Cold-start 는 ML 로 해결" | ML 은 데이터 필요. Cold-start 는 본질적으로 ML 외 — content / demographics / 룰 / exploration 결합. |
| 2 | "신상품 자동으로 노출됨" | CF / popularity 만 쓰면 신상품 영원히 노출 안 됨. 명시적 boost 또는 MAB exploration 필수. |
| 3 | "Demographics 가 충분한 cold-start 해결책" | 약한 신호. Onboarding bandit + content 결합이 우월. |
| 4 | "mr 같은 메타 시스템 over-engineering" | 운영자가 코드 수정 없이 섹션 매핑 변경 가능 → A/B 가속. 산업 표준. |
| 5 | "Business rule 을 ML score 에 숨김" | 디버깅 + A/B + 책임 분리 못함. **명시적 boost factor 분리** 필수. |
| 6 | "Position bias 무시" | 악순환 → 1위 모델이 영원히 1위. IPW 또는 randomized exploration 필수. |
| 7 | "IPW 추정이 복잡해서 안 쓴다" | Random position swap 실험만으로 추정 가능. 산업 검증된 표준 기법. |

---

## 10. 꼬리 질문 (§26 면접 카드 후보)

1. **추천 시스템의 cold-start 3축은?**
   - 답: (1) New User — 행동 이력 없음, demographics + onboarding bandit + content. (2) New Item — 노출/클릭 없음, content embedding (§09) + popularity boost + Two-Tower side feature. (3) New Context (도시/카테고리) — geographic / category transfer + manual curation.

2. **c2dp (Category2 Default Preference) 의 메커니즘은?**
   - 답: 신규 사용자의 demographics (성별/연령/지역) 와 동일한 기존 사용자 그룹의 평균 카테고리2 선호도. CF 의 fallback. SQL 로 90일 행동 집계 → demographics 별 grouping. 약하지만 데이터 0 보다 압도적으로 우월.

3. **신상품 cold-start 에서 Sentence-BERT 임베딩이 우월한 이유는?**
   - 답: 행동 데이터 없어도 텍스트 (제품 설명) 는 즉시 가용. Sentence-BERT 임베딩 → 기존 상품과 cosine 매칭 → 유사한 상품의 패턴 활용. CF 의 cold-start 완전 회피.

4. **mr (Meta Reference) 시스템의 가치는?**
   - 답: 운영자가 코드 수정 없이 섹션-엔진 매핑 변경 가능. A/B 실험 시 새 엔진 binding 추가만으로 노출. Fallback 체인으로 빈 화면 절대 발생 안 함. 백엔드와 ML 의 decoupling.

5. **Business rule 을 ML score 에 곱하지 않고 분리하는 이유는?**
   - 답: (1) Debugging — 어느 boost 가 결과에 영향 줬는지 추적. (2) A/B — boost factor 별로 실험. (3) 책임 분리 — ML 모델은 사용자 만족, business rule 은 비즈니스 우선순위. ML score 에 숨기면 모델이 잘못된 신호 학습.

6. **Position bias 와 IPW 의 메커니즘은?**
   - 답: Position bias — 위에 노출된 item 이 본질 가치와 무관하게 click 많음. IPW (Inverse Propensity Weighting) — 학습 시 click 에 1/P(view|position) 가중치. 낮은 위치 click 에 큰 weight → 모델이 위치 효과 분리 학습. Random position swap 으로 P 추정.

7. **신상품 boost 의 적정 강도와 감쇠 주기는?**
   - 답: 보통 boost = 0.5~1.0, τ = 14일 (exp decay). 너무 강한 boost → 본질 가치 무시. 너무 약한 boost → 노출 부족. A/B 로 도메인별 튜닝. 신상품이 자체 데이터 누적 후 자연스럽게 boost 사라지도록.

---

## 11. cross-ref

| 주제 | 연결된 study |
|---|---|
| Funnel 의 Stage 3 (Boost) | §01 §5 |
| Two-Tower 의 cold-start 강점 | §13 (item side feature) |
| Sentence-BERT content embedding | §09 |
| Bayesian smoothing | §06 (soft cold-start 보정) |
| MAB exploration (Thompson) | §08 (신규 user/item exploration) |
| 행동 가중합 + score 결합 | §05 |
| Geo decay | §07 |
| Counterfactual evaluation | §01 §6-1, Phase 9 §19 |
| A/B 실험 platform | Phase 9 §19 |
| msa 메타 시스템 ADR | Phase 10 §21 |
