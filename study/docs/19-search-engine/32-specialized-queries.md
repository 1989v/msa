---
parent: 19-search-engine
seq: 32
title: Specialized Queries 보강 — more_like_this · pinned · distance_feature · rank_feature · boosting · constant_score
type: deep-dive
created: 2026-05-04
updated: 2026-05-04
status: completed
related:
  - 99-concept-catalog.md
  - 06-tf-idf-bm25-scoring.md
  - 22-percolate.md
sources:
  - https://www.elastic.co/docs/reference/query-languages/query-dsl/specialized-queries
catalog-row: "§F·G specialized + compound 보강"
depth: full
---

# 32. Specialized Queries 보강

> 카탈로그 매핑: §99 §F·G — `★ 신규` 6종 → `✅ 커버`
> 학습 시간: ~1.5h · 자가평가: B

---

## 1. 한 줄 핵심

비즈니스 시그널 (인기도, recency, 거리, 강제 노출, 차단) 을 검색 점수에 결합하는 **경량 전용 쿼리**들. function_score 보다 특정 워크로드에 빠르고 표현 직관적.

## 2. 6종 한 줄 비교

| 쿼리 | 한 줄 | 비용 | 대체 가능한 무거운 길 |
|---|---|---|---|
| `more_like_this` (MLT) | 주어진 doc 와 유사한 doc 검색 | 중간 (term vectors 의존) | 임베딩 + kNN |
| `pinned` | 특정 doc id 강제 상위 | 매우 가벼움 | function_score + boost |
| `distance_feature` | 거리/시간 가까울수록 점수 ↑ | 가벼움 (built-in decay) | function_score gauss/exp |
| `rank_feature` | rank_features 필드 가중치 활용 | 가벼움 (saturation/log/sigmoid/linear) | function_score script |
| `boosting` | 매칭은 시키되 점수 깎기 (negative_boost) | 가벼움 | bool must_not 으론 표현 못함 |
| `constant_score` | 매칭만 하고 점수 상수 | 가장 가벼움 | filter context 와 동일 효과 |

## 3. 각 쿼리 deep

### 3-A. more_like_this (MLT)

```json
{
  "query": {
    "more_like_this": {
      "fields": ["title", "description"],
      "like": [{ "_index": "products", "_id": "p123" }],
      "min_term_freq": 1,
      "max_query_terms": 12
    }
  }
}
```

- 동작: doc 의 텍스트 → analyzer → top-N term 추출 → bool should
- 비용 큰 영역: term vectors 가 없으면 fielddata 로 추출
- **언제**: 단순 "관련 상품" 추천 (MVP)
- **한계**: 의미 매칭 안 됨 — 임베딩 + kNN 이 정밀

### 3-B. pinned

```json
{
  "query": {
    "pinned": {
      "ids": ["1", "4", "100"],
      "organic": { "match": { "description": "iphone" } }
    }
  }
}
```

- pinned ids 가 organic 의 결과 위에 무조건 노출
- **언제**: 광고, 큐레이션 (편집자 추천)
- **운영 팁**: pinned ids 를 검색 시점에 외부(DB/Cache)에서 가져와 동적 결합

### 3-C. distance_feature

```json
{
  "bool": {
    "must": { "match": { "name": "chocolate" } },
    "should": {
      "distance_feature": { "field": "location", "pivot": "1000m", "origin": [-71.3, 41.15] }
    }
  }
}
```

- 거리/시간 가까울수록 점수 부스트 (decay 함수 내장)
- 필드 타입: numeric / date / geo
- **언제**: recency 부스트 (`field: published_at`, `origin: now`), 매장 가까운 순 부스트
- **장점**: function_score gauss/exp 보다 빠름 (사전 정의된 함수)

### 3-D. rank_feature

```json
{
  "rank_feature": {
    "field": "pagerank",
    "saturation": { "pivot": 8 }
  }
}
```

- `rank_features` / `rank_feature` 매핑 필드의 가중치 활용
- 함수 4종: `saturation` (default), `log`, `sigmoid`, `linear`
- **언제**: 인기도, 평점, 매출량 같은 사전 계산된 numeric 부스트
- **장점**: script_score 대비 매우 빠름

### 3-E. boosting (negative_boost)

```json
{
  "boosting": {
    "positive": { "term": { "text": "apple" } },
    "negative": { "term": { "text": "pie tart fruit" } },
    "negative_boost": 0.5
  }
}
```

- 매칭은 시키되 negative 매칭 시 점수 0.5 배 (강등)
- **언제**: 광고 강등 / 품절 강등 / 카테고리 미스매치 약화
- **vs must_not**: must_not 은 제거. boosting 은 강등만.

### 3-F. constant_score

```json
{ "constant_score": { "filter": { "term": { "status": "active" } }, "boost": 1.0 } }
```

