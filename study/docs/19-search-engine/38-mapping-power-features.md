---
parent: 19-search-engine
seq: 38
title: Mapping 강력 기능 통합 — copy_to / runtime / dynamic_templates / scaled_float / object 4-패턴 / doc_values / _routing / combined_fields / terms-lookup
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 27-mapping-field-types.md
  - 04-analyzer-pipeline.md
  - 07-query-dsl-patterns.md
  - 12-cluster-topology-shard-sizing.md
  - 15-msa-search-grounding.md
  - 26-aggregations-catalog.md
  - 32-specialized-queries.md
  - 36-autocomplete-ngram-edgengram.md
sources:
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/copy-to
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/runtime
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/dynamic-templates
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/subobjects
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/number
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/nested
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/flattened
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/parent-join
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/doc-values
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/norms
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/index-options
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/eager-global-ordinals
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/ignore-above
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/ignore-malformed
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/null-value
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/mapping-routing-field
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/mapping-source-field
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/field-alias
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/token-count
  - https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-combined-fields-query
  - https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-terms-query
  - https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-dis-max-query
catalog-row: "§A (Mapping field types — numeric / object 4-pattern / alias / token_count / meta-fields) + §B (Mapping params — copy_to / runtime / dynamic_templates / subobjects / doc_values / norms / index_options / eager_global_ordinals / ignore_above / ignore_malformed / null_value)"
---

# 38. Mapping 강력 기능 통합 — copy_to / runtime / dynamic_templates / scaled_float / object 4-패턴 / doc_values / _routing / combined_fields / terms-lookup

> 카탈로그 매핑: §99 §A (numeric `🟡 부분` → `✅ 커버`, object 4 패턴 `🟡 부분` → `✅ 커버`, `alias` `★ 신규` → `✅`, `token_count` `★ 신규` → `✅`, meta fields `🟡 부분` → `✅ 커버`) + §B (copy_to / runtime / dynamic_templates / subobjects / eager_global_ordinals 모두 `★ 신규` → `✅`, doc_values·norms·index_options `🟡 부분` → `✅`, ignore_above/ignore_malformed/null_value `🟡 부분` → `✅`).
> 학습 시간 예상: ~3h · 자가평가 입구 레벨: B+

> §27 (필드 타입 카탈로그) 가 "어떤 타입을 고를까" 였다면, 본 §38 은 "타입을 고른 다음, 매핑 파라미터로 무엇을 더 끌어낼 수 있나" 를 통합한 deep file. ES (Elasticsearch) 매핑이 검색 품질·디스크·메모리·운영 안정성·쿼리 latency 의 핵심 레버라는 관점에서 15가지 핵심 기능을 한꺼번에 정리한다.

---

## 1. 한 줄 핵심

> **매핑은 "한 번 박으면 못 빼는 검색 시스템의 골격"** — 필드 타입 + 파라미터 조합으로 (a) 검색 품질, (b) 디스크/메모리, (c) latency, (d) 운영 안정성 4개 축을 동시에 잡아야 한다. `copy_to`/`runtime`/`dynamic_templates` 는 표현력, `scaled_float`/`doc_values`/`norms` 는 비용, `_routing`/`eager_global_ordinals` 는 latency, `ignore_above`/`ignore_malformed`/`null_value` 는 안정성, `flattened`/`nested`/`join` 은 객체 모델링, `combined_fields`/`terms` lookup 은 검색 표현력의 마지막 한 끗.

---

## 2. 등장 배경 — 왜 매핑이 검색 시스템의 모든 것을 결정하나

### 2-1. ES 매핑의 4가지 비대칭

1. **불가역성** — `text` 를 `keyword` 로, `nori` 를 `standard` 로 못 바꾼다. reindex 만이 답.
2. **묵시적 default 의 비용** — 매핑을 안 적으면 dynamic mapping 이 "타입을 알아서 추측" 한다. 가격 12.34 → `float`, 사용자 ID "12345678901234" → `long` 으로 잘못 잡힘.
3. **필드별 비용 합산** — 한 doc 에 100 필드면 100 필드 모두 doc_values / norms / postings 비용이 곱해진다. 안 쓸 필드는 잘라야 한다.
4. **분산 시스템의 일관성** — `_routing` 이 잘못되면 같은 사용자의 doc 이 여러 shard 에 흩어져 facet/agg 가 부정확해진다.

### 2-2. 비용 분해

doc 한 개의 디스크 비용 ≈ `_source` (default JSON 원본) + 필드별 (postings + doc_values + norms + stored fields).

| 컴포넌트 | 용도 | disable 가능? | 영향 |
|---|---|---|---|
| `_source` | 검색 결과 / reindex / update | ⚠ 가능하지만 비추 | reindex/highlight/update 불가 |
| postings (inverted index) | 검색 매칭 | `index: false` 시 disable | 검색 불가, 정렬·집계는 가능 |
| `doc_values` | 정렬·집계·script | `doc_values: false` 가능 | 정렬·집계·script 불가 |
| `norms` | BM25 (Best Match 25) length norm | `norms: false` 가능 | 점수 정확도 ↓, 디스크 ↓ |
| `index_options` | postings 상세도 | docs/freqs/positions/offsets | offset 끄면 highlight 영향 |
| stored fields | _source 외 별도 저장 | `store: true` 로 enable | _source 비활성 시 의미 |

→ 매핑 파라미터는 위 컴포넌트의 on/off 스위치다. **"이 필드는 검색만 / 집계만 / 정렬만 한다"** 의 제약 조건을 매핑에 박아야 비용이 줄어든다.

### 2-3. ES 매핑이 다루는 4축

```
                    검색 품질 (recall / precision)
                         ↑
                         │
        copy_to / runtime / multi_fields / combined_fields
                         │
        ◄────────────────┼────────────────►
        scaled_float     │     doc_values / norms / index_options
        flattened        │     eager_global_ordinals
        match_only_text  │
                         │
        디스크/메모리    │      latency
                         │
                         ↓
        ignore_above / ignore_malformed / null_value
                    운영 안정성
```

이 절에서 다룰 15 개 기능은 모두 위 4축 중 하나 이상을 잡는다.

---

## 3. 핵심 필드 타입 — numeric scaled_float, object 4-패턴

### 3-1. numeric 타입 매트릭스

