---
parent: 20-recommendation-modeling
seq: 01
title: 추천 시스템 개론 — 추천 vs 검색 vs 광고, Funnel 멘탈 모델, content/collaborative/hybrid 접근법
type: deep
created: 2026-05-12
---

# 01. 추천 시스템 개론

## 1. 추천 vs 검색 vs 광고 — 비슷해 보이는 세 영역의 차이

세 영역 모두 "사용자에게 아이템을 보여주는" 일이라는 점에서 닮았지만, **사용자 의도가 어디에 있는가** 가 본질적으로 다르다. 백엔드 시니어가 추천을 설계할 때 가장 먼저 깨달아야 하는 차이다.

| 축 | **검색 (Search)** | **추천 (Recommendation)** | **광고 (Advertising)** |
|---|---|---|---|
| 사용자 의도 | **명시적** (쿼리 입력) | **잠재적** (행동 이력 기반 추론) | **삽입형** (의도와 무관, 노출 강제) |
| 정답 | 비교적 존재 (쿼리와의 관련도) | **부재** (사용자가 좋아할지 모름) | 비즈니스 정의 (가장 비싼 입찰) |
| 평가 | NDCG (Normalized Discounted Cumulative Gain, 정규화 할인 누적 이득), MRR (Mean Reciprocal Rank, 평균 역순위) — judgment list 가능 | **A/B 테스트 + online CTR/CVR** (offline metric 신뢰도 낮음) | CTR, CPC (Cost Per Click), ROAS (Return On Ad Spend) |
| 콜드 스타트 | 쿼리만 있으면 동작 | **신규 유저/상품 모두 어려움** | 광고주 데이터 필요 |
| 핵심 메트릭 | Recall@K + Precision@K | CTR / CVR / GMV / dwell time / diversity | bid × predicted CTR |
| 컴포넌트 재사용 | BM25 + Embedding + Re-Ranking | **검색과 동일 인프라 + funnel 구조** | 검색·추천 위에 비딩 계층 추가 |

**핵심 1문장**: 검색은 "사용자가 말한 의도"를, 추천은 "사용자가 말하지 않은 의도"를, 광고는 "사용자 의도와 무관하게 노출되는 것"을 다룬다.

> 멘탈 모델: 검색 = "찾아 줘", 추천 = "내가 좋아할 만한 거 보여 줘", 광고 = "(어쩔 수 없이 보는 것)"

### 1-1. 왜 추천에서 offline metric 이 신뢰가 낮은가

검색은 "쿼리 X 에 대한 정답 문서 Y"를 인간 라벨링으로 만들 수 있다 (judgment list). 추천은 **사용자가 본 적 없는 아이템에 대해 좋아했을지 알 수 없다** — 이게 **counterfactual problem (반사실 문제)** 다.

```
offline: 과거 클릭 로그 → 모델이 그 클릭을 잘 예측하나?
         하지만 사용자가 클릭한 건 모델이 보여 준 것 뿐. 안 보여 준 건 클릭할 수 없었음.
         → selection bias (선택 편향) 가 데이터에 박혀있음.
```

이 때문에 추천은 **A/B 테스트가 유일하게 신뢰할 만한 평가** 다. offline metric (Recall@K, NDCG) 은 hill-climbing 용 보조 지표일 뿐 정답이 아니다.

이게 추천 영역이 검색보다 복잡한 결정적 이유다 — **객관적 정답이 없는 문제** 를 풀고 있다.

---

## 2. 추천의 본질 — 잠재 의도 추론

추천은 다음 4가지 신호로 사용자의 잠재 의도를 추론한다:

| 신호 | 예시 | 강도 | 데이터 양 |
|---|---|---|---|
| **명시적 피드백 (explicit)** | 별점, 좋아요, 즐겨찾기 | 강함 | **희박** |
| **암묵적 피드백 (implicit)** | 클릭, 조회 시간, 스크롤 깊이 | 약함 | 풍부 |
| **거래 피드백 (transactional)** | 구매, 예약, 결제 완료 | **가장 강함** | 매우 희박 |
| **컨텍스트 (contextual)** | 시간, 위치, 디바이스, 날씨 | 가변 | 항상 동반 |

