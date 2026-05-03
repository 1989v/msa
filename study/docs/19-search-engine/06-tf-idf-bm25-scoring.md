---
parent: 19-search-engine
seq: 06
title: TF-IDF → BM25 스코어링 — 수식 직관, k1/b 튜닝, function_score 비즈니스 결합
type: deep
created: 2026-05-03
---

# 06. TF-IDF → BM25 스코어링

> 묶음 1 (B) 약점 정조준. "BM25 의 k1, b 가 뭔가요?" 는 시니어 면접 단골. 수식 자체보다 **언제 어느 방향으로 튜닝하는가** 가 핵심.

## 1. 한 줄 핵심

> **BM25 = TF-IDF 에 길이 정규화와 tf saturation 을 추가한 것.**
> k1 = tf saturation 속도, b = 길이 정규화 강도. 도메인의 문서 길이 분포 + tf 분포가 다르면 default 가 안 맞을 수 있다.

## 2. TF-IDF 부터

### 2-1. 직관

검색 쿼리 `q` 와 문서 `d` 의 관련성 점수를 계산하는 가장 고전적 공식.

```
score(q, d) = Σ_t∈q [ tf(t, d) × idf(t) ]
```

- **tf** (term frequency) — `t` 가 `d` 에 몇 번 나오는가. 많이 나올수록 관련도 ↑
- **idf** (inverse document frequency) — `t` 가 corpus 전체에 얼마나 흔한가. 흔할수록 가중치 ↓

### 2-2. idf 의 의미

```
idf(t) = log(N / df(t))
   N: corpus 의 전체 문서 수
   df(t): t 를 포함하는 문서 수
```

직관:
- "the" 는 모든 문서에 나옴 → df ≈ N → idf ≈ 0 (정보량 없음)
- "갤럭시폴드" 는 일부 문서만 → df 작음 → idf 큼 (정보량 ↑)

### 2-3. TF-IDF 의 문제 3가지

1. **tf 가 무한정 증가** — 한 단어가 100번 나오면 tf 도 100. 비현실적 가중치.
2. **문서 길이 영향** — 긴 문서가 자연히 tf 큼 → 짧은 문서에 불리.
3. **수식이 ad-hoc** — 통계적 근거 약함 (확률 모델 아님).

→ 이 3가지를 해결한 것이 **BM25**.

## 3. BM25 — Okapi BM25 (1995)

### 3-1. 풀 수식

```
score(q, d) = Σ_t∈q [ idf(t) × (tf(t, d) × (k1 + 1)) / (tf(t, d) + k1 × (1 - b + b × |d| / avgdl)) ]
```

- k1: tf saturation 파라미터 (Lucene default = **1.2**)
- b: 길이 정규화 파라미터 (Lucene default = **0.75**)
- |d|: 문서 길이 (토큰 수)
- avgdl: corpus 평균 문서 길이

### 3-2. idf (BM25 변형)

```
idf(t) = ln(1 + (N - df(t) + 0.5) / (df(t) + 0.5))
```

→ TF-IDF 의 idf 보다 안정적 (음수 방지, 부드러운 곡선).

### 3-3. tf 부분 분해

```
tf 부분 = (tf × (k1+1)) / (tf + k1 × length_norm)

length_norm = 1 - b + b × |d| / avgdl
```

문서 길이가 평균 = `length_norm = 1` (영향 없음).
문서가 평균보다 길면 `length_norm > 1` → 분모 ↑ → 점수 ↓ (긴 문서에 패널티).
b 가 0 이면 `length_norm = 1` (길이 무시).
b 가 1 이면 길이 비례 풀 정규화.

## 4. k1 — TF Saturation 파라미터

### 4-1. 의미

> tf 가 늘어날수록 점수가 얼마나 빨리 saturate 하는가.

```
k1 작음 (예: 0.5) → tf=1 과 tf=10 의 점수 차이 작음 (빨리 saturate)
k1 큼 (예: 3.0)  → tf=1 과 tf=10 의 점수 차이 큼 (천천히 saturate)
```

### 4-2. 그래프 직관

```
score 기여도
    │
1.5 │     ┌─────────  k1=3 (느린 saturation)
    │   ┌─┘
1.0 │ ┌─┘  ┌────────  k1=1.2 (default)
    │/   ┌─┘
0.5 │  ┌─┘   ┌──────  k1=0.5 (빠른 saturation)
    │ ┌────┘
    └────────────────→ tf
       1 2 3 5 10
```

### 4-3. 튜닝 시점

| 상황 | k1 방향 |
|---|---|
| tf 가 너무 큰 영향 (한 문서가 같은 단어 많이 = 무조건 1등) | k1 ↓ (예: 0.5) |
| tf 의 차이가 잘 안 반영됨 (같은 단어 많은 문서가 안 올라옴) | k1 ↑ (예: 2.0) |
| 짧은 문서 (상품명, 댓글) | k1 ↓ — tf 차이 의미 적음 |
| 긴 문서 (블로그, 위키) | default 또는 k1 ↑ |

