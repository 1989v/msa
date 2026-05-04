---
parent: 19-search-engine
seq: 36
title: 자동완성 — ngram / edge_ngram / search_as_you_type / completion suggester / _terms_enum
type: deep-dive
created: 2026-05-04
updated: 2026-05-04
status: completed
related:
  - 99-concept-catalog.md
  - 04-analyzer-pipeline.md
  - 05-korean-morphology-nori.md
  - 07-query-dsl-patterns.md
  - 15-msa-search-grounding.md
sources:
  - https://www.elastic.co/docs/reference/text-analysis/analysis-edgengram-tokenizer
  - https://www.elastic.co/docs/reference/text-analysis/analysis-ngram-tokenizer
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/search-as-you-type
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-suggesters
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/terms-enum
catalog-row: "§A.search-as-you-type / §H.terms-enum / §B.tokenizer (ngram·edge_ngram)"
---

# 36. 자동완성 — ngram / edge_ngram / search_as_you_type / completion suggester / _terms_enum

> 카탈로그 매핑: §99 §A `search_as_you_type` (★ → ✅), §H `_terms_enum` (★ → ✅), §B tokenizer (보강).
> 학습 시간 예상: ~2h · 자가평가 입구 레벨: B

> §04 4-3 / 7-2 에서 짧게 다룬 ngram / edge_ngram 의 수식·인덱스 비용·검색 시 함정과, autocomplete 구현 5가지 (custom edge_ngram / search_as_you_type / completion suggester / _terms_enum / prefix query) 의 트레이드오프를 정리. msa 의 product 검색 자동완성 도입 가이드 포함.

---

## 1. 한 줄 핵심

> **자동완성은 "검색 전 단계의 검색" — 인덱스 비용 vs latency vs UX 정확도의 trade-off.**
> 단순 영문 prefix → `search_as_you_type`, 한국어 / fuzzy / context → custom edge_ngram + search_analyzer 분리, 빈도 가중 sorted suggestion → completion suggester (FST (Finite State Transducer, 유한 상태 변환기) 기반), keyword 필드 prefix 만 → `_terms_enum`.

---

## 2. 자동완성 구현 5가지 비교 한눈에

| 방식 | 인덱스 비용 | 검색 latency | 정확도 / 유연성 | 한국어 적합도 |
|---|---|---|---|---|
| **prefix query** (raw text) | 0 (없음) | ⚠️ O(N) — 느림 | 단순 prefix만 | △ (분석기 의존) |
| **custom edge_ngram** | ↑↑ (인덱스 5~20x) | ⚡ O(1) (term lookup) | prefix + fuzzy + 조합 | ✅ 강력 (자모/형태소 결합 가능) |
| **search_as_you_type** | ↑ (자동 생성 4 sub-field) | ⚡ O(1) | 영문 prefix + infix | ⚠️ 영문 default, 한국어 별도 analyzer |
| **completion suggester** | ↑ (별도 in-memory FST) | ⚡⚡ μs 단위 | sorted by weight, context 기반 | △ (한글 가능하지만 형태소 X) |
| **`_terms_enum`** (8.x+) | 0 (기존 keyword 활용) | ⚡ O(log N) | keyword 필드 prefix | △ (정확 일치만) |

→ **선택 기준**: 한국어 형태소 + 다양한 패턴 → custom edge_ngram. 영문 도메인 + 빈도 정렬 → completion suggester. 단순 administrative dropdown → `_terms_enum`.

---

## 3. ngram vs edge_ngram — 정의와 수식

### 3-1. 정의

**ngram**: 문자열의 모든 N-character 슬라이딩 윈도우.

```
"갤럭시" + min_gram=2, max_gram=3:
  2-gram: [갤럭, 럭시]
  3-gram: [갤럭시]
  결과: [갤럭, 럭시, 갤럭시]
```

**edge_ngram**: 문자열 시작점 (edge) 부터의 prefix N-gram.

```
"갤럭시" + min_gram=1, max_gram=3:
  1-gram: [갤]
  2-gram: [갤럭]
  3-gram: [갤럭시]
  결과: [갤, 갤럭, 갤럭시]
```

### 3-2. 인덱스 크기 폭증 — 수치 분석

doc 1만 개, 평균 단어 5글자 (예: "Galaxy") 가정.

