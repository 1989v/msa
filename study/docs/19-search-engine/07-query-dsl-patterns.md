---
parent: 19-search-engine
seq: 07
title: Query DSL 패턴 — term/match/multi_match/bool/nested/suggest, filter vs query context
type: deep
created: 2026-05-03
---

# 07. Query DSL 패턴

## 1. 한 줄 핵심

> **filter 와 query 의 구분이 성능과 관련도의 시작점.**
> 정확 매칭 / sort / agg = filter (캐시), 관련도 매칭 = query (BM25 (Best Match 25)). 이걸 헷갈리면 ES (Elasticsearch) 가 느린 RDB (Relational Database, 관계형 데이터베이스) 가 된다.

## 2. Query DSL 의 구조

ES Query DSL (Domain-Specific Language, 도메인 특화 언어) = JSON 으로 표현하는 Lucene Query.

```json
{
  "query": {
    "bool": {
      "must": [ ... ],     ← query context (점수 O)
      "should": [ ... ],   ← query context (점수 O, OR-ish)
      "must_not": [ ... ], ← filter context (제외)
      "filter": [ ... ]    ← filter context (점수 X, 캐시 O)
    }
  }
}
```

→ `bool` 이 가장 자주 쓰는 컴파운드. 4개 절을 자유롭게 조합.

## 3. Filter Context vs Query Context

| context | 점수 계산 | 캐시 | 사용 패턴 |
|---|---|---|---|
| **query** | ✅ (BM25) | ❌ | 관련도 매칭 (match, multi_match, function_score) |
| **filter** | ❌ (boolean) | ✅ (filter cache, segment 단위) | 정확 매칭, range, exists, term, status/category |

### 3-1. 같은 매칭, 다른 context

```json
// query context
{ "query": { "term": { "category": "smartphone" } } }
// → 매칭 + score 계산 (대부분 1.0 같은 값)

// filter context
{ "query": { "bool": { "filter": [{ "term": { "category": "smartphone" } }] } } }
// → 매칭만, score 0, 캐시 O
```

→ 같은 결과지만 두 번째가 훨씬 빠름 (반복 쿼리 시 캐시).

### 3-2. 결정 기준

| 의도 | context |
|---|---|
| "이 카테고리/상태인 것" (boolean 조건) | **filter** |
| "가격 1만~10만 원" | **filter** |
| "재고 있음" | **filter** |
| "갤럭시와 가장 관련도 높은 것" | **query** |
| "갤럭시 또는 아이폰" (관련도 가중) | **query** (should) |
| "이 정확한 SKU" | **filter** (term) |

→ 실무 패턴: **must (관련도) + filter (조건)** 조합이 가장 흔함.

## 4. Leaf Query — 가장 작은 단위

### 4-1. term — 정확 매칭 (analyzer 미적용)

```json
{ "term": { "category": "smartphone" } }
```

- 검색어를 **그대로** inverted index 에서 lookup
- analyzer 적용 ❌ → keyword 필드 또는 정확 매칭에 사용
- text 필드에 term 쓰면 거의 항상 안 맞음 (text 는 토큰화돼 있는데 term 은 안 토큰화하니 매칭 ❌)

### 4-2. terms — 여러 값 중 하나

```json
{ "terms": { "category": ["smartphone", "tablet"] } }
```

→ SQL 의 `IN`. 짧으면 inline, 많으면 terms lookup (다른 인덱스 참조).

### 4-3. range — 범위

```json
{ "range": { "price": { "gte": 100000, "lte": 1000000 } } }
{ "range": { "created_at": { "gte": "now-30d/d" } } }
```

→ 숫자 / 날짜 범위. date math (`now-30d/d`) 지원.

### 4-4. exists — 필드 존재

```json
{ "exists": { "field": "discount_price" } }
```

→ 필드가 null 아닌 doc 만.

### 4-5. prefix / wildcard / regexp / fuzzy