### 4-4. 시니어 의사결정

- 이커머스 상품명 검색 — 보통 k1 ≈ 0.5~1.0 (짧은 텍스트)
- 게시판 본문 검색 — default (1.2) 또는 약간 ↑
- 로그/메트릭 검색 — k1 ↑ (특정 단어 많이 나오는 게 의미 있음)

## 5. b — 길이 정규화 파라미터

### 5-1. 의미

> 문서 길이가 점수에 얼마나 영향을 주는가.

```
b = 0   → 길이 완전 무시 (긴 문서 = 짧은 문서 동일)
b = 0.5 → 절반 정규화
b = 0.75 (default) → 강한 정규화
b = 1   → 풀 길이 비례 정규화
```

### 5-2. 왜 필요한가

긴 문서는 자연히 더 많은 단어 → tf 높음. 길이 정규화 없으면 긴 문서가 무조건 유리.

```
짧은 문서 ("갤럭시 폴드"): tf("갤럭시") = 1
긴 문서 (블로그 1000단어, "갤럭시" 5번): tf("갤럭시") = 5

b=0 → 긴 문서가 5배 점수 (불공평)
b=1 → 길이 비례로 깎임
b=0.75 (default) → 적당히 보정
```

### 5-3. 튜닝 시점

| 상황 | b 방향 |
|---|---|
| corpus 의 문서 길이 편차 큼 (상품명 vs 상세설명 혼재) | b ↑ (예: 0.85) — 긴 문서 더 깎음 |
| corpus 의 문서 길이 균일 | b 영향 적음 (default OK) |
| 의도적으로 긴 문서 (상세 설명) 가 더 정확하다고 보고 싶음 | b ↓ (예: 0.5) |
| 정확 prefix 매칭 필요 (이름 검색) | b ↓ 또는 keyword 사용 |

### 5-4. msa 시사점

product 의 `name` 필드 — 대부분 짧음 (10~50자). default b=0.75 가 무난.
product 의 `description` 필드 — 길이 편차 큼. b ↑ 검토.

## 6. function_score — 비즈니스 시그널 결합

### 6-1. 왜 BM25 만으로 부족한가

이커머스에서 BM25 점수만으로는:
- 인기 없는 신상이 1등 (BM25 만 높아서)
- 재고 없는 상품이 검색 결과 (살 수 없음)
- 광고 상품이 안 보임 (수익화 ❌)

→ BM25 + 비즈니스 시그널 (인기도, 신상도, 재고, 광고) 결합 필요.

### 6-2. function_score 구조

```json
{
  "function_score": {
    "query": { "match": { "name": "갤럭시" } },     ← BM25 score (base)
    "functions": [
      { "field_value_factor": { "field": "popularity", "modifier": "log1p" } },
      { "gauss": { "created_at": { "scale": "30d", "decay": 0.5 } } },
      { "filter": { "term": { "category": "smartphone" } }, "weight": 1.5 }
    ],
    "score_mode": "sum",       ← functions 끼리 합산
    "boost_mode": "multiply"   ← (functions 결과) × (BM25 query score)
  }
}
```

### 6-3. score_mode (functions 간)

| mode | 의미 |
|---|---|
| `multiply` | 모든 function 결과 곱 |
| `sum` | 합 |
| `avg` | 평균 |
| `max` / `min` | 최대 / 최소 |
| `first` | 첫 번째 매칭 함수만 |

### 6-4. boost_mode (functions ↔ query)

| mode | 의미 |
|---|---|
| `multiply` | function × query |
| `sum` | function + query |
| `replace` | query 무시, function 만 |
| `min` / `max` | 둘 중 |

### 6-5. 함수 종류

#### `field_value_factor`

```json
{ "field_value_factor": {
    "field": "popularity",
    "factor": 1.0,
    "modifier": "log1p",   // sqrt, log, log1p, ln, square, none
    "missing": 1.0
}}
```

→ 필드 값을 직접 점수에 사용. modifier 로 비선형 변환.

#### `decay function` (gauss / linear / exp)

```json
{ "gauss": {
    "created_at": {
      "origin": "now",
      "scale": "30d",
      "offset": "7d",
      "decay": 0.5
    }
}}
```

→ origin 에서 멀어질수록 점수 감쇠. 신상품 boost / 시간 기반 / 지리 기반.

#### `script_score`

```json
{ "script_score": {
    "script": "Math.log(1 + doc['popularity'].value) * doc['rating'].value"
}}
```

→ 임의 수식. 강력하지만 성능 ↓ (인터프리터). pre-compiled stored script 권장.