| Tokenizer | 토큰 수 / 단어 | 1만 doc 토큰 합 | 인덱스 크기 (대략) |
|---|---|---|---|
| `standard` | 1 | 1만 | 1x (baseline) |
| `edge_ngram(1, 5)` | 5 | 5만 | **5x** |
| `edge_ngram(1, 10)` | 평균 5 (단어 짧으면 max 미달) | 5만 | 5x |
| `ngram(2, 3)` | 평균 ~7 | 7만 | **7x** |
| `ngram(1, 5)` | 평균 ~15 | 15만 | **15x** |
| `ngram(1, 10)` | 평균 ~25 | 25만 | **25x** |

**5글자 단어 N-gram 토큰 수 공식**:

```
ngram(min, max) 토큰 수 = sum_{n=min}^{max} (L - n + 1)  for L >= n

L=5, ngram(1,5): 5+4+3+2+1 = 15 토큰
L=5, edge_ngram(1,5): 5 토큰 (prefix 만)
```

→ ngram 은 단어 길이의 **제곱 차수** 로 토큰 수 증가 → 인덱스 폭증.

### 3-3. 시간 복잡도 — 검색 latency

검색은 **term lookup** 이라 O(1) 에 가까운 hash/skip-list. 토큰이 많아도 검색은 빠름. 단:

- **disk IO** ↑ (큰 segment → page cache miss ↑)
- **merge 비용** ↑ (segment 크면 merge IO ↑)
- **메모리** ↑ (term dictionary in-memory 일부)

→ "검색은 빠르지만 클러스터 자원 잡아먹음".

### 3-4. ngram vs edge_ngram 사용 분기

| 시나리오 | 선택 |
|---|---|
| 자동완성 (prefix) — "갤럭" 입력 → "갤럭시" | **edge_ngram** |
| 부분 문자열 검색 (substring) — "럭시" 입력 → "갤럭시" 매칭 | ngram (또는 wildcard) |
| 오타 허용 fuzzy autocomplete | edge_ngram + fuzzy match |
| URL / 코드 검색 — 임의 substring | ngram |
| 한국어 초성 검색 ("ㄱㄹㅅ" → "갤럭시") | 자모 분리 + edge_ngram (§7) |
| 1만~ 단어 dropdown 자동완성 | completion suggester (별도) |

**원칙**: prefix 만 필요하면 **edge_ngram** (인덱스 절반). substring 까지 필요하면 ngram 감수 또는 `wildcard` 필드 타입.

---

## 4. min_gram / max_gram 튜닝

### 4-1. 기본 효과

| 설정 | 효과 |
|---|---|
| `min_gram=1` | 한 글자 입력에도 매칭. UX ✅, 인덱스 ↑↑ + 결과 폭증 |
| `min_gram=2` | "갤" 입력은 매칭 ❌, "갤럭" 부터. UX 약간 ↓, 인덱스 ↓ |
| `min_gram=3` | 3글자 이상만. 인덱스 효율, UX ↓ |
| `max_gram=10` | 10글자 prefix 까지. 긴 단어 손실 |
| `max_gram=20` | 더 긴 단어 커버. 인덱스 ↑ |

### 4-2. 권장 default

```json
"edge_ngram": {
  "type": "edge_ngram",
  "min_gram": 1,
  "max_gram": 20
}
```

- `min_gram=1` 은 한국어 / 한글 1글자 입력 (예: "갤") 도 매칭하기 위해 필요한 경우 多.
- `max_gram=20` 은 일반 한국어 / 영문 단어 길이 cap.
- 인덱스 폭증이 우려되면 `min_gram=2` 부터 시작.

### 4-3. ES 의 `index.max_ngram_diff` 제한

```
index.max_ngram_diff = max_gram - min_gram
default = 1
```

→ **default 가 1** — `min_gram=1, max_gram=10` 같은 설정 시 settings 에서 명시적으로 늘려야:

```json
PUT /products
{
  "settings": {
    "index.max_ngram_diff": 19,
    ...
  }
}
```

`index.max_ngram_diff` 가 너무 크면 토큰 폭증 + DoS 위험 → ES 가 막아둠.

---

## 5. search_analyzer 분리 — 가장 흔한 함정

### 5-1. 문제 시나리오

```json
{
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "analyzer": "edge_ngram_analyzer"   // 인덱싱 + 검색 모두
      }
    }
  }
}
```