| 타입 | 범위 | 디스크 | 정밀도 | 가격 적합 | 권장 용도 |
|---|---|---|---|---|---|
| `byte` | -128 ~ 127 | 1B | 정수 | ❌ | 작은 enum 코드 |
| `short` | -32k ~ 32k | 2B | 정수 | ❌ | 카테고리 카운트 |
| `integer` | ±21억 | 4B | 정수 | ⚠ 원 단위 정수면 OK | 일반 정수 |
| `long` | ±9 quintillion | 8B | 정수 | ⚠ 원 단위 정수 | 대용량 ID, 누적 카운터 |
| `unsigned_long` | 0 ~ 18 quintillion | 8B | 정수 | — | 음수 없는 큰 값 |
| `half_float` | 16-bit float | 2B | ~3 유효 자릿수 | ❌ | 벡터 quantization 보조 |
| `float` | 32-bit float | 4B | ~7 유효 자릿수 | ❌ 부동소수 오차 | 일반 실수 (점수, 통계) |
| `double` | 64-bit float | 8B | ~15 유효 자릿수 | ❌ 부동소수 오차 | 정밀도 요구 실수 |
| **`scaled_float`** | long * scaling_factor | 8B | scaling_factor 만큼 | ✅ **표준** | 가격, 환율, 비율, percent |

#### 3-1-1. scaled_float — 가격 필드의 표준

```json
PUT /products
{
  "mappings": {
    "properties": {
      "price": {
        "type": "scaled_float",
        "scaling_factor": 100
      }
    }
  }
}

POST /products/_doc/1
{ "price": 12.34 }
```

- 내부 저장: `12.34 * 100 = 1234` (long)
- 조회 시: 다시 `1234 / 100 = 12.34` 로 복원
- 장점:
  - **부동소수 오차 0** — 12.34 + 0.01 가 12.35 로 정확
  - **압축 효율** — long delta-encoding 으로 디스크 ↓
  - **range query 정확** — `gte: 10.00, lte: 20.00` 가 깨지지 않음
- 단점: scaling_factor 보다 작은 정밀도는 잘림 (factor=100 이면 0.005 → 0)
- factor 선택:
  - 원화 (정수) → `1` (또는 그냥 `long`)
  - USD/EUR (소수 2자리) → `100`
  - 환율 / 비율 (소수 4자리) → `10000`
  - bps (basis point) → `1000000`

#### 3-1-2. 안티패턴 — 가격을 float

```json
"price": { "type": "float" }
```

- 0.1 + 0.2 = 0.30000000000000004 (IEEE 754)
- range query 에서 `lte: 0.30` 이 0.3000...004 doc 을 빠뜨림
- 정렬에서 같은 값이 미세 차이로 흔들림
- **반드시 `scaled_float` 또는 (정수 단위면) `long`**.

### 3-2. object 표현 4-패턴

같은 JSON 객체도 매핑 type 에 따라 색인 구조가 달라진다.

#### 3-2-1. `object` (default)

```json
PUT /orders
{
  "mappings": {
    "properties": {
      "items": {
        "properties": {
          "sku": { "type": "keyword" },
          "qty": { "type": "integer" }
        }
      }
    }
  }
}

POST /orders/_doc/1
{
  "items": [
    { "sku": "A", "qty": 1 },
    { "sku": "B", "qty": 5 }
  ]
}
```

- 내부 색인: **평탄화** — `items.sku: [A, B]`, `items.qty: [1, 5]`
- 검색 `items.sku=A AND items.qty=5` → **매칭됨** (의도와 다름)
- 언제 쓴다: 객체 안 필드끼리 cross-field 매칭 정확도 신경 안 쓸 때 (예: 단일 객체)
- 언제 쓰지 않는다: 배열 안 객체의 정확 매칭

#### 3-2-2. `nested` — 정확 매칭 보장

```json
"items": {
  "type": "nested",
  "properties": {
    "sku": { "type": "keyword" },
    "qty": { "type": "integer" }
  }
}
```

- 내부 색인: 각 배열 원소를 **별도 hidden child doc** 으로 (Lucene segment 안에)
- 검색: `nested` query 로 감싸야 함

```json
GET /orders/_search
{
  "query": {
    "nested": {
      "path": "items",
      "query": {
        "bool": {
          "must": [
            { "term": { "items.sku": "A" } },
            { "term": { "items.qty": 5 } }
          ]
        }
      }
    }
  }
}
```

- 결과: `items.sku=A` 인 원소의 `qty=5` 가 같은 객체 안에 있어야 매칭 → **정확**
- 비용: hidden child doc 추가로 **doc 수 증가** (원본 1 + items N → 1+N)
- 언제 쓴다: 배열 안 객체의 cross-field 정확 매칭 (주문 항목, 옵션 조합, 권한 매트릭스)
- 언제 쓰지 않는다: 객체 키가 dynamic / 단순 키 검색만

#### 3-2-3. `flattened` — dynamic key explosion 방지

```json
"attributes": { "type": "flattened" }

POST /products/_doc/1
{
  "attributes": {
    "color": "red",
    "size": "L",
    "vendor.specific.flag": "x",
    "any.new.key.tomorrow": "v"
  }
}
```

- 내부 색인: 전체 객체를 **단일 keyword 필드** 로 — key 가 늘어나도 매핑 변경 X
- 검색: `attributes.color: "red"` 같은 prefix — 단순 keyword 매칭만
- 비용: 매핑 폭증 (`mapping.total_fields.limit` 1000) 회피
- 한계:
  - 분석기 적용 안 됨 (풀텍스트 검색 ❌)
  - 정렬·집계는 leaf 별로 됨
  - 점수 통계 (BM25) 약함
- 언제 쓴다: 사용자 정의 attribute, 외부 시스템 dump, 키가 무한대로 늘어나는 케이스
- 언제 쓰지 않는다: 풀텍스트 검색 / 키별 nori 분석 필요

#### 3-2-4. `join` — parent-child

```json
"my_join": {
  "type": "join",
  "relations": { "question": "answer" }
}
```

- 부모 doc + 자식 doc 이 **같은 shard** 에 있어야 함 (`routing` 강제)
- 검색: `has_child` / `has_parent` query
- 비용: cross-shard agg 약함, 자식이 많으면 IO ↑
- 언제 쓴다: 1:N 관계가 자주 갱신되는데 부모는 정적인 경우 (질문-답변, 카테고리-상품 — 단 카테고리 갱신이 드물 때)
- 언제 쓰지 않는다: 카디널리티가 높지 않거나 nested 로 충분

#### 3-2-5. 4-패턴 의사결정

```
배열 안 객체 cross-field 정확 매칭 필요?
├─ 예
│  └─ 카디널리티 작음 (한 doc 당 < 100) → nested
│  └─ 카디널리티 큼 + 자식 잦은 갱신 → join
└─ 아니오
   └─ 키가 dynamic / explosion 우려 → flattened
   └─ 일반 객체 → object (default)
```

| 패턴 | 디스크 | 쿼리 복잡도 | 매핑 변경 | 풀텍스트 |
|---|---|---|---|---|
| object | 1x | 단순 | 키마다 매핑 추가 | ✅ |
| nested | 1.5~3x | nested query | 키마다 매핑 | ✅ |
| flattened | 0.7x | prefix keyword | 변경 없음 | ❌ |
| join | 1x + routing | has_child/has_parent | 추가 | ✅ |