산업계 표준 가중치 패턴 (Phase 2 에서 deep-dive):
```
score(user, item) = w_reservation × reservation(user, item)
                  + w_click       × click(user, item)
                  + w_addwish     × addwish(user, item)
                  + w_pageview    × pageview(user, item)
                  + context boost
```

전형적인 비율: `100 : 20 : 10 : 1` — 거래 한 번이 페이지뷰 100 번 가치. 비율은 무엇을 최적화하느냐 (CTR vs CVR vs GMV) 에 따라 결정된다.

**핵심**: 추천은 본질적으로 **noisy implicit feedback 에서 진짜 신호를 뽑아내는 문제** 다. explicit 데이터만으로는 절대 부족하다 (모든 사용자가 별점을 남기지는 않는다).

---

## 3. 3대 접근법 — Content-based vs Collaborative Filtering vs Hybrid

추천 알고리즘은 **무엇으로 유사도를 정의하는가** 에 따라 3가지로 갈린다.

### 3-1. Content-based Filtering (콘텐츠 기반 필터링)

**아이디어**: 아이템의 속성 (장르, 카테고리, 텍스트, 이미지) 으로 유사도 계산. 사용자가 좋아한 아이템과 비슷한 속성의 아이템 추천.

```
사용자 A 가 좋아한 영화: 인셉션 (SF, 놀란, 액션)
                        ↓
        같은 속성을 가진 영화 추천: 테넷 (SF, 놀란, 액션)
```

**구현**:
- TF-IDF / BERT 임베딩 → 코사인 유사도
- 카테고리 매칭 + jaccard
- 이미지 임베딩 (CNN, CLIP) → ANN

**장점**:
- ✅ **cold-start (신규 상품) 에 강함** — 신규 영화도 속성만 있으면 추천 가능
- ✅ **설명 가능 (explainable)** — "SF 좋아하시잖아요"
- ✅ 사용자별 모델 독립 — privacy 친화적

**한계**:
- ❌ **diversity 부족** — 같은 장르만 보여 줌 (filter bubble)
- ❌ 아이템 속성 추출 품질에 종속 — 좋은 임베딩 없으면 실패
- ❌ 사용자가 명시한 적 없는 잠재 의도 발견 불가 (sci-fi 만 본 사용자가 사실 thriller 도 좋아할 수 있음)

### 3-2. Collaborative Filtering (CF, 협업 필터링)

**아이디어**: 비슷한 행동을 한 다른 사용자가 좋아한 것을 추천. "당신과 비슷한 사람들이 본 것"

```
사용자 A 가 본 영화: {인셉션, 테넷, 다크나이트}
사용자 B 가 본 영화: {인셉션, 테넷, 인터스텔라}     ← A 와 행동 비슷
사용자 C 가 본 영화: {겨울왕국, 라푼젤}             ← A 와 행동 다름

→ A 에게 추천: 인터스텔라 (B 가 본 것 중 A 가 안 본 것)
```

**두 가지 변종**:
- **User-User CF**: 비슷한 사용자 찾기 → 그 사용자의 좋아요 아이템 추천
- **Item-Item CF (산업 표준)**: 비슷한 아이템 찾기 → 사용자 이력 기반 비슷한 것 추천
  - "이 영화를 본 사람들이 함께 본 영화" 패턴
  - 사용자 수보다 아이템 수가 적어서 **계산 효율적**
  - 신규 사용자도 행동 한 번만 있으면 동작 (User-User 는 비슷한 사용자 매칭이 어려움)

**장점**:
- ✅ **잠재 의도 발견** — 사용자가 모르던 취향 발견 가능
- ✅ **아이템 속성 불필요** — 행동 데이터만으로 작동
- ✅ diversity 자연스럽게 확보

**한계**:
- ❌ **cold-start 양쪽 모두 약함** — 신규 사용자/상품 모두 행동 데이터 부족
- ❌ **데이터 sparsity (희박성)** — 사용자×아이템 행렬이 99.9% 비어있음
- ❌ **popular item bias (인기 편향)** — 인기 상품에 과적합
- ❌ 설명 어려움 ("왜 이게 추천되었나요?" 답 어려움)

### 3-3. Hybrid (하이브리드)

**아이디어**: Content + CF 결합. 각각의 약점을 서로의 강점으로 보완.