### 6-6. 실전 패턴 — 이커머스 상품 검색

```json
{
  "function_score": {
    "query": {
      "bool": {
        "must": [{ "match": { "name": "갤럭시" } }],
        "filter": [
          { "term": { "stock_available": true } },          ← 재고 0 제외 (filter, score X)
          { "range": { "price": { "gte": 100000 } } }
        ]
      }
    },
    "functions": [
      { "field_value_factor": {                              ← 인기도
          "field": "click_count",
          "modifier": "log1p"
      }},
      { "gauss": {                                           ← 신상도
          "created_at": { "scale": "30d", "decay": 0.5 }
      }},
      { "filter": { "term": { "promoted": true } },          ← 광고 boost
        "weight": 2.0
      }
    ],
    "score_mode": "sum",
    "boost_mode": "multiply"
  }
}
```

→ filter 로 hard constraint (재고/가격), function 으로 soft boost (인기/신상/광고).

## 7. 점수 계산 추적 — `explain: true`

### 7-1. 사용

```http
GET /products/_search
{
  "explain": true,
  "query": { "match": { "name": "갤럭시" } }
}
```

응답에 `_explanation` 추가:
```json
"_explanation": {
  "value": 1.234,
  "description": "weight(name:갤럭시 in 0) [PerFieldSimilarity], result of:",
  "details": [
    {
      "value": 1.234,
      "description": "score(freq=1.0), computed as boost * idf * tf from:",
      "details": [
        { "value": 2.2, "description": "boost", "details": [] },
        { "value": 0.561, "description": "idf, computed as log(1 + (N - n + 0.5) / (n + 0.5))", ... },
        { "value": 1.0, "description": "tf, computed as freq / (freq + k1 * (1 - b + b * dl / avgdl))", ... }
      ]
    }
  ]
}
```

→ 어느 term, 어떤 idf/tf 가 점수에 기여했는지 완전 추적 가능.

### 7-2. profile API

```http
GET /products/_search
{
  "profile": true,
  "query": { ... }
}
```

→ 쿼리 단계별 시간 측정 (cache hit, query time per shard).

## 8. BM25 파라미터 변경

### 8-1. 인덱스 단위 적용

```json
PUT /products
{
  "settings": {
    "index": {
      "similarity": {
        "custom_bm25": {
          "type": "BM25",
          "k1": 0.5,
          "b": 0.85
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "similarity": "custom_bm25"
      }
    }
  }
}
```

### 8-2. 변경 시 reindex?

- `similarity` 변경 = 매핑 변경 → 새 인덱스 + reindex 필수
- 운영 절차: 새 인덱스 생성 → reindex → alias swap

### 8-3. A/B 테스트 패턴

- index_v1 (default BM25) + index_v2 (custom BM25) 동시 운영
- traffic 일부를 v2 로 라우팅 (A/B platform — msa 의 experiment 서비스 활용)
- MRR / nDCG 비교 후 채택 결정

## 9. 다른 Similarity 모델

ES/OS 가 지원하는 다른 similarity:

| Similarity | 특징 | 사용 시점 |
|---|---|---|
| `BM25` (default) | 위 수식 | 일반 (99%) |
| `boolean` | tf/idf 무시, 매칭만 | 정확 매칭 위주 |
| `LMDirichlet` | Dirichlet smoothing 언어 모델 | 학술 |
| `LMJelinekMercer` | Jelinek-Mercer smoothing | 학술 |
| `DFR` / `DFI` / `IB` | 다양한 변형 | 특수 도메인 |
| `scripted_similarity` | 사용자 정의 | 실험 |

→ **실무는 BM25 + function_score 가 99%**. 다른 similarity 는 학술/실험.

## 10. 평가 지표 (Relevance Evaluation)

스코어링 튜닝의 효과를 어떻게 측정하나?

### 10-1. 기본 지표

| 지표 | 의미 | 수식 |
|---|---|---|
| **MRR** (Mean Reciprocal Rank) | 정답이 첫 번째 나오는 rank 의 역수 평균 | 1/N × Σ (1 / rank_i) |
| **Precision@k** | 상위 k 결과 중 정답 비율 | (정답 수 / k) |
| **Recall@k** | 전체 정답 중 상위 k 안에 있는 비율 | (포함 정답 / 전체 정답) |
| **nDCG@k** | 상위 k 의 누적 이득 (정답 가까울수록 ↑) | DCG / IDCG |

### 10-2. Judgment List (정답 라벨)

- 사용자 클릭 로그 → 정답 추정
- 도메인 전문가 라벨링 → 정확
- LTR (§10) 의 학습 데이터 source

### 10-3. ES Rank Eval API