- 인덱싱: "갤럭시" → `[갤, 갤럭, 갤럭시]` ✅
- 검색: "갤럭" → `[갤, 갤럭]` (검색어도 ngram 화)
  - "갤" 매칭 (모든 갤로 시작하는 doc) + "갤럭" 매칭 → **결과 폭증**

→ 사용자가 "갤럭" 입력했는데 "갤럭시", "갤스", "갤탱" 다 매칭.

### 5-2. 해법 — search_analyzer 분리

```json
{
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "analyzer": "edge_ngram_analyzer",      // 인덱싱
        "search_analyzer": "standard"           // 검색
      }
    }
  }
}
```

- 인덱싱: "갤럭시" → `[갤, 갤럭, 갤럭시]`
- 검색: "갤럭" → `[갤럭]` (그대로) → 인덱스의 "갤럭" 매칭 → "갤럭시" ✅

### 5-3. 일반 원칙

| 분석기 종류 | 인덱싱 | 검색 |
|---|---|---|
| Synonym | doc 에 동의어 다 색인 (인덱스 ↑) | 검색어 동의어 확장 (재인덱싱 X) **권장** |
| edge_ngram | 모든 prefix 색인 ✅ | **검색어 그대로** (search_analyzer = standard 또는 keyword) |
| Stemmer | 어간으로 색인 ✅ | 어간으로 변환 후 매칭 ✅ (양쪽 동일) |
| Lowercase | 양쪽 동일 ✅ | 양쪽 동일 |

**원칙**: **인덱싱과 검색의 토큰화 결과가 일치할 수 있게 분기**.

### 5-4. ES 8+ 의 `search_as_you_type` 필드 타입

위 함정을 자동 처리:

```json
{
  "mappings": {
    "properties": {
      "name": {
        "type": "search_as_you_type"
      }
    }
  }
}
```

내부적으로:
- `name` (root) — 표준 분석
- `name._2gram` — 2-shingle (인접 두 단어)
- `name._3gram` — 3-shingle
- `name._index_prefix` — edge_ngram(1, 20)

→ 검색 시 `multi_match` 가 자동으로 sub-field 들을 다 활용:

```json
{
  "query": {
    "multi_match": {
      "query": "갤럭",
      "type": "bool_prefix",
      "fields": ["name", "name._2gram", "name._3gram"]
    }
  }
}
```

→ search_analyzer 분리 신경 안 써도 됨. **8.x 의 권장 default**.

---

## 6. completion suggester — FST 기반 빠른 자동완성

### 6-1. 동기

ngram / edge_ngram 의 한계:
- 빈도 정렬 ❌ (자주 검색되는 단어가 위로 안 옴)
- in-memory 가 아니라 disk index → ms 단위 latency

`completion suggester` 는 별도 자료구조 (FST — Finite State Transducer) 를 in-memory 에 두고, **μs 단위** 자동완성 + **weight 기반 정렬**.

### 6-2. 사용 — 매핑

```json
{
  "mappings": {
    "properties": {
      "suggest": {
        "type": "completion",
        "analyzer": "simple",
        "preserve_separators": true,
        "preserve_position_increments": true,
        "max_input_length": 50
      }
    }
  }
}
```

### 6-3. 사용 — 인덱싱 (weight 포함)

```json
PUT /products/_doc/1
{
  "name": "갤럭시 폴드",
  "suggest": {
    "input": ["갤럭시 폴드", "Galaxy Fold"],
    "weight": 100   // 인기 ↑ → 위로
  }
}
```

### 6-4. 사용 — 쿼리

```json
POST /products/_search
{
  "suggest": {
    "product-suggest": {
      "prefix": "갤럭",
      "completion": {
        "field": "suggest",
        "size": 5
      }
    }
  }
}
```

응답:
```json
{
  "suggest": {
    "product-suggest": [{
      "options": [
        { "text": "갤럭시 폴드", "_score": 100 },
        { "text": "갤럭시 S24", "_score": 80 }
      ]
    }]
  }
}
```

### 6-5. context-aware suggester

특정 카테고리 / 위치에 한정된 추천:

```json
{
  "suggest": {
    "type": "completion",
    "contexts": [
      { "name": "category", "type": "category" },
      { "name": "location", "type": "geo", "precision": 5 }
    ]
  }
}
```