---

## 4. 매핑 파워 파라미터 — copy_to / runtime / dynamic_templates / subobjects

### 4-1. `copy_to` — 가상 합성 필드

여러 필드를 하나의 가상 필드에 합쳐 색인. `multi_match` 의 단순 대안.

```json
PUT /products
{
  "mappings": {
    "properties": {
      "title":       { "type": "text", "analyzer": "nori", "copy_to": "search_all" },
      "description": { "type": "text", "analyzer": "nori", "copy_to": "search_all" },
      "brand":       { "type": "keyword",                "copy_to": "search_all" },
      "tags":        { "type": "keyword",                "copy_to": "search_all" },
      "search_all":  { "type": "text", "analyzer": "nori" }
    }
  }
}
```

- 색인 시: 각 필드 값이 `search_all` 에 추가 색인됨 (원본은 그대로 남음)
- 검색:

```json
GET /products/_search
{ "query": { "match": { "search_all": "갤럭시 폴드" } } }
```

- 장점:
  - `multi_match` 보다 **빠름** (단일 필드 매칭으로 압축)
  - **단어 통계가 합쳐져 BM25 정확도 ↑** (특히 짧은 필드의 IDF 왜곡 감소)
  - **단일 query string 자동완성에 깔끔**
- 단점:
  - 디스크 ↑ (원본 + 합성)
  - field-specific boost 못 함 (필드별 가중치 X)
  - `_source` 에는 `search_all` 안 들어감 (저장 X, 색인만)
- 언제 쓴다: "사이트 전체에서 무엇이든 검색" 같은 단일 입력 박스
- 언제 쓰지 않는다: 필드별 가중치 (title 3x, description 1x) 가 중요 → `multi_match` 또는 `combined_fields`

#### 4-1-1. `copy_to` vs `alias` — 자주 헷갈림

| 기능 | copy_to | alias |
|---|---|---|
| 본질 | 값을 **복사** 해서 새 필드에 색인 | 필드 **별칭** (포인터) |
| 디스크 | 추가 비용 있음 | 0 |
| 검색 | alias 같은 단일 필드 검색 | 원본 필드를 다른 이름으로 호출 |
| 사용 사례 | 합성 검색 필드 | 마이그레이션, ECS 호환 |

```json
"title_legacy": { "type": "alias", "path": "title" }
// 검색에서 title_legacy 로 호출해도 실제로는 title 을 검색
```

### 4-2. `runtime` fields — schema-on-read

색인 시점에 매핑 안 하고, **query/agg 시점에 script 로 계산**. 8.x 의 핵심 기능.

```json
PUT /orders/_mapping
{
  "runtime": {
    "discounted_price": {
      "type": "double",
      "script": {
        "source": "emit(doc['price'].value * (1 - doc['discount_rate'].value))"
      }
    }
  }
}

GET /orders/_search
{
  "query": { "range": { "discounted_price": { "lte": 100.00 } } },
  "fields": ["discounted_price"]
}
```

- 색인 X — 디스크 0 추가
- 매핑 변경 자유 — script 만 갈아끼면 됨
- 비용: query 시점 evaluation → **느림** (대용량은 부적합)
- 언제 쓴다:
  - **운영 중 매핑 실수 hotfix** (price 가 string 으로 들어감 → runtime 으로 parse)
  - 임시 분석/대시보드용 derived 필드
  - 신규 필드 검증 (운영 데이터로 평가 후 영구 매핑 결정)
- 언제 쓰지 않는다:
  - 자주 검색·집계되는 필드 (운영용은 영구 매핑이 빠름)
  - 1억+ doc 의 sort 키 (timeout 위험)

#### 4-2-1. runtime vs scripted_field (deprecated)

`scripted_field` 는 _search 의 `script_fields` 절에서만 동작 — query / agg / sort 에 못 씀.
`runtime` 은 매핑에 등록되므로 query / agg / sort / fields 모두에서 정상 필드처럼 사용.

### 4-3. `dynamic` / `dynamic_templates`

#### 4-3-1. `dynamic` 정책

```json
{ "mappings": { "dynamic": "strict" } }
```

| 값 | 동작 |
|---|---|
| `true` (default) | 새 필드 자동 매핑 추가 |
| `runtime` | 자동 매핑이지만 **runtime field** 로 (디스크 0) |
| `false` | 색인은 되지만 매핑 추가 X — 검색 불가 |
| `strict` | 매핑 안 된 필드 들어오면 **doc reject** |

→ **운영 인덱스는 `strict` 권장**. dynamic 방치 시 mapping explosion → cluster state 폭증 → 클러스터 다운.

#### 4-3-2. `dynamic_templates` — 패턴별 자동 매핑

```json
PUT /logs
{
  "mappings": {
    "dynamic_templates": [
      {
        "strings_as_keyword": {
          "match_mapping_type": "string",
          "mapping": { "type": "keyword", "ignore_above": 256 }
        }
      },
      {
        "long_ids": {
          "match": "*_id",
          "mapping": { "type": "keyword" }
        }
      },
      {
        "metric_doubles": {
          "path_match": "metrics.*",
          "mapping": { "type": "double" }
        }
      }
    ]
  }
}
```

- `match_mapping_type` — JSON 타입 기반 (string/long/double/boolean/date/object/binary)
- `match` / `unmatch` — 필드명 패턴 (glob)
- `path_match` / `path_unmatch` — 점 표기 경로 패턴
- 첫 번째 매칭만 적용

→ ECS (Elastic Common Schema) 같은 표준 매핑 자동화의 핵심.

### 4-4. `subobjects: false` — dot-notation 평탄화

기본 ES 매핑은 dot 가 nested object 를 의미한다.

```json
POST /a/_doc/1
{ "host.name": "web-01" }
// 자동 변환 → { "host": { "name": "web-01" } }
```

문제: ECS 같은 표준은 dot 표기를 **그대로 leaf 필드명** 으로 쓰는 경우가 많음. 또 prometheus 메트릭처럼 `http.requests.total` 가 진짜 leaf 인 경우.

```json
PUT /metrics
{
  "mappings": {
    "subobjects": false,
    "properties": {
      "http.requests.total": { "type": "long" },
      "http.errors.total":   { "type": "long" }
    }
  }
}
```

- dot 가 leaf 이름의 일부로 인정됨
- prometheus / OTel (OpenTelemetry) 메트릭 색인 시 표준
- 단점: nested object 문법 못 씀 (한 인덱스 안에서 mix 불가)

→ 8.11+ 에서는 특정 object 만 `subobjects: false` 로 지정 가능 (부분 적용).