```json
{ "prefix": { "name": "갤럭" } }                 // FST traversal — 빠름
{ "wildcard": { "name": "*폴드*" } }              // ⚠ 느림 (suffix wildcard)
{ "regexp": { "name": "갤[럭락]시.*" } }          // ⚠ 매우 느림
{ "fuzzy": { "name": { "value": "갤력시", "fuzziness": "AUTO" } } }  // 오타 허용
```

⚠ wildcard `*foo*` 와 regexp 는 모든 term 스캔 → 안티패턴.

### 4-6. match — 분석된 매칭 (가장 일반적)

```json
{ "match": { "name": "갤럭시 폴드" } }
```

- 검색어를 analyzer 로 토큰화 → `[갤럭시, 폴드]`
- inverted index 에서 두 term lookup
- default operator: OR (any term match)
- BM25 score 계산

옵션:
```json
{ "match": {
    "name": {
      "query": "갤럭시 폴드",
      "operator": "and",          // OR → AND
      "fuzziness": "AUTO",        // 오타 허용
      "minimum_should_match": "75%",
      "analyzer": "korean_search_analyzer"
    }
}}
```

### 4-7. match_phrase — 구문 매칭 (위치 일치)

```json
{ "match_phrase": { "name": "갤럭시 폴드" } }
```

- 토큰들이 **정확한 순서로 인접** 해야 매칭
- positions 정보 활용 (postings 의 .pos 파일)
- "폴드 갤럭시" 는 매칭 ❌

옵션:
```json
{ "match_phrase": {
    "name": {
      "query": "갤럭시 폴드",
      "slop": 2     // 토큰 간 최대 N 단어 거리 허용
    }
}}
```

### 4-8. match_phrase_prefix — 구문 + prefix

```json
{ "match_phrase_prefix": { "name": "갤럭시 폴" } }
```

→ 마지막 토큰을 prefix 로 매칭. 자동완성에서 자주 사용.

### 4-9. multi_match — 여러 필드 동시

```json
{ "multi_match": {
    "query": "갤럭시",
    "fields": ["name^3", "description", "tags^2"],
    "type": "best_fields"
}}
```

`type` 옵션:
- `best_fields` (default) — 가장 높은 점수 필드만
- `most_fields` — 모든 필드 점수 합
- `cross_fields` — 여러 필드를 하나처럼 (검색어가 필드 사이 흩어진 경우)
- `phrase` — match_phrase 처럼
- `phrase_prefix` — match_phrase_prefix 처럼
- `bool_prefix` — match_bool_prefix 처럼

`name^3` = boost 3배.

## 5. Compound Query — 조합

### 5-1. bool — 가장 중요

```json
{
  "bool": {
    "must": [                     ← AND, score O
      { "match": { "name": "갤럭시" } }
    ],
    "should": [                   ← OR-ish, score O (가산)
      { "match": { "tags": "신상" } },
      { "match": { "tags": "할인" } }
    ],
    "must_not": [                 ← NOT, score X
      { "term": { "discontinued": true } }
    ],
    "filter": [                   ← AND, score X, 캐시 O
      { "term": { "stock_available": true } },
      { "range": { "price": { "lte": 2000000 } } }
    ],
    "minimum_should_match": 1     ← should 중 최소 N개 매칭
  }
}
```

### 5-2. dis_max — Disjunction Max

```json
{
  "dis_max": {
    "queries": [
      { "match": { "name": "갤럭시" } },
      { "match": { "description": "갤럭시" } }
    ],
    "tie_breaker": 0.3
  }
}
```

→ 여러 쿼리 중 **최고 점수만** + tie_breaker 만큼 다른 점수 가산. 한 필드에 매칭이 강한 doc 이 우선.

### 5-3. function_score (§06 참고)

비즈니스 시그널 결합. 위 §6 deep file 참고.

### 5-4. constant_score — 점수 고정

```json
{ "constant_score": {
    "filter": { "term": { "category": "smartphone" } },
    "boost": 1.0
}}
```