**주요 패턴**:

| 패턴 | 방식 | 사용 시나리오 |
|---|---|---|
| **Weighted hybrid** | `score = w₁ × content_score + w₂ × cf_score` | 가장 단순. weight 튜닝 필요 |
| **Switching hybrid** | 신규 유저는 content, 활성 유저는 CF | cold-start 명시적 분기 |
| **Cascade hybrid** | content 로 후보 N 개 → CF 로 재정렬 | retrieval/ranking funnel 의 원조 |
| **Feature combination** | content 속성을 CF 의 feature 로 사용 | DLRM/Wide&Deep 의 sparse + dense feature |
| **Meta-level hybrid** | content 모델 출력을 CF 의 입력으로 | Two-Tower 의 item tower 가 content embedding 활용 |

**현대 딥러닝 추천 (Phase 6 에서 deep-dive)** 은 사실상 모두 **feature-combination hybrid** 다 — content 속성과 행동 데이터를 동일 신경망에 넣는다. 산업 표준이다.

> **핵심**: 순수 content 도, 순수 CF 도 production 에 단독으로 못 쓴다. 모든 실전 추천 시스템은 hybrid 다.

---

## 4. Two-stage Retrieval 의 정체 — 왜 단일 모델로 안 되나

**상황**: 사용자 한 명에게 보여 줄 추천 Top-10 을 만들어야 한다. 아이템은 1,000만 개. 모델은 deep neural network.

**나이브 접근**: 모든 아이템에 대해 사용자×아이템 score 계산 → 정렬 → Top-10
```
1,000만 × 신경망 forward pass (예: 10ms) = 28시간/요청 ❌
```

당연히 실시간 서빙 불가능. 그래서 **2단계 funnel** 로 좁힌다.

```
Stage 1: Retrieval (recall 중시, latency must)
   - 단순/빠른 모델로 1,000만 → 수백 후보 좁히기
   - 후보 수백 개 중에 "진짜 좋은 것" 이 들어있기만 하면 됨 (recall)
   - 예: Two-Tower (user embedding × item embedding dot product) + ANN
   - 예: CF 의 사전 계산된 similar items 룩업
   - latency budget ~50ms

Stage 2: Ranking (precision 중시)
   - 무겁고 정확한 모델로 수백 → 수십 정밀 랭킹
   - 예: DLRM, Wide & Deep — feature 많이 보고 점수 계산
   - latency budget ~30ms

Stage 3: Re-rank / Boost (business rules, diversity)
   - 비즈니스 룰 적용 — 카테고리 다양성, 신선도, 재고
   - cold-start fallback 삽입
   - latency budget ~10ms

총 ~90ms 안에 1,000만 → Top-10
```

### 4-1. 왜 단일 모델로 안 되나 — Recall vs Precision trade-off

이 funnel 구조는 단순히 성능 최적화가 아니라 **정확도-효율 trade-off 의 본질적 해결책** 이다:

| | Retrieval | Ranking |
|---|---|---|
| 목표 | "좋은 후보가 안 빠지게" (recall) | "후보 중에 진짜 좋은 것 골라내기" (precision) |
| 모델 | 가볍고 빠른 (embedding dot product) | 무겁고 정확한 (deep network, many features) |
| 데이터 | 모든 아이템 (1,000만) | 후보 수백 |
| Latency budget | 50ms | 30ms |
| 학습 데이터 | (user, positive_item) + 임의 negative | (user, item, label) — 풍부한 feature 동반 |
| 평가 지표 | Recall@K | NDCG, AUC |

**Retrieval 의 핵심**: positive 와 negative 의 구별. 사용자가 클릭한 아이템 vs 그렇지 않은 아이템. 후보군이 작아질수록 negative 가 점점 "긍정에 가까운 음성" 이 되어 더 어려워진다.

**Ranking 의 핵심**: 후보 수백 개 중 진짜 좋은 것을 정렬. 이미 retrieval 이 좋은 후보만 골라줬으므로 **feature interaction** 이 핵심.

> YouTube 2016 논문 (Phase 6 §13 에서 deep-dive) 이 이 2-stage 구조를 산업 표준으로 만듦. 이후 Meta DLRM, Pinterest PinSage, Airbnb Embeddings 모두 동일 구조.