- 매칭 = 점수 상수 → filter cache 친화적
- **언제**: 점수가 무의미하고 매칭만 필요할 때 (위 예처럼 status filter)

## 4. 결합 패턴

### 4-A. 광고 + 인기도 + 검색

```json
{
  "query": {
    "pinned": {
      "ids": ["AD-001", "AD-002"],
      "organic": {
        "bool": {
          "must":   [{ "match": { "title": "shoes" } }],
          "should": [
            { "rank_feature": { "field": "popularity", "saturation": { "pivot": 100 } } },
            { "distance_feature": { "field": "published_at", "pivot": "7d", "origin": "now" } }
          ]
        }
      }
    }
  }
}
```

### 4-B. 차단 없이 강등

```json
{
  "query": {
    "boosting": {
      "positive": { "match": { "title": "laptop" } },
      "negative": { "term": { "stock_status": "out_of_stock" } },
      "negative_boost": 0.2
    }
  }
}
```

## 5. 트레이드오프 / 안티패턴

| 측면 | 권장 |
|---|---|
| 단순 boost | rank_feature / distance_feature 우선 (script_score 보다 가볍고 표현력 충분) |
| 강제 노출 | pinned (function_score 의 큰 boost 보다 명시적) |
| 강등 | boosting (must_not 은 제거 — 의도 다름) |
| 추천 | MLT 는 MVP — 정밀하면 임베딩 |

- **안티패턴**:
  - script_score 남발 — Painless 비용
  - pinned 를 매번 100건씩 — 응답 사이즈 폭발
  - boosting 의 negative_boost > 1 — 점수 부스트가 됨 (반대 효과)

## 6. 운영 / 모니터링

- profile API 로 specialized query 비용 측정
- rank_features 필드 갱신은 ingest pipeline 에서 자동화
- pinned ids 캐시 TTL 짧게 (광고 정책 변경 빠름)

## 7. msa 코드베이스 grounding

| 시나리오 | 적용 후보 |
|---|---|
| 광고 / 큐레이션 | pinned + organic |
| 인기도 가중 | rank_feature (popularity 매핑은 §27 권장) |
| 신규 상품 부스트 | distance_feature (`published_at`, `origin: now`, `pivot: 7d`) |
| 품절 강등 | boosting (`negative_boost: 0.2`) — 노출 유지 + 순위 강등 |
| "관련 상품" MVP | more_like_this — Phase 2 에서 임베딩으로 교체 |

## 8. 적용 후보 / ADR

**ADR-XXXX (Proposed)**: "검색 점수 결합 기본 도구는 specialized queries; script_score 는 마지막 수단"
- **이유**: 비용·표현력 모두 우위
- **위험**: function_score 와의 마이그레이션 시 점수 분포가 변할 수 있음 → A/B 테스트 후 결정

## 9. 면접 카드 + 꼬리질문

| Q | 핵심 답변 | 꼬리 |
|---|---|---|
| Q1. function_score 대신 rank_feature 를 쓰는 이유? | 사전 정의 함수 + rank_features 필드 — script 비용 없음 | 4 함수 (saturation/log/sigmoid/linear) 차이 |
| Q2. pinned vs function_score 강제 boost? | pinned 는 명시적 ids — 정책 변경 빠름. boost 는 점수 조작 (불확실) | 광고 정책 변경 빠른 환경에서? |
| Q3. boosting 의 negative_boost 와 must_not 차이? | boosting = 점수 강등(노출 유지), must_not = 제거 | 품절 처리는 어느게 맞나? |
| Q4. distance_feature 와 function_score gauss/exp 차이? | distance_feature 는 numeric/date/geo 전용 + 빠름. function_score 는 일반화 + 느림 | recency 부스트는 어느 쪽? |
| Q5. MLT 의 한계와 대체? | 단순 term overlap — 의미 못 잡음. 임베딩 + kNN 또는 semantic_text 가 정밀 | MLT 가 여전히 의미 있는 케이스? (cold start) |

## 10. 자주 듣는 오해 정정

| 오해 | 실제 |
|---|---|
| "boosting 의 negative 는 제거" | 강등만 (점수 × negative_boost) |
| "constant_score 는 filter 와 다른 무엇" | 본질 동일 — bool.filter 가 더 흔함 |
| "rank_feature 는 vector 의 일종" | 아님. 단일 numeric 또는 key→weight map |

## 11. 다음 학습

- §99 §F dis_max / boosting / constant_score 와 BM25 의 결합 (#06)
- §99 §G semantic / sparse_vector 와 결합 (→ [28-elser-semantic-text.md](28-elser-semantic-text.md))
- §99 §H retrievers 의 standard 노드에 specialized query 끼우기 (→ [23-retrievers-api.md](23-retrievers-api.md))