```http
POST /products/_rank_eval
{
  "requests": [
    {
      "id": "갤럭시 검색",
      "request": { "query": { "match": { "name": "갤럭시" } } },
      "ratings": [
        { "_id": "p001", "rating": 3 },
        { "_id": "p002", "rating": 2 },
        { "_id": "p003", "rating": 0 }
      ]
    }
  ],
  "metric": {
    "dcg": { "k": 10, "normalize": true }
  }
}
```

→ 자동화된 nDCG 측정. CI 에 포함하면 검색 품질 회귀 감지 가능.

## 11. 흔한 실수 패턴

### 11-1. BM25 만 튜닝하고 analyzer 미점검

→ 토큰 자체가 잘못되면 어떤 BM25 도 무의미. analyzer (§04, §05) 먼저.

### 11-2. function_score 없이 BM25 만 사용

→ 비즈니스 시그널 무시. 신상/재고/광고 반영 ❌.

### 11-3. function_score 의 boost_mode 잘못

→ default `multiply` 가 아니면 BM25 가 무력화될 수 있음 (예: replace).

### 11-4. script_score 남용

→ 인터프리터 비용. profile 로 측정, stored script + cache 검토.

### 11-5. similarity 변경 없이 BM25 파라미터만 settings 에 넣음

→ 매핑 단위 적용. settings 만 바꾸면 안 됨.

### 11-6. A/B 없이 직접 적용

→ 검색 품질 변화는 직관 ≠ 실측. Rank Eval / 실 사용자 metric (CTR, CVR) 비교 필수.

## 12. msa 시사점

`search:app` 의 검색 API 설계:

```kotlin
// 검색 요청 → ES Query DSL 변환
val query = QueryBuilders.functionScore()
    .query(
        QueryBuilders.bool()
            .must(QueryBuilders.match("name", keyword))
            .filter(QueryBuilders.term("stock_available", true))
            .filter(QueryBuilders.range("price").gte(minPrice))
    )
    .functions(
        ScoreFunctionBuilders.fieldValueFactor("click_count")
            .modifier(Modifier.LOG1P),
        ScoreFunctionBuilders.gauss("created_at", "now", "30d")
    )
    .scoreMode(SUM)
    .boostMode(MULTIPLY)
```

점검 포인트:
- 재고 없는 상품 filter 인가 (msa 의 inventory 서비스 연계)
- 인기도 / 신상도 필드가 ES 매핑에 있는가
- 광고 상품 boost 가 있는가 (msa 의 광고 도메인 — 미생성 서비스)
- BM25 의 k1, b 가 default 인가, 도메인 튜닝 됐는가

→ §15 에서 실제 코드 확인.

## 13. 자주 듣는 오해 정정

> **"BM25 score 는 0~1 사이"**

- ❌ 절대 아님. corpus / 쿼리에 따라 0.5 ~ 50+ 범위. 임계값 직접 비교 ❌.

> **"k1 을 높이면 정확도가 좋아진다"**

- ⚠ 정확도 = 도메인 의존. tf 차이가 의미 있는 도메인이면 ↑, 아니면 ↓.

> **"b = 0.75 가 모든 도메인에 최적"**

- ⚠ Lucene default. 길이 편차 큰 corpus 면 튜닝 가치 있음.

> **"function_score 가 BM25 점수를 대체한다"**

- ❌ boost_mode 에 따라 다름. default `multiply` 는 곱셈 결합, `replace` 는 대체.

> **"script_score 는 무료다"**

- ❌ 인터프리터 비용. shard 당 모든 매칭 doc 에 대해 실행. profile 로 측정.

> **"BM25 외 다른 similarity 가 더 정확하다"**

- ⚠ 학술 우위는 있지만 실무 차이 미미. BM25 + function_score 가 압도적 표준.

## 14. 다음 학습

- [07-query-dsl-patterns.md](07-query-dsl-patterns.md) — match / multi_match 등이 어떻게 BM25 호출하는가
- [09-hybrid-search-rrf.md](09-hybrid-search-rrf.md) — BM25 + vector score 결합 (RRF)
- [10-reranking-cross-encoder-ltr.md](10-reranking-cross-encoder-ltr.md) — function_score 의 한계 → LTR
- [15-msa-search-grounding.md](15-msa-search-grounding.md) — msa search 의 실제 스코어링 코드

> **§06 회독 체크리스트**:
> - [ ] BM25 수식의 4개 변수 (tf, idf, |d|, avgdl) 의 의미를 답할 수 있다
> - [ ] k1 과 b 가 각각 무엇을 통제하는가
> - [ ] k1, b 를 튜닝해야 하는 시점 시나리오 2-3개
> - [ ] function_score 의 score_mode vs boost_mode 차이
> - [ ] 비즈니스 시그널 결합 패턴 (필터 vs 함수, hard vs soft)
> - [ ] explain API 로 점수 추적하는 절차
> - [ ] MRR / nDCG@k / Precision@k / Recall@k 의 정의