→ filter 매칭 + 모든 doc 에 같은 score. score 가 무의미한 경우 (예: 단순 필터링) 명시적.

## 6. Nested / Parent-Child — 객체 배열 매칭

### 6-1. 평범한 object 의 함정

```json
PUT /products/_doc/1
{
  "name": "갤럭시",
  "options": [
    { "color": "black", "size": "large" },
    { "color": "white", "size": "small" }
  ]
}
```

mapping 이 default 면 ES 가 평탄화:
```
options.color: ["black", "white"]
options.size:  ["large", "small"]
```

쿼리: "color=black AND size=small" 인 옵션 → ❌ false positive (실제로는 black-large + white-small 인데 매칭됨).

### 6-2. nested 타입

```json
"options": { "type": "nested" }
```

→ 각 객체가 별도 hidden document 로 색인. nested query 로 정확 매칭:

```json
{
  "nested": {
    "path": "options",
    "query": {
      "bool": {
        "must": [
          { "term": { "options.color": "black" } },
          { "term": { "options.size": "small" } }
        ]
      }
    }
  }
}
```

### 6-3. 비용

- nested = 별도 document → 인덱스 크기 ↑
- nested query 비싸고 score 결합 복잡
- 객체 배열이 많으면 **별도 인덱스 + parent-child** 또는 **denormalize** 고려

### 6-4. join (parent-child)

```json
"my_join": {
  "type": "join",
  "relations": { "product": "review" }
}
```

→ 같은 인덱스 내 부모-자식 관계. 자식 자주 갱신 (review) + 부모 거의 안 변함 (product) 인 경우.

⚠ join 은 같은 shard 에 부모/자식 강제 → routing 필수, 클러스터 부하 ↑. **꼭 필요한 게 아니면 사용 ❌**.

## 7. Suggester — 자동완성, 오타 추천

### 7-1. Term Suggester — 오타 교정

```json
{
  "suggest": {
    "my_suggest": {
      "text": "갤력시",
      "term": { "field": "name", "suggest_mode": "popular" }
    }
  }
}
```

→ "갤력시" → ["갤럭시", ...] 추천 (Levenshtein distance).

### 7-2. Phrase Suggester — 구문 교정

```json
{
  "suggest": {
    "my_suggest": {
      "text": "갤력시 폴드",
      "phrase": { "field": "name", "size": 5 }
    }
  }
}
```

→ 구문 단위로 교정. 단일 단어보다 정확.

### 7-3. Completion Suggester — 자동완성 (FST 기반)

```json
"name_suggest": { "type": "completion" }

POST /products/_doc/1
{
  "name_suggest": { "input": ["갤럭시 폴드", "Samsung Galaxy Fold"] }
}

// 검색
{
  "suggest": {
    "my_suggest": {
      "prefix": "갤럭",
      "completion": { "field": "name_suggest", "size": 5 }
    }
  }
}
```

- FST 기반 → 매우 빠름 (수 ms)
- prefix 매칭 only
- input 에 동의어 / 변형 미리 등록

### 7-4. Search-As-You-Type 필드 (8.x+)

```json
"name": { "type": "search_as_you_type" }
```

→ 자동으로 ngram 변형 + 적절한 search analyzer 설정. completion suggester 보다 유연.

## 8. Highlight — 매칭 부분 강조

```json
{
  "query": { "match": { "name": "갤럭시" } },
  "highlight": {
    "fields": { "name": { "type": "unified" } },
    "pre_tags": ["<em>"],
    "post_tags": ["</em>"]
  }
}
```

응답:
```json
"highlight": {
  "name": ["<em>갤럭시</em> 폴드 신상"]
}
```

타입:
- `unified` (default, 8.x) — 하이브리드, 빠름
- `plain` — analyzer 재실행, 정확하지만 느림
- `fvh` (fast vector highlighter) — term_vector 필요, 큰 텍스트 빠름