---

## 5. 운영 안정성 파라미터 — ignore_above / ignore_malformed / null_value

### 5-1. `ignore_above` — keyword 길이 cut

```json
"slug": { "type": "keyword", "ignore_above": 256 }
```

- 256 자 초과하는 값은 **색인 skip** (검색·정렬·집계 불가)
- `_source` 에는 그대로 보존 (조회는 됨)
- 효과: Lucene 의 term 길이 제한 (32KB) 넘는 거대 string 으로 인한 색인 실패 방지
- 표준값:
  - 일반 keyword: 256
  - URL: 1024 (더 길면 hash + alias)
  - 사용자 입력: 256

→ dynamic_templates 의 `strings_as_keyword` 에 보통 같이 박는다.

### 5-2. `ignore_malformed` — 잘못된 값 무시

```json
"created_at": { "type": "date", "ignore_malformed": true }

POST /a/_doc/1
{ "created_at": "not a date", "title": "hello" }
// → 색인은 성공, created_at 은 _ignored 메타에 기록, title 은 정상
```

- 한 필드의 type 오류로 **doc 전체가 reject** 되는 사고 방지
- 영향: `_ignored` meta field 로 추적 가능 — 운영에서 쿼리로 확인:

```json
GET /a/_search
{ "query": { "exists": { "field": "_ignored" } } }
```

- 비용: 무시된 값은 색인 안 됨 → `created_at: range` query 에서 빠짐
- 언제 쓴다: ingest 데이터 품질 보증 안 되는 도메인 (로그, 외부 API)
- 언제 쓰지 않는다: 정합성 critical 한 도메인 (결제, 회계) — 차라리 reject 후 dead letter

### 5-3. `null_value` — null 치환

```json
"status": {
  "type": "keyword",
  "null_value": "UNKNOWN"
}

POST /a/_doc/1
{ "status": null }
// 색인 시 status="UNKNOWN" 으로 저장
```

- null 도 검색·집계에 잡히게 함
- terms agg 결과에 "UNKNOWN" 버킷 자동 등장
- 한계: `_source` 에는 null 그대로 (색인된 값만 변환)
- 언제 쓴다: 누락된 카테고리에 default 부여, 분석 기본값
- 언제 쓰지 않는다: null 의미가 "값 없음" 으로 명확해야 할 때 — `exists` query 가 깨짐

### 5-4. 3 파라미터 비교

| 파라미터 | 적용 대상 | 효과 | 추적 |
|---|---|---|---|
| `ignore_above` | keyword 길이 초과 | 색인 skip | `_ignored` |
| `ignore_malformed` | 타입 오류 값 | 색인 skip + doc 유지 | `_ignored` |
| `null_value` | null 입력 | 지정값으로 치환 색인 | 정상 |

→ **운영 인덱스는 3개 모두 박는 게 표준**. dynamic_templates 와 결합 시 모든 keyword 에 자동 적용.

---

## 6. 성능 튜닝 파라미터 — doc_values / norms / index_options / eager_global_ordinals

### 6-1. `doc_values` — 정렬·집계의 기둥

doc_values 는 **column-oriented on-disk 자료구조**. 정렬·집계·script 는 doc_values 를 읽는다.

```json
"name": { "type": "keyword" }                  // doc_values: true (default)
"big_text_field": { "type": "text" }           // text 는 doc_values 없음 (fielddata 로만)
"never_sort_field": { "type": "keyword", "doc_values": false }  // 디스크 ↓
```

- text 필드는 **doc_values 없음** — 정렬/집계 시 fielddata (heap) 를 빌드해야 해서 비쌈 → multi-field 의 keyword 를 쓰는 게 표준
- keyword/numeric/date 는 default `true`
- disable 시 효과:
  - 디스크 ~30% ↓ (필드별)
  - 정렬·집계·script 불가능 (검색만 가능)
- 언제 끈다: "검색만 하고 정렬/집계 절대 안 한다" 가 100% 확정인 필드

### 6-2. `norms` — BM25 length normalization

`norms` 는 doc 길이를 압축 저장 — BM25 의 `|d|/avgdl` 계산용.

```json
"description": { "type": "text", "norms": false }
```

- 효과:
  - 디스크 ↓ (필드당 ~1B/doc)
  - **점수 정확도 ↓** (긴 description 과 짧은 description 점수 같아짐)
- 언제 끈다:
  - text 필드인데 **점수 안 쓰고** filter / 존재 여부만 체크
  - 로그 메시지의 raw text 검색
- 언제 쓰지 않는다: 풀텍스트 검색의 핵심 필드 (title, content)

### 6-3. `index_options` — postings 상세도

```json
"description": { "type": "text", "index_options": "freqs" }
```

| 값 | 색인 정보 | 디스크 | 가능 기능 |
|---|---|---|---|
| `docs` | 매칭 doc 만 | 최소 | 존재성 / 단순 매칭 (freq 무시) |
| `freqs` | docs + term freq | 작음 | BM25 부분 (length norm 빠짐) |
| `positions` (text default) | docs + freq + position | 중간 | phrase / span / proximity |
| `offsets` | docs + freq + position + offset | 많음 | unified highlighter offset 모드 |

- text default = `positions` (phrase query 지원)
- highlighter 자주 쓰면 `offsets` (highlight latency 1/3 로)
- 단순 keyword 매칭 / 점수 안 씀 → `docs` 로 디스크 절감

### 6-4. `eager_global_ordinals` — terms agg / parent-child latency ↓

global ordinals 는 keyword 필드의 **shard-level 통합 dictionary**. terms agg 와 join 필드가 사용.

기본: 첫 query 가 들어와야 빌드 (lazy) → 첫 쿼리 latency ↑.

```json
"category_id": { "type": "keyword", "eager_global_ordinals": true }
```

- 효과: refresh (1초) 마다 백그라운드에서 미리 빌드 → 첫 쿼리도 빠름
- 비용: refresh 마다 빌드 CPU + 메모리
- 언제 쓴다:
  - **terms agg 자주 쓰는 facet 필드** (category, brand, tag)
  - join 필드의 부모 필드
- 언제 쓰지 않는다: refresh 가 잦은데 terms agg 는 거의 안 쓰는 필드 (불필요한 빌드 부하)

#### 6-4-1. ordinal 이란

ordinals = "이 shard 안에서 keyword 의 정렬된 인덱스". `category="A","B","B","C"` → `A=0, B=1, C=2` 로 매핑. agg 에서 이 정수 인덱스로 카운팅하면 string 비교 X → 빠름.

global ordinals = shard 마다 다른 ordinals 를 cluster-wide 로 통합한 것.

### 6-5. 성능 파라미터 의사결정 표