### 4-2. ⚠️ Two-Tower 와 Two-Stage Retrieval 는 다른 개념 (자주 헷갈림)

둘 다 "Two-" 로 시작하고 출처가 YouTube 라 면접/실무에서 자주 혼동된다. **차원이 다르다**.

| 축 | **Two-Tower** | **Two-Stage Retrieval** |
|---|---|---|
| **무엇** | 모델 아키텍처 (단일 신경망 1개) | 시스템 파이프라인 패턴 |
| **단위** | user tower + item tower → dot product | retrieval (수백) → ranking (수십) |
| **출처** | Siamese network (1990s) 계보 → YouTube 2019 가 retrieval 표준화 | YouTube 2016 논문이 산업 표준화 |
| **"Two" 의 의미** | tower **두 개** (user + item) | stage **두 개** (retrieval + ranking) |
| **역할** | retrieval 단계의 **한 가지 모델 선택지** | 시스템 전체의 **구조** (모델 종류 무관) |

**관계 — 둘은 보완관계**:
```
Two-Stage Retrieval (시스템 구조)
├─ Stage 1 (Retrieval)  ← 여기 들어가는 모델 후보 중 하나가 Two-Tower
│   - 후보: Two-Tower / CF / Geo nearby / Content-based
└─ Stage 2 (Ranking)    ← 여기는 Two-Tower 아닌 다른 모델
    - 후보: DLRM / Wide & Deep / Tab-Transformer / LTR
```

**비유**: Two-Tower = 엔진 종류 (V8, V6 처럼, 모델 1개의 내부 구조). Two-Stage Retrieval = 자동차 구조 (FF, FR, AWD 처럼, 시스템 전체 구성). V8 엔진을 FF 자동차의 1단계에 넣는 식 — 다른 축의 개념.

**산업 표준 조합**: "Two-Tower 로 retrieval 하는 Two-Stage 시스템" — 이 조합이 자주 같이 등장해서 더 헷갈린다. 하지만 retrieval 을 CF 로 해도 Two-Stage 는 성립하고, retrieval 을 Two-Tower 단독으로 끝내도 (ranking 없이) Two-Tower 는 성립한다.

> **면접 답변 패턴**: "Two-Tower 는 모델 아키텍처, Two-Stage 는 시스템 패턴입니다. 산업 표준은 둘을 조합한 것 — Stage 1 retrieval 에 Two-Tower, Stage 2 ranking 에 DLRM 같은 무거운 모델." 이 한 문장이면 면접관 만족.

---

## 5. Funnel 멘탈 모델 — 추천의 단계별 책임 분리

00-preview 에서 그린 funnel 을 deep level 에서 다시 보면, 각 stage 가 **서로 다른 모델·데이터·인프라** 를 갖는다.

```
┌─────────────────────────────────────────────────────────────────┐
│  Stage 1: Retrieval (1,000만 → 수백, recall 50ms)                │
│  ──────────────────────────────────────────────────────────────  │
│  - 모델: Two-Tower / CF lookup / Geo nearby / Content embedding  │
│  - 데이터: user embedding + item embedding (precomputed)         │
│  - 인프라: FAISS / HNSW / Annoy / ScaNN (ANN index)              │
│  - 산출: 후보 아이템 ID list                                      │
│  - 평가: Recall@K (offline)                                      │
└────────────────────────────┬─────────────────────────────────────┘
                             │ 수백 candidate
┌────────────────────────────▼─────────────────────────────────────┐
│  Stage 2: Ranking (수백 → 수십, precision 30ms)                  │
│  ──────────────────────────────────────────────────────────────  │
│  - 모델: DLRM / Wide & Deep / Tab-Transformer / LTR              │
│  - 데이터: user feature + item feature + context + interaction   │
│  - 인프라: TF Serving / TorchServe / ONNX Runtime                │
│  - 산출: 후보별 score (정렬된 list)                              │
│  - 평가: NDCG, AUC (offline) + CTR (online)                      │
└────────────────────────────┬─────────────────────────────────────┘
                             │ 수십 ranked candidate
┌────────────────────────────▼─────────────────────────────────────┐
│  Stage 3: Re-rank / Boost (수십 → Top-K, business 10ms)          │
│  ──────────────────────────────────────────────────────────────  │
│  - 룰: diversity (카테고리 분산), freshness (신상품 boost)        │
│  - 비즈니스: 재고, 가격대, 운영 개입 (mr/c2dp/unionstay-score)    │
│  - cold-start fallback: popularity / default preference          │
│  - 산출: 최종 Top-K (사용자 노출)                                 │
└────────────────────────────┬─────────────────────────────────────┘
                             │ Top-K (보통 10~20)
┌────────────────────────────▼─────────────────────────────────────┐
│  Feedback Loop: 노출 → click/purchase → 다음 학습 데이터          │
│  ──────────────────────────────────────────────────────────────  │
│  - A/B 테스트로 알고리즘 비교 (실험 플랫폼)                       │
│  - online metrics 수집 (CTR/CVR/GMV)                             │
│  - drift detection (data drift, concept drift, feedback loop)    │
│  - 일간/주간/월간 재학습 (batch retraining)                       │
└──────────────────────────────────────────────────────────────────┘
```