→ msa 의 검색 UI 가 매칭 부분 강조하면 활용.

## 9. Aggregations — 분석 워크로드

검색과 별도로 ES 의 강력한 기능. 본 §07 의 주제는 아니지만 간단히:

### 9-1. Bucket Aggregation

```json
{
  "size": 0,
  "aggs": {
    "by_category": {
      "terms": { "field": "category", "size": 10 }
    }
  }
}
```

→ 카테고리별 doc 수. SQL 의 `GROUP BY`.

### 9-2. Metric Aggregation

```json
{
  "aggs": {
    "avg_price": { "avg": { "field": "price" } },
    "max_price": { "max": { "field": "price" } }
  }
}
```

### 9-3. 중첩

```json
{
  "aggs": {
    "by_category": {
      "terms": { "field": "category" },
      "aggs": {
        "avg_price": { "avg": { "field": "price" } }
      }
    }
  }
}
```

⚠ 고-cardinality 필드 (예: user_id) 의 terms agg 는 메모리 폭증 → composite agg 또는 sampler agg 검토.

## 10. 페이지네이션

### 10-1. from + size — 작은 페이지 only

```json
{ "from": 0, "size": 20 }
```

⚠ `from` 이 커지면 (예: 1000+) 모든 shard 에서 from+size 만큼 가져와서 머지 → 비용 폭증.
- **`max_result_window` default 10000** (이상 거부)

### 10-2. search_after — 깊은 페이지

```json
// 1페이지
{ "size": 20, "sort": [{ "_score": "desc" }, { "_id": "desc" }] }

// 다음 페이지 (마지막 결과의 sort 값 전달)
{ "size": 20, "search_after": [0.5, "p100"], "sort": [...] }
```

→ 무한 스크롤. 일관성을 위해 PIT (Point In Time) 와 결합 권장.

### 10-3. scroll API (legacy)

⚠ Deprecated. PIT + search_after 권장.

## 11. 실전 패턴 — 이커머스 검색 종합

```json
{
  "query": {
    "function_score": {
      "query": {
        "bool": {
          "must": [
            {
              "multi_match": {
                "query": "갤럭시 폴드",
                "fields": ["name^3", "description", "tags^2"],
                "type": "best_fields",
                "fuzziness": "AUTO"
              }
            }
          ],
          "filter": [
            { "term": { "stock_available": true } },
            { "range": { "price": { "gte": 100000, "lte": 3000000 } } },
            { "terms": { "category": ["smartphone", "tablet"] } }
          ],
          "must_not": [
            { "term": { "discontinued": true } }
          ],
          "should": [
            { "match": { "tags": "신상" } }
          ]
        }
      },
      "functions": [
        { "field_value_factor": { "field": "click_count", "modifier": "log1p" } },
        { "gauss": { "created_at": { "scale": "30d" } } }
      ],
      "score_mode": "sum",
      "boost_mode": "multiply"
    }
  },
  "highlight": {
    "fields": { "name": {} }
  },
  "size": 20,
  "sort": [
    "_score",
    { "popularity": "desc" }
  ],
  "_source": ["product_id", "name", "price", "image_url"],
  "aggs": {
    "by_category": { "terms": { "field": "category" } },
    "price_ranges": { "histogram": { "field": "price", "interval": 100000 } }
  }
}
```

→ filter (재고/가격/카테고리/단종) + multi_match (관련도) + function_score (인기/신상) + highlight + facet aggs.

## 12. 흔한 실수 패턴

### 12-1. text 필드에 term

```json
{ "term": { "name": "갤럭시" } }   // ❌ name 이 text 면 거의 안 맞음
```

→ keyword 필드 또는 match 사용.

### 12-2. 필터를 must 에

```json
{ "must": [{ "term": { "stock_available": true } }] }   // ⚠ score 계산 + 캐시 ❌
```

→ filter 로.

### 12-3. wildcard `*foo*` 남용