검색 시:
```json
{
  "suggest": {
    "product-suggest": {
      "prefix": "갤럭",
      "completion": {
        "field": "suggest",
        "contexts": {
          "category": ["smartphone"]
        }
      }
    }
  }
}
```

→ "갤럭시 폰" 만, "갤럭시 게임" 같은 다른 카테고리는 제외.

### 6-6. 한계

- **fuzzy 약함** — completion suggester 의 fuzzy 는 edit distance 1~2 정도, 형태소 / 동의어 X
- **한국어 형태소 결합 ❌** — nori 와 결합 어려움
- **delete 후 즉시 반영 ❌** — segment merge 까지 stale (FST 가 segment-bound)
- **인덱스 크기 ↑** — 별도 in-memory FST + 디스크
- **별도 필드 매핑 필요** — 기존 `name` 필드와 별도

→ **단순 영문 / 한글 전체 단어 자동완성 + 빈도 정렬** 에 최적. 한국어 형태소 / 부분 매칭은 custom edge_ngram 가 더 적합.

---

## 7. 한국어 자동완성의 함정

### 7-1. 자모 분리 — 입력 중간 글자 처리

사용자가 "갤럭ㅅ" 까지 입력했을 때 — "ㅅ" 은 미완성 자음.

해법: **자모 분리** (한글 분해).

```
"갤럭ㅅ" → ["ㄱㅐㄹㄹㅓㄱㅅ"]  (자모 단위 토큰화)
"갤럭시" → ["ㄱㅐㄹㄹㅓㄱㅅㅣ"]
→ "ㄱㅐㄹㄹㅓㄱㅅ" 이 "갤럭시" 의 prefix → 매칭 ✅
```

### 7-2. ICU + Hangul Decomposer

ES 의 `analysis-icu` (ICU (International Components for Unicode, 유니코드 국제화 컴포넌트) 기반) 플러그인 + `hangul_decomposer` 토큰 필터로 NFD (Normalization Form Decomposed, 정규화 분해 — 한글 자모 분리) 를 적용:

```json
{
  "settings": {
    "analysis": {
      "char_filter": {
        "hangul_decomposer": {
          "type": "icu_normalizer",
          "name": "nfd"
        }
      },
      "tokenizer": {
        "edge_ngram_jamo": {
          "type": "edge_ngram",
          "min_gram": 1,
          "max_gram": 30
        }
      },
      "analyzer": {
        "korean_autocomplete": {
          "char_filter": ["hangul_decomposer"],
          "tokenizer": "edge_ngram_jamo"
        }
      }
    }
  }
}
```

→ 인덱싱 시 자모 분리 + edge_ngram. 검색 시 입력도 자모 분리 후 매칭.

### 7-3. 초성 검색

"ㄱㄹㅅ" → "갤럭시" 매칭.

```
"갤럭시" → 초성 추출 → "ㄱㄹㅅ"
인덱싱 시 초성 토큰도 함께: "갤럭시" → ["갤럭시", "ㄱㄹㅅ", "갤", "갤럭", "ㄱㄹ", ...]
```

→ 별도 `analyzer` (초성 추출용 char_filter) 또는 application 레벨 초성 변환 후 색인.

### 7-4. 한영 키보드 오타

"rkffprtl" 입력 → 사용자는 "갤럭시" 칠 의도였음 (한영 키 안 누르고 영문으로 침).

해법:
- application 에서 한영 변환 (qwerty ↔ 한글 매핑) 후 검색어 두 개 OR
- 별도 분석 ❌ — application 책임

### 7-5. 한국어 자동완성 안티패턴

| 안티패턴 | 문제 |
|---|---|
| nori + edge_ngram 동시 적용 | 형태소 분해된 토큰의 prefix → 의미 파편화 |
| `min_gram=2` 한글 적용 | 1글자 한글 검색 (예: "갤") 매칭 ❌ |
| search_analyzer = edge_ngram | 검색어 자체 ngram 화 → 결과 폭증 |
| ICU 없이 자모 분리 | 미완성 자음 입력 처리 ❌ |

---

## 8. `_terms_enum` API — 8.x 의 가벼운 옵션

### 8-1. 동기

기존 keyword 필드에 대해 **prefix 기반 빠른 자동완성**. ngram / suggester 인덱스 만들기 무거울 때.

### 8-2. 사용

```http
POST /products/_terms_enum
{
  "field": "brand.keyword",
  "string": "갤",
  "size": 10,
  "case_insensitive": true
}
```