| 필드 패턴 | doc_values | norms | index_options | eager_global_ordinals |
|---|---|---|---|---|
| facet 핵심 keyword (category) | true (default) | n/a | docs | **true** |
| 검색 핵심 text (title) | n/a | true (default) | positions (default) | n/a |
| 단순 filter keyword (status) | true | n/a | docs | false |
| 정렬 안 하는 description text | n/a | **false** | freqs | n/a |
| highlight 잦은 content text | n/a | true | **offsets** | n/a |
| numeric ID (sort 안 함) | **false** | n/a | n/a | n/a |

---

## 7. meta fields — `_routing` 핵심

### 7-1. meta fields 카탈로그

| 메타 | 역할 | 운영 영향 |
|---|---|---|
| `_id` | doc 식별자 | 명시 안 하면 자동 생성. 중복 제어의 키 |
| `_source` | 원본 JSON | disable 시 reindex / update / highlight 불가 |
| `_index` | 인덱스 이름 | alias 검색 시 결과에 나옴 |
| `_routing` | shard 결정 키 | 1:N 카디널리티 분포에 직결 |
| `_ignored` | ignore_* 파라미터로 빠진 필드 | 데이터 품질 모니터링 |
| `_meta` | 사용자 정의 메타 | mapping version / owner team 등 |
| `_doc_count` | downsampling 시 sub-doc 카운트 | aggregate_metric_double 와 짝 |
| `_field_names` | 8.x 부터 자동 — `exists` query 가속 | 디스크 약간 |
| `_seq_no` / `_primary_term` | optimistic concurrency control | `if_seq_no` / `if_primary_term` |

### 7-2. `_routing` — shard 고정의 핵심

기본: doc routing = `hash(_id) % num_primary_shards`. 균등 분포 보장.

문제: 같은 사용자의 doc 100개가 100 shard 에 흩어짐 → user-specific 검색이 모든 shard 를 부름.

해결: `_routing` 으로 같은 그룹의 doc 을 같은 shard 에.

```json
PUT /orders
{
  "mappings": {
    "_routing": { "required": true }
  }
}

POST /orders/_doc/1?routing=user_42
{ "user_id": "user_42", "items": [...] }

GET /orders/_search?routing=user_42
{ "query": { "term": { "user_id": "user_42" } } }
```

- 효과:
  - user_42 의 모든 doc 가 같은 shard → 검색 1 shard 만 hit
  - 검색 latency 5x ↓ (shard 수만큼)
- 위험:
  - 한 사용자의 doc 이 너무 많으면 **shard 불균형** (hot shard)
  - cardinality 작은 키 (예: country=KR/US/JP) 로 routing 하면 거대 shard 3개
- 적합한 routing key:
  - 카디널리티 높음 (사용자 수만~수백만)
  - 분포 균등
  - 검색이 항상 이 키로 필터링됨

#### 7-2-1. `_routing` + `join` 필드

join 필드는 부모-자식이 같은 shard 에 있어야 → routing 강제.

```json
POST /q/_doc/1?routing=cat_42
{ "my_join": { "name": "question" }, "category": "cat_42" }

POST /q/_doc/2?routing=cat_42
{ "my_join": { "name": "answer", "parent": "1" } }
```

### 7-3. `_source` disable — 거의 쓰지 말 것

```json
"_source": { "enabled": false }
```

- 효과:
  - 디스크 ↓ (10~30%)
  - reindex 불가, update 불가, highlight 일부 불가, _source 필드 조회 불가
- 언제 쓴다: 이미 다른 SoT (Source of Truth) 가 있고 ES 는 색인 전용인 경우 (e.g., Lucene 검색 인덱스만 보존, 데이터는 외부 DB)
- 대안: `_source.includes` / `_source.excludes` 로 일부만 저장

```json
"_source": { "excludes": ["raw_html", "internal_*"] }
```

### 7-4. `_meta` — mapping version 표시

```json
{
  "mappings": {
    "_meta": {
      "version": "2026.05.05-r1",
      "owner": "search-team",
      "schema_url": "https://internal/schema/products.v1.json"
    }
  }
}
```

- 매핑 변경 추적 / GitOps 연동에 필수
- 운영 표준

---

## 8. 검색 패턴 강화 — combined_fields / terms-lookup / dis_max

### 8-1. `combined_fields` (BM25F) — multi_match 의 진짜 후속

`multi_match` 는 4 가지 모드가 있다 (`best_fields`, `most_fields`, `cross_fields`, `phrase`).
`cross_fields` 는 "필드를 합친 것처럼" 검색하지만 **각 필드의 IDF 를 그대로** 써서 짧은 필드의 단어가 과대평가됨.

`combined_fields` 는 진짜 BM25F (BM25 with multiple fields) 구현체:

```json
GET /products/_search
{
  "query": {
    "combined_fields": {
      "query": "갤럭시 폴드",
      "fields": ["title^3", "description", "brand"],
      "operator": "and"
    }
  }
}
```

- 동작: 모든 필드를 가상으로 합친 후 BM25 재계산 — IDF 가 통합됨
- 제약:
  - 모든 필드가 **같은 analyzer** 여야 함
  - text 필드만 (keyword X)
- 언제 쓴다:
  - 여러 풀텍스트 필드의 통합 검색 + 정확한 점수
  - `cross_fields` 의 "단어가 어느 필드에 있든 OK" 시멘틱이지만 점수가 더 정확
- 언제 쓰지 않는다: 필드별 분석기 다름, keyword 포함 → multi_match best_fields

#### 8-1-1. combined_fields vs copy_to

| 측면 | combined_fields | copy_to |
|---|---|---|
| 시점 | query 시점 | index 시점 |
| 디스크 | 0 추가 | 합성 필드만큼 추가 |
| 필드 boost | ✅ `title^3` 가능 | ❌ |
| analyzer | 모두 같아야 | 합성 필드의 analyzer 단일 |
| BM25 정확도 | 높음 (BM25F) | 합쳐진 필드 단독 BM25 |
| 변경 자유도 | query 만 바꾸면 됨 | reindex 필요 |

→ **신규 인덱스: combined_fields**, **기존 합성 필드 운영 중: copy_to 유지**.

### 8-2. `terms` lookup — 다른 인덱스에서 동적 fetch

```json
GET /products/_search
{
  "query": {
    "terms": {
      "tags": {
        "index": "users",
        "id": "user_42",
        "path": "followed_brands"
      }
    }
  }
}
```

- `users` 인덱스의 `user_42` doc 의 `followed_brands` 배열을 가져와서 → `tags IN [...]` 검색
- 캐시: 첫 호출 후 캐시 — 같은 lookup 빠름
- 한계:
  - 다른 인덱스가 같은 노드 / 같은 클러스터 (CCS 가능)
  - lookup doc 변경 시 캐시 invalidate 까지 stale