→ 모든 term 스캔. analyzer + match 또는 ngram 으로 대체.

### 12-4. 깊은 from + size

→ `from=10000` 같은 거 ❌. search_after + PIT.

### 12-5. nested 객체 배열을 default object 로

→ false positive. nested type 명시.

### 12-6. _source 를 모두 가져옴

→ 큰 doc 에서 네트워크/직렬화 비용. `_source: ["필요필드"]` 로 projection.

### 12-7. highlight 를 fvh 없이 큰 텍스트에

→ unified 도 느려질 수 있음. term_vector 색인 + fvh.

### 12-8. terms agg 의 size default (10) 그대로

→ 카테고리 100개인데 top 10 만 봄. composite agg 또는 명시적 size.

## 13. 성능 가이드

### 13-1. profile API 로 측정

```json
{ "profile": true, "query": ... }
```

→ shard 별 단계별 시간.

### 13-2. _search 의 took vs shard time

- `took` = client 가 받기까지의 총 시간
- shard time = 각 shard 에서의 query 시간
- `took` >> shard time → coordinating 노드 fan-out / 머지가 병목

### 13-3. cache 활용

- query cache (filter context) — 자주 쓰는 필터 효과적
- shard request cache — agg-only 쿼리 (size=0) 에 유용
- field data cache — sort/agg 의 메모리 (text 필드는 비효율)

## 14. msa 시사점

`search:app` 의 검색 API 가 외부 (FE / BFF) 노출 시:

- 사용자 입력 → Query DSL 변환 (raw 노출 ❌, 보안)
- filter / query 분리 명시적 코딩 (성능)
- nested 가 진짜 필요한지 판단 (옵션, 변형, 리뷰)
- pagination = search_after 표준 (깊은 페이지 대비)
- highlight 사용 시 fvh + term_vector 색인

→ §15 에서 실제 코드 분석.

## 15. 자주 듣는 오해 정정

> **"term 과 match 는 같다"**

- ❌ term = analyzer 미적용 (raw lookup), match = analyzer 적용 + 토큰화 + BM25.

> **"filter 는 query 보다 결과가 적다"**

- ❌ 같은 매칭. 점수와 캐시만 다름.

> **"must 와 filter 는 같다 (AND)"**

- ⚠ AND 인 점은 같지만 must = score 계산 / filter = score X + 캐시.

> **"wildcard 와 regexp 는 비슷한 비용"**

- ⚠ 둘 다 비싸지만 prefix wildcard (`foo*`) 는 빠름 (FST). suffix/middle 은 느림.

> **"from=10000 도 가능하다"**

- ❌ `max_result_window` 제한. search_after 가 표준.

> **"aggregation 은 가벼운 연산이다"**

- ❌ 고-cardinality 필드면 메모리 폭증. composite + sampler.

## 16. 다음 학습

- [08-vector-search-hnsw.md](08-vector-search-hnsw.md) — vector kNN query 추가
- [09-hybrid-search-rrf.md](09-hybrid-search-rrf.md) — bool + kNN 결합
- [10-reranking-cross-encoder-ltr.md](10-reranking-cross-encoder-ltr.md) — function_score 한계 → re-rank
- [15-msa-search-grounding.md](15-msa-search-grounding.md) — msa 의 실제 Query DSL 코드

> **§07 회독 체크리스트**:
> - [ ] filter context vs query context 의 차이를 점수와 캐시 관점에서 답한다
> - [ ] term vs match 의 차이를 analyzer 관점에서 답한다
> - [ ] bool 의 4개 절 (must/should/must_not/filter) 의 의미와 사용 시점
> - [ ] multi_match 의 type 4개 (best_fields / most_fields / cross_fields / phrase) 의 차이
> - [ ] nested 가 필요한 시나리오와 비용
> - [ ] from + size vs search_after 의 사용 시점
> - [ ] suggester 3종 (term / phrase / completion) 의 차이