응답:
```json
{
  "terms": ["갤럭시", "갤탱", "갤레오스"],
  "complete": true
}
```

### 8-3. 특징

- keyword 필드 의존 — 텍스트 분석 없이 raw value prefix.
- O(log N) — keyword 의 sorted dictionary 활용.
- **별도 인덱스 ❌** — 기존 매핑 그대로 사용.
- 빈도 정렬 ❌ — 사전순.

### 8-4. 적합 시나리오

- administrative dropdown (브랜드 목록, 카테고리 목록 등)
- keyword 필드의 unique value 개수 ≤ 수십만
- 한국어 형태소 / fuzzy 불필요

→ **product 검색의 사용자용 자동완성에는 부적합** (형태소 / 빈도 / 부분 매칭 ❌). administrative tool 에 적합.

---

## 9. 의사결정 가이드 — 5가지 중 무엇을 고를까

### 9-1. 흐름도

```
자동완성 필요
│
├── administrative tool / 단순 dropdown?
│   ├── 예 → _terms_enum
│   └── 아니오 ↓
│
├── 영문 도메인 + 빈도 정렬 + 단순 prefix?
│   ├── 예 → completion suggester
│   └── 아니오 ↓
│
├── 한국어 형태소 + 자모 + 초성?
│   ├── 예 → custom edge_ngram + ICU + 자모 분리 (search_analyzer 분리 필수)
│   └── 아니오 ↓
│
├── 영문 prefix + infix?
│   ├── 예 → search_as_you_type
│   └── 아니오 ↓
│
└── 결과 양 ↓ + 인덱스 비용 우선?
    └── 예 → prefix query (raw, latency ↑)
```

### 9-2. 도메인별 default

| 도메인 | 1순위 | 2순위 |
|---|---|---|
| 한국어 이커머스 (msa) | custom edge_ngram + ICU 자모 분리 | search_as_you_type 보조 |
| 영문 이커머스 | search_as_you_type | completion suggester (top 인기) |
| 검색엔진 / 위키 | completion suggester (weight=조회수) | edge_ngram 보조 |
| 코드 검색 | ngram (substring) + wildcard | prefix query |
| 위치 기반 (지도) | completion suggester + geo context | _terms_enum (위치명) |

---

## 10. msa 적용 (§15 grounding 보강)

### 10-1. 현재 상태 (§15 점검 2)

```kotlin
@Field(type = Text, analyzer = "nori")  // text only
```

→ `name` 필드에 nori 만, **자동완성 미적용**.

### 10-2. 도입 옵션

#### 옵션 A — search_as_you_type 가벼운 도입

```kotlin
@MultiField(
    mainField = Field(type = Text, analyzer = "nori"),
    otherFields = [
      InnerField(suffix = "raw", type = Keyword),
      InnerField(suffix = "autocomplete", type = SearchAsYouType)
    ]
)
val name: String
```

- 장점: 매핑 변경만, search_analyzer 분리 자동
- 단점: 한국어 자모 / 초성 ❌, 영문 prefix 만 OK

#### 옵션 B — custom edge_ngram + ICU (한국어 풀 자동완성)

```kotlin
// settings.json
{
  "analysis": {
    "char_filter": {
      "hangul_nfd": { "type": "icu_normalizer", "name": "nfd" }
    },
    "tokenizer": {
      "edge_ngram_korean": {
        "type": "edge_ngram",
        "min_gram": 1,
        "max_gram": 30
      }
    },
    "analyzer": {
      "autocomplete_index": {
        "char_filter": ["hangul_nfd"],
        "tokenizer": "edge_ngram_korean",
        "filter": ["lowercase"]
      },
      "autocomplete_search": {
        "char_filter": ["hangul_nfd"],
        "tokenizer": "keyword",
        "filter": ["lowercase"]
      }
    }
  }
}
```

```kotlin
@MultiField(
    mainField = Field(type = Text, analyzer = "nori"),
    otherFields = [
      InnerField(
        suffix = "autocomplete",
        type = Text,
        analyzer = "autocomplete_index",
        searchAnalyzer = "autocomplete_search"
      )
    ]
)
val name: String
```

- 장점: 한국어 자모 분리 + prefix 매칭, 결과 폭증 없음
- 단점: 인덱스 크기 5~10x, ICU 플러그인 의존

#### 옵션 C — completion suggester (인기 키워드 정렬)