- 언제 쓴다:
  - 사용자별 follow / wishlist / blacklist 필터
  - 다이나믹 권한 ACL 필터
- 언제 쓰지 않는다: lookup doc 이 매우 자주 바뀜 (캐시 효과 ↓), 카디널리티 크기 65k 초과 (Lucene term limit)

### 8-3. `dis_max` — should 매칭의 max + tie_breaker

`bool.should` 는 매칭된 모든 절의 점수를 합산. 한 절이 매우 높으면 다른 절들이 묻힘.

`dis_max` 는 매칭된 절 중 **max 점수** + 나머지 * tie_breaker:

```json
GET /products/_search
{
  "query": {
    "dis_max": {
      "queries": [
        { "match": { "title": "갤럭시" } },
        { "match": { "description": "갤럭시" } }
      ],
      "tie_breaker": 0.3
    }
  }
}
```

- 점수: `max(title_score, desc_score) + 0.3 * (다른 절들 점수 합)`
- 효과: title 에서 강하게 매칭되면 그게 우선, description 매칭은 미세 보정
- `multi_match` 의 default 모드 `best_fields` 가 내부적으로 dis_max 를 쓴다.
- 언제 쓴다:
  - 여러 필드를 **경쟁** 시키고 싶을 때 (상위 필드가 우선)
  - cross_fields 보다 best_fields 시멘틱
- 언제 쓰지 않는다: 모든 필드의 매칭을 누적 (bool.should 의 default 시멘틱)

### 8-4. `token_count` — 길이 기반 필터/정렬

```json
"title": {
  "type": "text",
  "analyzer": "nori",
  "fields": {
    "length": { "type": "token_count", "analyzer": "nori" }
  }
}
```

- title 의 토큰 수가 자동 색인됨 → 정수 필드로 활용
- 활용:
  - 너무 짧거나 너무 긴 title 필터 (`range: { gte: 2, lte: 20 }`)
  - 짧은 title 가산점 (function_score)
- 언제 쓴다: 길이 기반 품질 control, anti-spam (1글자 제목 cut)
- 언제 쓰지 않는다: 단순 string length (그건 그냥 keyword + script)

---

## 9. msa 적용 — search service grounding

### 9-1. 현재 매핑 (`search/app/.../ProductEsDocument.kt:11-23`)

```kotlin
@Document(indexName = "products")
data class ProductEsDocument(
    @Id val id: String,
    @Field(type = FieldType.Text, analyzer = "nori") val name: String,
    @Field(type = FieldType.Double) val price: BigDecimal,             // ❌ float-double 함정
    @Field(type = FieldType.Keyword) val status: String,
    @Field(type = FieldType.Date, ...) val createdAt: LocalDateTime,
    @Field(type = FieldType.Double) val popularityScore: Double = 0.0, // function_score 보다 rank_feature
    @Field(type = FieldType.Double) val ctr: Double,
    @Field(type = FieldType.Double) val cvr: Double,
    @Field(type = FieldType.Long) val scoreUpdatedAt: Long
)
```

### 9-2. 점검 매트릭스

| 필드 | 현재 | 점검 | 권장 |
|---|---|---|---|
| `name` | text + nori | 자동완성 X, sort/agg X | + multi_field `.raw` keyword + `.autocomplete` (§36) + `copy_to: search_all` |
| `price` | Double | **부동소수 오차** | **scaled_float (factor=100)** |
| `status` | keyword | facet 가능성 | + `eager_global_ordinals: true` (terms agg 자주) |
| `createdAt` | date | OK | + `ignore_malformed: true` (CDC 데이터 안전망) |
| `popularityScore` | double | function_score 비싸짐 | **rank_feature** (§27 §35) |
| `ctr`, `cvr` | double | 0~1 비율 | scaled_float (factor=10000) |
| (없음) | options 배열 | nested vs flattened 미정 | **flattened** (옵션 키 dynamic) |
| (없음) | 카테고리별 검색 | shard fan-out | `_routing: required` + routing key = `categoryId` |
| `_meta` | 없음 | mapping 버전 추적 ❌ | `_meta.version` 박기 |
| `_source` | default 전체 | description 미사용 | `_source.excludes` 로 raw_html 같은 큰 필드 제외 |

### 9-3. 권장 매핑 (재구성)

```json
PUT /products
{
  "settings": {
    "index": {
      "mapping.total_fields.limit": 2000,
      "max_ngram_diff": 10
    },
    "analysis": {
      "analyzer": {
        "korean_search": {
          "tokenizer": "nori_tokenizer",
          "filter": ["lowercase", "nori_part_of_speech"]
        }
      }
    }
  },
  "mappings": {
    "_meta": { "version": "2026.05.05-r1", "owner": "search-team" },
    "dynamic": "strict",
    "properties": {
      "id":         { "type": "keyword" },
      "name": {
        "type": "text",
        "analyzer": "korean_search",
        "copy_to": "search_all",
        "fields": {
          "raw":          { "type": "keyword", "ignore_above": 256 },
          "autocomplete": { "type": "search_as_you_type" },
          "length":       { "type": "token_count", "analyzer": "korean_search" }
        }
      },
      "description": {
        "type": "text",
        "analyzer": "korean_search",
        "copy_to": "search_all",
        "norms": true,
        "index_options": "offsets"
      },
      "search_all": { "type": "text", "analyzer": "korean_search" },
      "categoryId": { "type": "keyword", "eager_global_ordinals": true },
      "brand":      { "type": "keyword", "eager_global_ordinals": true },
      "price":      { "type": "scaled_float", "scaling_factor": 100 },
      "status":     { "type": "keyword", "eager_global_ordinals": true },
      "options":    { "type": "flattened" },
      "popularityScore": { "type": "rank_feature" },
      "ctr":             { "type": "scaled_float", "scaling_factor": 10000 },
      "cvr":             { "type": "scaled_float", "scaling_factor": 10000 },
      "createdAt":       { "type": "date", "ignore_malformed": true },
      "scoreUpdatedAt":  { "type": "long", "doc_values": true }
    },
    "_routing": { "required": true },
    "dynamic_templates": [
      {
        "strings_as_keyword": {
          "match_mapping_type": "string",
          "mapping": { "type": "keyword", "ignore_above": 256 }
        }
      }
    ]
  }
}
```

routing 적용:

```kotlin
// search/consumer 측
operations.save(
    ProductEsDocument(...),
    IndexCoordinates.of("products").withRouting(categoryId)
)
```

### 9-4. 효과 추정