### 5-1. 각 stage 가 풀어야 하는 진짜 문제

| Stage | 진짜 어려운 점 | 흔한 실수 |
|---|---|---|
| Retrieval | **negative sampling 전략** — random vs hard vs popularity-debiased | random negative 만 쓰면 인기 상품 over-recommend |
| Ranking | **feature interaction** 자동화 — manual feature cross 한계 | linear model 만 쓰면 ceiling 명확 |
| Re-rank | **diversity 와 relevance 의 trade-off** | 룰만 쌓다가 ranking 신호 죽임 |
| Feedback | **selection bias / position bias** 보정 | online metric 만 보고 결정 → 빠른 vicious cycle |

---

## 6. 추천 시스템 평가의 어려움 — 왜 A/B 가 유일한 정답인가

### 6-1. Offline 평가의 4가지 함정

```
함정 1: 학습 데이터 = 과거 모델의 결과물
   현재 모델 A 가 노출 → 사용자가 클릭 → 다음 학습 데이터에 라벨됨
   → 새 모델 B 를 평가할 때 A 가 노출한 것만 데이터에 있음
   → B 가 새로운 아이템을 추천하려고 해도 라벨이 없음 (counterfactual)

함정 2: Position bias
   상위에 노출된 것은 클릭률이 무조건 높음 (위치 효과)
   클릭 = 좋아함 이 아닐 수 있음 → IPW (Inverse Propensity Weighting) 보정 필요

함정 3: Filter bubble
   모델이 같은 카테고리만 추천 → 사용자 행동도 그 카테고리에 집중
   → 모델은 잘하고 있다고 착각 (echo chamber)

함정 4: Long-term effect 측정 불가
   click rate 는 즉시 측정 가능, 하지만 retention / lifetime value 는 몇 달 후
   offline 으로는 단기 신호만 측정 가능
```

### 6-2. Online A/B 가 유일한 신뢰 신호인 이유

A/B 테스트는:
- ✅ **현재 상태 vs 새 모델 비교** — counterfactual 자체가 통제됨
- ✅ **사용자 자연 행동** — selection bias 없음
- ✅ **long-term 측정 가능** — 충분한 기간 운영하면 retention 측정 가능
- ❌ **느림** — 통계적 power 위해 보통 1~2주
- ❌ **부정적 실험 비용** — bad model 이 실제 매출 손실
- ❌ **multiple testing 보정 필요** — 동시 실험 많을 때 false positive

> **시니어 백엔드 관점**: 추천 시스템 도입 시 **A/B 플랫폼이 모델보다 먼저 준비되어야 한다**. msa 의 `experiment` 서비스가 이 인프라. Phase 9 와 10 에서 deep-dive.

---

## 7. 산업 사례 매핑 — engines/ 카탈로그를 Funnel 에 매핑

00-preview 에서 28개 deep file 로 분해한 산업 추천 엔진 38종을 Funnel 의 어느 stage 가 담당하는지 정리:

| Stage | 담당 엔진 (산업 카탈로그) |
|---|---|
| **Retrieval — CF** | vt (View Together), st (Search Together), bt (Buy Together), ct (City Together), 변형 (`-acc`/`-mi`/`-pkg`/`-com`/`-vtf`/`-cp`) |
| **Retrieval — Geo** | cross-nearby, nearby-tna, nearby-products, long-stay-nearby, lb / ldp (랜드마크) |
| **Retrieval — Content/NLP** | morelike-com, morelike-offer (Sentence-BERT 임베딩 + ANN) |
| **Retrieval — 룰 기반** | cb (Category Best), cb2, cb-* 변형, urb (Urban CTR), th (Trip Home), sba (Season Best Accommodation) |
| **Retrieval — DL** | vt-deep (Two-Tower / DLRM / Wide&Deep / Tab-Transformer 등 14종) |
| **Ranking** | (산업 카탈로그에 명시적 ranking 엔진은 약함 — retrieval 결과를 직접 노출하거나 score 기반 정렬. 현대 산업 트렌드는 별도 ranking 모델 운영) |
| **Re-rank / Boost** | mr (Meta Reference, 섹션 매핑), c2dp (Category2 Default Preference), union-stay-score (점수 부스팅) |
| **검색 인프라 (추천 아님)** | nero (NER, 추천 카탈로그에 포함되지만 검색용 인프라) |

**관찰 1**: 산업 카탈로그가 **retrieval 다양성에 강점** — CF 4종 + Geo 5종 + Content 2종 + 룰 기반 다수 + DL 14종 = 25종 이상.
**관찰 2**: **별도 ranking 모델이 약함** — retrieval 산출물을 그대로 노출하거나 점수 기반 정렬. ranking 도입은 향후 발전 방향.
**관찰 3**: **rs (Related Searches) 와 nero (NER) 는 검색 보조** — 추천 카탈로그 안에 있지만 검색 도메인.

이 분해가 Phase 10 (msa 구현) 의 단계적 도입 ADR 근거가 된다:
- Phase 1 (룰 기반 Category Best) → Funnel Stage 1 의 룰 기반 retrieval 만
- Phase 2 (CF Spark) → Stage 1 의 CF retrieval 추가
- Phase 3 (Two-Tower ANN) → Stage 1 의 DL retrieval 추가
- (향후 Phase 4) → Stage 2 (ranking) 도입

---

## 8. msa 적용 단초 — 어디서 시작할까

msa 본 레포에는 추천 서비스가 없지만, **인프라 토대는 이미 갖춰져 있다**:

| msa 컴포넌트 | 추천 도입 시 역할 |
|---|---|
| `analytics` (Kafka Streams + ClickHouse) | 사용자 행동 이벤트 수집 + OLAP 집계 — 행동 가중합 산출의 source |
| `search` (BM25 검색) | 향후 Hybrid Search 도입 시 추천과 임베딩 인프라 공유 (#19 cross-ref) |
| `experiment` (A/B 플랫폼) | 추천 알고리즘 비교 검증 — **추천 도입 전제 조건** |
| `product` (SSOT) | 추천 대상 아이템 도메인 |
| `member` (회원) | 추천 대상 사용자 도메인 |

**도입 단계 (Phase 10 에서 ADR 작성)**:
```
Phase 1: 룰 기반 Category Best
   - 인프라: ClickHouse SQL + Redis 캐시
   - 데이터: analytics 의 click/view/purchase 이벤트
   - API: GET /api/v1/recommendations/category-best
   - 가치: cold-start fallback, 운영 개입 가능

Phase 2: CF Spark 잡 (Item-Item)
   - 인프라: Spark batch (recommendation/batch 모듈)
   - 데이터: ClickHouse → Spark → 유사도 행렬 → Redis
   - API: GET /api/v1/recommendations/similar-items
   - 가치: 개인화 시작 (사용자 이력 기반)

Phase 3: Two-Tower ANN
   - 인프라: ONNX Runtime + FAISS 또는 HNSW
   - 데이터: 학습된 user/item embedding
   - API: GET /api/v1/recommendations/personalized
   - 가치: deep retrieval, scalable serving

(Phase 4 향후): DLRM ranking 추가
```

Phase 1 만 도입해도 즉시 가치 있다 — 추천이 없는 것보다는 룰 기반이라도 있는 게 낫다. **단계적 도입 (incremental delivery) 가 추천 시스템 도입의 핵심** 이다.

---

## 9. 흔한 오해 정리

| # | 오해 | 실제 |
|---|---|---|
| 1 | "추천 = 머신러닝" | **70%는 데이터/파이프라인/평가**. 모델은 마지막에 결정 |
| 2 | "딥러닝이 모든 걸 푼다" | retrieval 은 거의 임베딩 dot product 로 충분. ranking 만 무거운 모델 |
| 3 | "offline metric 이 좋으면 production 도 좋다" | **offline-online 격차 (gap) 가 흔히 30% 이상**. counterfactual 문제 |
| 4 | "사용자가 좋아요 안 누르면 데이터 부족" | implicit feedback (클릭, 조회시간) 이 explicit 보다 100배 풍부 |
| 5 | "신규 상품/유저 cold-start 는 어쩔 수 없다" | content embedding / demographics / 룰 기반 fallback 으로 안전망 가능 |
| 6 | "추천이 검색보다 쉽다" | **추천이 훨씬 어렵다** — 정답이 없는 문제 + selection bias + counterfactual |
| 7 | "추천 시스템은 모두 협업 필터링 기반" | 현대 production 은 **hybrid** — content + CF + 룰 + 딥러닝 모두 결합 |

---

## 10. Phase 1 → Phase 2 연결 — 다음에 배울 것

이번 §01 에서 정리한 멘탈 모델 위에서, **§02 (CF 유사도 메트릭 deep-dive)** 가 다음 학습 대상이다. 핵심 질문:

- CF 의 핵심인 "비슷한 사용자/아이템" 의 "비슷함" 을 어떻게 정의하나?
- Jaccard / Cosine / PMI / Lift / Pearson — 5가지 메트릭의 수식 derivation 과 선호 시나리오.
- popular item bias 가 왜 발생하고 어떻게 보정하나.
- sparse 데이터에서 어떤 메트릭이 강한가.

§02 에서 다룰 핵심 함정: **단순 cosine similarity 가 sparse data 에서 popular item 에 편향** — PMI 가 왜 더 안전한지.

---

## 11. 꼬리 질문 (면접 카드 후보 → §26 흡수)

1. **추천 시스템에서 offline metric (Recall@K) 이 production 성능을 보장하지 못하는 이유는?**
   - 답: counterfactual problem + selection bias. 학습 데이터가 과거 모델의 노출 이력 → 새 모델이 노출 안된 아이템을 추천하려면 라벨이 없음.

2. **검색과 추천이 공유하는 인프라와 다른 점은?**
   - 답: 공유 — BM25, dense vector embedding, ANN 인덱스. 다른 점 — 검색은 query 명시적, 추천은 잠재 의도 추론. 평가에서 검색은 judgment list 가능, 추천은 A/B 필수.

3. **Two-stage retrieval 이 단일 deep model 보다 나은 이유는?**
   - 답: latency 제약 (~100ms) 에서 1,000만 아이템 전수 inference 불가능. retrieval (가볍고 빠른) + ranking (무겁고 정확) 의 책임 분리가 산업 표준.

4. **Item-Item CF 가 User-User CF 보다 산업 표준인 이유는?**
   - 답: (1) 아이템 수 < 사용자 수 → 계산 효율 (2) item similarity 가 user similarity 보다 시간적으로 안정 (3) cold-start user 도 한 번 행동하면 동작 가능.

5. **추천 시스템 도입할 때 모델보다 먼저 준비해야 할 것은?**
   - 답: A/B 테스트 인프라 (experiment 플랫폼). offline metric 만 보고 결정하면 production 에서 무너짐. msa 의 experiment 서비스가 이 역할.

---

## 12. cross-ref

| 주제 | 연결된 study |
|---|---|
| Vector search HNSW | #19 §08 (Phase 5 §10 에서 deep-dive) |
| Hybrid Search (BM25 + dense) | #19 §07 |
| Multi-Armed Bandit (Thompson sampling) | #19 §42-44 (Phase 4 §08 에서 cold-start 보완) |
| Kafka 이벤트 수집 + 멱등성 | #6 (analytics → 추천 데이터 소스) |
| ClickHouse OLAP | analytics 서비스 (Phase 8 §18) |
| A/B 통계 power | Phase 9 §19 |
| ADR 작성 표준 | docs/adr/, Phase 10 §20 |