별도 `suggest` 필드 + Kafka 이벤트 기반 weight 갱신:
```
analytics → search.click.aggregated → product.suggest.weight 갱신
```

- 장점: μs 단위 latency + 인기 정렬
- 단점: 별도 필드 / FST in-memory / 한국어 형태소 ❌

### 10-3. 권장 도입 흐름

```
Phase 1: 옵션 A (search_as_you_type) — 영문 prefix 우선, 1주 내
Phase 2: 옵션 B (custom edge_ngram + ICU) — 한국어 자동완성, 2~3주
Phase 3: 옵션 C (completion suggester) — 인기 정렬, analytics 연동 후
```

### 10-4. ADR 후보 (§19 보강)

> **ADR-XXXX-5: 검색 자동완성 — 단계적 도입 (search_as_you_type → custom edge_ngram → completion suggester)**

---

## 11. 안티패턴 정리

### 11-1. ngram 으로 자동완성

- `ngram(1, 10)` 으로 prefix 자동완성? → 인덱스 25x + 검색 결과 폭증 ❌
- prefix 만 필요하면 `edge_ngram` 으로 절반 비용.

### 11-2. search_analyzer 분리 안 함

- 인덱싱 + 검색 모두 edge_ngram → "갤" 입력에 모든 "갤" 시작 매칭 + "갤럭", "갤탱", "갤레오스" 다 노출.
- **반드시 `search_analyzer: keyword` 또는 `standard`**.

### 11-3. min_gram=1 + max_gram=20 with index.max_ngram_diff default

- ES error: "max_ngram_diff exceeded".
- `index.max_ngram_diff: 19` 설정 명시 필요.

### 11-4. completion suggester 에 한국어 형태소

- `analyzer: nori` + completion suggester → 형태소 분해 → "갤럭시 폴드" 가 "갤럭시" + "폴드" → "갤" 검색 시 안 잡힘.
- completion suggester 는 simple analyzer 권장.

### 11-5. 자모 분리 없이 한국어 edge_ngram

- "갤럭" 까지 OK, "갤럭ㅅ" (ㅅ 미완성) → 매칭 ❌.
- ICU NFD char_filter 필수.

### 11-6. 자동완성과 본 검색을 같은 query 로

- 자동완성 query 가 무거우면 typing 마다 latency.
- 자동완성 = 별도 endpoint + 별도 필드. multi_match 풀 query 재사용 ❌.

### 11-7. 인기 정렬 없이 사전순

- "갤" 입력에 "갤레오스" 가 "갤럭시" 보다 위 (사전순) → UX ↓
- weight 기반 정렬 필요 (completion suggester 또는 function_score with click_count).

---

## 12. 면접 한 줄 답변

### Q. ngram 과 edge_ngram 의 차이는?

> "ngram 은 모든 위치의 N-character 슬라이딩 윈도우 (substring 매칭용), edge_ngram 은 시작점부터의 prefix N-gram (자동완성용) 입니다. 단어 길이 L 에 대해 ngram(1,L) 은 L²/2 토큰, edge_ngram(1,L) 은 L 토큰 — 인덱스 비용 차이가 5~10배 납니다."

### Q. 자동완성에서 search_analyzer 를 분리하는 이유는?

> "인덱싱 시점은 edge_ngram 으로 모든 prefix 를 색인해야 하지만, 검색 시점에 검색어를 또 ngram 화하면 1글자 토큰 (예: "갤") 이 모든 "갤" 시작 doc 에 매칭되어 결과가 폭증합니다. search_analyzer 를 standard 또는 keyword 로 분리해서 검색어는 그대로 매칭해야 정확합니다."

### Q. search_as_you_type 와 custom edge_ngram 중 무엇을 쓰나요?

> "영문 도메인 + 빠른 도입이면 search_as_you_type 이 8.x default — 4 sub-field (root + 2gram + 3gram + index_prefix) 가 자동 생성되어 search_analyzer 분기까지 자동 처리됩니다. 한국어 자모 분리 / 초성 검색이 필요하면 ICU + custom edge_ngram 가 강력합니다."

### Q. completion suggester 는 언제 쓰나요?

> "별도 in-memory FST 자료구조에 weight (인기) 와 함께 저장하고 μs 단위로 응답해야 할 때입니다. 빈도 기반 정렬 + context-aware (카테고리/위치) 가 강점이고, 단점은 한국어 형태소 결합이 어렵고 segment-bound 라 doc 삭제 시 stale 가능성이 있습니다."