| 변경 | 효과 |
|---|---|
| `price` Double → scaled_float | 부동소수 오차 0, range query 정확 |
| `popularityScore` Double → rank_feature | function_score 대비 latency ~30% ↓ |
| `_routing: categoryId` | 카테고리 필터 검색 fan-out 1/N (shard 5개면 5x ↓) |
| `eager_global_ordinals` on facet 필드 | 첫 terms agg latency ↓ (refresh 부하 +) |
| `dynamic: strict` | mapping explosion 방지 |
| `_meta.version` | GitOps 추적 |
| `combined_fields` 적용 | `multi_match cross_fields` 대비 BM25F 점수 개선 |

### 9-5. ADR 후보

> **ADR-XXXX-3: search-products 인덱스 매핑 v2 — scaled_float / rank_feature / _routing / strict dynamic**
>
> 변경: BigDecimal Double → scaled_float, popularityScore Double → rank_feature, _routing required = categoryId, dynamic strict + dynamic_templates, _meta.version. reindex 필요. alias swap 으로 무중단.

---

## 10. 안티패턴 정리

### 10-1. 가격을 `float`/`double`

- IEEE 754 부동소수 오차 → range query / 정렬 깨짐
- 정답: `scaled_float`, factor 는 도메인 정밀도

### 10-2. dynamic mapping 방치

- `{"x": "1"}` → string keyword, `{"x": 1}` → long. 첫 doc 의 타입에 매핑 고정 → 후속 doc 의 다른 타입 reject
- 정답: `dynamic: strict` + dynamic_templates 명시

### 10-3. 옵션 배열을 무조건 nested

- 옵션 키가 dynamic 인데 nested 로 매핑 → mapping explosion
- 정답: 옵션 cross-field 정확 매칭 필요 → nested, 아니면 flattened

### 10-4. 모든 필드를 keyword 로

- 정렬·집계 가능하지만 풀텍스트 검색 불가, 디스크 낭비
- 정답: 필드 본질에 맞게 (text + multi-field keyword)

### 10-5. `_routing` 없이 user-specific 검색

- 모든 shard fan-out — latency ↑
- 정답: routing key 잡기. 단 hot shard 위험 검토

### 10-6. text 필드에 정렬

- text 는 doc_values 없음 → fielddata heap 사용 → OOM 위험
- 정답: `.raw` keyword multi-field 로 정렬

### 10-7. `_source` disable + reindex 시도

- _source 없으면 reindex API 가 데이터 소스로 못 씀
- 정답: 정말 필요하면 외부 SoT 보장 후 includes/excludes 로 부분 제어

### 10-8. ignore_above 없이 거대 keyword

- Lucene term 32KB 초과 시 색인 실패 → doc reject
- 정답: ignore_above 256 (또는 도메인 적정값)

### 10-9. norms 끄고 풀텍스트 검색

- length norm 빠진 BM25 → 짧은 field 와 긴 field 점수 같음 → 검색 품질 ↓
- 정답: 핵심 검색 필드는 norms on. 점수 안 쓰는 보조 필드만 off

### 10-10. eager_global_ordinals 남발

- terms agg 거의 안 쓰는 필드에 적용 → refresh 마다 빌드 부하
- 정답: 실제 facet 필드에만 (category, brand, status)

### 10-11. copy_to 와 _source 혼동

- `_source` 에 합성 필드가 안 보인다고 색인 안 됐다고 오해
- 정답: copy_to 는 색인만, `_source` 는 별개 — `_search` 결과 `fields` 절로 확인

### 10-12. runtime field 를 production sort 키로

- 1억 doc sort 에 runtime script 돌리면 timeout
- 정답: hot path 는 영구 매핑, runtime 은 ad-hoc / hotfix 용

### 10-13. terms lookup 으로 65k 초과 ID

- Lucene term limit 65536 초과 시 fail
- 정답: 카디널리티 큰 ACL 은 별도 join field 또는 application-level filter

### 10-14. flattened 로 풀텍스트 검색 시도

- flattened 는 keyword 단일 필드 — nori 분석기 적용 X
- 정답: 풀텍스트 필드는 별도 text 매핑

### 10-15. dis_max 의 tie_breaker 0

- best_fields 모드에서 tie_breaker=0 이면 보조 필드 매칭이 점수에 0 기여 — 동률 가능
- 정답: 0.1~0.3 권장

---

## 11. 면접 한 줄 답변

### Q. 가격 필드는 어떻게 매핑하나요?

> "`scaled_float` 에 `scaling_factor=100` 이 표준입니다. 내부적으로 long 으로 저장되어 부동소수 오차가 없고, range query 와 정렬이 정확합니다. 원 단위 정수면 그냥 `long` 도 됩니다. `float`/`double` 은 0.1+0.2=0.30000000000000004 같은 오차로 range 검색이 깨집니다."

### Q. nested / flattened / join 의 사용 분기는?

> "배열 안 객체의 cross-field 정확 매칭이 필요하면 nested — hidden child doc 으로 색인되어 정확하지만 doc 수가 늘어납니다. 키가 dynamic 으로 무한 늘어나면 flattened — 매핑 변경 없이 단일 keyword 로 색인. 부모-자식 관계가 자식만 자주 갱신되면 join — 단 같은 shard 강제(routing 필요). 일반 객체는 default `object`(평탄화)."

### Q. `copy_to` 와 `combined_fields` 중 무엇을 쓰나요?

> "copy_to 는 index time 에 합성 필드를 만드는 방식, combined_fields 는 query time 에 BM25F 로 여러 필드를 통합하는 방식입니다. combined_fields 가 디스크를 안 쓰고 필드별 boost 를 지원해서 신규 인덱스에 권장. 단 모든 필드가 같은 analyzer 여야 합니다. 기존 운영 인덱스라면 copy_to 가 더 빠른 검색 속도를 줍니다."

### Q. `_routing` 은 언제 쓰나요?

> "user-specific 또는 tenant-specific 검색이 항상 한 키로 필터링될 때 입니다. 같은 routing key 의 doc 이 같은 shard 에 모이므로 fan-out 이 1/N 으로 줄어 검색 latency 가 shard 수만큼 빠릅니다. 단 카디널리티가 작은 키 (예: country) 로 routing 하면 hot shard 가 생깁니다. join 필드는 routing 강제."

### Q. `doc_values`, `norms`, `index_options` 의 역할 차이는?

> "doc_values 는 정렬·집계용 column-store, norms 는 BM25 의 length normalization 통계, index_options 는 postings 의 상세도 (docs/freqs/positions/offsets) 입니다. 정렬·집계 안 하면 doc_values 끄고 디스크 30% 절약, 풀텍스트 점수 안 쓰면 norms 끄고 디스크 추가 절감, highlight 자주 쓰면 index_options=offsets 로 highlight 1/3 가속."

### Q. dynamic mapping 의 위험은 무엇이고 어떻게 막나요?