### Q. `_terms_enum` 은 무엇인가요?

> "8.x 에 추가된 가벼운 자동완성 API 입니다. 기존 keyword 필드의 sorted dictionary 를 활용해 prefix 매칭을 O(log N) 에 응답합니다. 별도 인덱스가 없어 administrative dropdown 이나 단순 unique value 자동완성에 적합하고, 사용자용 한국어 검색 자동완성에는 부족합니다."

### Q. 한국어 자동완성에서 자모 분리가 왜 필요한가요?

> "사용자가 \"갤럭ㅅ\" 처럼 미완성 자음을 입력했을 때 매칭하려면, 인덱싱 시점과 검색 시점 모두 자모 단위로 분해해야 합니다. ICU 의 NFD (Normalization Form Decomposed) char_filter 로 한글을 자모 단위로 분해한 후 edge_ngram 을 적용하는 게 표준입니다."

### Q. msa 의 product 검색에는 자동완성이 적용돼 있나요?

> "현재는 ProductDocument.name 에 nori 만, 자동완성 미적용입니다. §15 점검 2 에서 지적된 search_analyzer 미분리 + ngram/edge_ngram 미사용 상태입니다. 단계적 도입 ADR 이 후보로, 1단계는 search_as_you_type 가벼운 매핑 추가, 2단계는 ICU + custom edge_ngram, 3단계는 analytics 연동 completion suggester 입니다."

---

## 13. 흔한 오해 정정

> **"ngram 이 자동완성에 가장 좋다"**

- ❌ ngram 은 substring 매칭용. 자동완성은 prefix 만 필요하므로 **edge_ngram** 이 적절. 인덱스 절반.

> **"min_gram=1 이 항상 좋다"**

- ⚠ 1글자 입력 매칭은 UX ↑ 지만, 인덱스 폭증 + 결과 폭증. 한국어는 1, 영문은 2 가 흔한 절충.

> **"completion suggester 가 가장 빠르니 default"**

- ⚠ μs 단위 빠르지만 한국어 형태소 / 부분 매칭 / fuzzy 한계. 영문 + 빈도 정렬에 최적, 한국어 다양한 패턴은 custom edge_ngram.

> **"`_terms_enum` 이 자동완성의 표준"**

- ❌ 8.x 신규지만 keyword 필드 단순 prefix 만. 사용자용 자동완성보다 administrative tool 용.

> **"search_as_you_type 이 한국어 자동완성도 자동 처리"**

- ⚠ 영문 prefix + infix 는 자동, 한국어 자모 / 초성은 별도 analyzer 필요.

> **"edge_ngram 만 적용하면 자동완성 끝"**

- ❌ search_analyzer 분리 안 하면 결과 폭증. **항상 분리**.

---

## 14. 회독 체크리스트

> §36 회독 체크리스트:
> - [ ] ngram vs edge_ngram 의 토큰 수 공식 (단어 길이 L 에 대해 L² vs L)
> - [ ] 5가지 자동완성 옵션 (prefix / edge_ngram / search_as_you_type / completion suggester / _terms_enum) 의 trade-off 매트릭스
> - [ ] search_analyzer 분리가 왜 필수인지 (1글자 검색 폭증 시나리오)
> - [ ] `index.max_ngram_diff` default=1 + 큰 ngram diff 시 명시 필요
> - [ ] completion suggester 가 빠른 이유 (FST in-memory + segment-bound)
> - [ ] 한국어 자동완성의 3 함정 (자모 / 초성 / 한영 키)
> - [ ] msa 의 product.name 자동완성 미적용 → 3단계 도입 답변
> - [ ] ICU NFD 가 한국어 자모 분리에 쓰이는 이유

---

## 15. 연결 학습

- §04 4-3 / 5-5 / 7-2 — ngram / edge_ngram 짧은 소개 (이 파일이 풀어 씀)
- §05 — 한국어 nori 형태소 (자동완성과 결합 시 함정)
- §07 — Query DSL 의 prefix / wildcard query (자동완성 대안 옵션)
- §15 점검 2 — msa 의 search_analyzer 미분리 점검 (이 파일이 해법 제시)
- §34 — 자동완성 도입 효과를 nDCG / CTR 로 측정