> "첫 doc 의 JSON 타입으로 매핑이 자동 박혀 후속 doc 이 reject 되거나, 새 키가 무한 추가되어 mapping.total_fields.limit (1000) 을 넘기면 cluster state 폭증으로 클러스터가 다운됩니다. 운영 인덱스는 `dynamic: strict` 로 reject 모드 + dynamic_templates 로 패턴별 명시 매핑을 박아야 합니다."

### Q. runtime field 는 언제 유용한가요?

> "운영 중 매핑 실수의 hotfix (예: price 가 string 으로 들어옴 → script 로 parse), 임시 분석/대시보드용 derived field, 신규 필드의 운영 검증 단계에 유용합니다. 디스크 0 추가에 매핑 변경 자유. 단 query 시점 evaluation 이라 1억 doc 의 sort 키로는 timeout 위험 — hot path 는 영구 매핑."

### Q. `eager_global_ordinals` 는 무엇이고 언제 켜나요?

> "keyword 필드의 cluster-wide 통합 dictionary 빌드를 lazy → eager 로 바꾸는 옵션입니다. terms aggregation 첫 쿼리 latency 를 없애줍니다. 비용은 refresh (1초) 마다 빌드 CPU + heap. facet 으로 자주 쓰는 필드 (category, brand, status) 에만 켜고, 거의 안 쓰는 필드에 켜면 refresh 부하만 늘어납니다."

---

## 12. 흔한 오해 정정

> **"매핑은 인덱스 만들 때 한 번 박으면 끝이다"**

- ❌ 신규 필드 추가 / multi-field 추가는 가능. 단 기존 필드 type 변경 / analyzer 변경은 reindex 필수. mapping versioning + alias swap 이 표준.

> **"copy_to 가 multi_match 보다 항상 빠르다"**

- ⚠ 단일 필드 매칭이라 빠른 건 맞지만, 필드별 boost 가 사라지고 디스크 추가 비용. 신규 인덱스는 combined_fields 가 더 표현력 있음.

> **"flattened 가 dynamic mapping 의 만능 해법이다"**

- ❌ 키 explosion 은 막지만 풀텍스트 검색 / 분석기 / 정렬·집계의 정밀도는 떨어짐. 진짜 풀텍스트 필드는 별도 text 매핑.

> **"`_source` 끄면 디스크 많이 절약된다"**

- ⚠ 10~30% 절약이지만 reindex / update / highlight 깨짐. 거의 항상 후회. `_source.excludes` 로 부분 제어가 정답.

> **"runtime field 는 영구 매핑의 대체"**

- ❌ query 시점 비용. hot path 는 영구. runtime 은 ad-hoc / hotfix.

> **"norms 는 무조건 켜야 한다"**

- ⚠ 풀텍스트 점수의 핵심이지만, 점수 안 쓰는 filter-only 필드 / 로그 raw text 는 끄면 디스크 절감.

> **"eager_global_ordinals 켜면 무조건 빠르다"**

- ⚠ terms agg 자주 쓰는 필드는 빨라지지만, 거의 안 쓰는 필드에 켜면 refresh 마다 빌드 부하만 늘고 indexing latency ↑.

> **"`_routing` 만 잡으면 검색이 무조건 빠르다"**

- ⚠ fan-out 은 줄지만 hot shard 위험. routing key 카디널리티와 분포 검토 필수.

> **"copy_to 한 필드는 `_source` 에 보인다"**

- ❌ copy_to 는 색인만, `_source` 에는 안 들어감. `_search` 의 `fields` 절로 확인.

> **"text 필드도 정렬할 수 있다"**

- ⚠ fielddata 켜면 가능하지만 heap 폭증 위험. `.raw` keyword multi-field 로 정렬이 표준.

> **"alias 와 copy_to 는 비슷한 거다"**

- ❌ alias 는 포인터 (디스크 0, 별칭만), copy_to 는 값 복사 색인 (디스크 추가). 마이그레이션 → alias, 합성 검색 필드 → copy_to.

> **"ignore_malformed 켜면 데이터 정합성이 깨진다"**

- ⚠ 무시된 값은 색인 안 되지만 `_source` 에 원본은 그대로 — `_ignored` 메타로 추적 가능. 결제같은 critical 도메인은 끄고 reject, 로그 같은 best-effort 도메인은 켜는 게 표준.

---

## 13. 회독 체크리스트

> §38 회독 체크리스트:
> - [ ] scaled_float 의 scaling_factor 결정 기준 (가격 100 / 비율 10000 / bps 1000000)
> - [ ] object 4-패턴 의사결정 트리 (cross-field 정확 매칭? × dynamic key? = nested / flattened / join / object)
> - [ ] copy_to vs combined_fields vs alias 의 비용·시점·boost 비교 표
> - [ ] runtime field 의 적합 / 부적합 use case (hotfix / hot path)
> - [ ] dynamic 4 값 (true / runtime / false / strict) 차이 + dynamic_templates 패턴 매칭 우선순위
> - [ ] subobjects: false 의 dot-notation 평탄화 효과 + ECS / OTel 연계
> - [ ] doc_values / norms / index_options / eager_global_ordinals 의 역할 분리
> - [ ] index_options 4 값 (docs / freqs / positions / offsets) 의 디스크-기능 매트릭스
> - [ ] ignore_above / ignore_malformed / null_value 3개의 차이 + `_ignored` 추적
> - [ ] `_routing: required` 의 fan-out 효과 + hot shard 위험
> - [ ] `_source` disable 의 reindex 불가 함정 + `_source.excludes` 부분 제어
> - [ ] terms lookup 의 65k 카디널리티 한계
> - [ ] dis_max 와 multi_match best_fields 의 관계
> - [ ] token_count 의 길이 기반 anti-spam / 가산점 활용
> - [ ] msa products 매핑 v2 (scaled_float + rank_feature + _routing + strict dynamic) ADR 후보 답변
> - [ ] BM25F (combined_fields) 가 cross_fields 보다 정확한 이유 (IDF 통합)

---

## 14. 연결 학습

- §27 — 필드 타입 풀 카탈로그 (이 파일의 타입 deep dive)
- §04 — analyzer 파이프라인 (text 매핑의 analyzer 결정)
- §07 — Query DSL (matches / range / term / nested / has_child)
- §12 — cluster topology / shard sizing (`_routing` 의 shard 분포)
- §15 — msa 검색 grounding (현재 매핑의 점검)
- §26 — aggregations 카탈로그 (terms agg + eager_global_ordinals)
- §32 — specialized queries (rank_feature query, distance_feature)
- §35 — function_score modifier (rank_feature 와 비교)
- §36 — autocomplete (search_as_you_type, edge_ngram, multi-field 패턴)
- ADR-0019 — K8s 마이그레이션 (인덱스 alias swap 운영)
