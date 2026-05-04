---
parent: 19-search-engine
seq: 27
title: Mapping 필드 타입 풀 카탈로그 — semantic_text · sparse_vector · rank_features · wildcard · flattened · range · scaled_float
type: deep-dive
created: 2026-05-04
updated: 2026-05-04
status: completed
related:
  - 99-concept-catalog.md
  - 04-analyzer-pipeline.md
sources:
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference
catalog-row: "§A Mapping 필드 타입"
depth: full
---

# 27. Mapping 필드 타입 풀 카탈로그

> 카탈로그 매핑: §99 §A (Mapping field types) — `🟡 부분` 다수 → `✅ 커버`
> 학습 시간: ~2h · 자가평가: B

---

## 1. 한 줄 핵심

ES (Elasticsearch) 매핑 결정은 **나중에 못 바꾼다** (대부분 reindex). 필드 타입 선택 = (a) 검색 가능성, (b) 정렬·집계 가능성, (c) 디스크/메모리 비용, (d) 점수 모델 4축의 trade-off.

## 2. 결정 트리

```
필드 본질이 …
├─ 자연어 텍스트 (검색)
│   ├─ 분석 후 검색 → text (필요 시 .raw keyword multi-field)
│   ├─ 로그/URL 등 prefix·wildcard 위주 → wildcard
│   └─ 점수 통계 안 쓰는 검색 (로그 분석) → match_only_text
├─ 정확 매칭 / 정렬 / 집계 → keyword
│   ├─ 모든 doc 동일 값 → constant_keyword
│   ├─ 일관된 정규화 → normalizer 적용
│   └─ 자동완성 prefix·infix → search_as_you_type
├─ 숫자
│   ├─ 정수/실수 — 정밀도 분포 따라 long / integer / scaled_float / half_float
│   └─ 가격(소수 2자리) → scaled_float (factor 100)
├─ 시간
│   ├─ ms — date
│   └─ ns — date_nanos
├─ 객체 / 배열
│   ├─ 단순 평탄 → object (default)
│   ├─ 정확 매칭 (배열 안 객체) → nested + nested query
│   ├─ 키가 dynamic 다양 → flattened (검색은 단순)
│   └─ 부모-자식 관계 → join
├─ 지리
│   ├─ 점 좌표 → geo_point
│   └─ 도형(폴리곤/라인) → geo_shape
├─ 벡터
│   ├─ dense (학습 임베딩) → dense_vector
│   ├─ sparse (ELSER 등) → sparse_vector
│   └─ 자동 임베딩 (8.13+) → semantic_text
├─ 비즈니스 가중치
│   ├─ 단일 numeric 부스트 → rank_feature
│   └─ key→value 가중치 맵 → rank_features
├─ 메타
│   ├─ IP / SemVer → ip / version
│   └─ 범위 자체가 doc 속성 → *_range
└─ 특수
    ├─ stored query (alert) → percolator
    └─ 사전 집계 → histogram / aggregate_metric_double
```

## 3. 핵심 타입 deep dive

### 3-A. text vs keyword (재확인)

- **text**: 분석된 토큰 색인 — 풀텍스트 검색 가능, 정렬/집계 X (fielddata on 시 가능하지만 비쌈)
- **keyword**: 통째 토큰 — 정확 매칭/정렬/집계 가능, 풀텍스트 X
- **표준 패턴**: `title` text + `title.raw` keyword multi-field
- **normalizer**: keyword 에 lowercase/asciifolding — 정렬 비교 정규화

### 3-B. constant_keyword / wildcard / match_only_text

- **constant_keyword**: data stream 의 tier 분류, multi-tenant 인덱스에서 tenant id 등. 디스크 거의 0.
- **wildcard**: 비정형(로그 / URL) 의 prefix·wildcard 검색. 일반 keyword 의 wildcard 보다 훨씬 빠름. 단, 정렬·집계 비용은 큼.
- **match_only_text**: 점수용 통계(positions, norms) 미저장 → 디스크 30~50% ↓. 로그 분석 워크로드 표준.

### 3-C. semantic_text (8.13+) — 자동 임베딩의 정수

```json
PUT /docs
{
  "mappings": {
    "properties": {
      "content": {
        "type": "semantic_text",
        "inference_id": "elser-prod-1"
      }
    }
  }
}
```

- index 시점에 자동 chunking + inference endpoint 호출 → embedding 저장
- query: `semantic` query 또는 `match` query 로 자연어 — 자동 inference
- chunking strategy 옵션 (sentence / word / 8.x 신규)
- 효과: 매핑 한 줄로 BM25 (Best Match 25) + sparse/dense retrieval 동시

### 3-D. dense_vector / sparse_vector / rank_features

- **dense_vector**: HNSW (Hierarchical Navigable Small World, 다층 이웃 그래프), `dims` / `similarity` (cosine|dot_product|l2_norm|max_inner_product). 8.x 부터 **양자화** (`int8_hnsw`, `int4_hnsw`, `bbq_hnsw`) → 메모리 ↓
- **sparse_vector**: ELSER 같은 모델 출력 — token-weight map. `sparse_vector` query 로 검색
- **rank_features**: `{topic: weight}` 같은 사전 계산 가중치 map — `rank_feature` query 로 saturation/log/sigmoid/linear 함수 적용

### 3-E. nested / flattened / join

- **nested**: 배열 안 객체의 정확 매칭 보장 — 색인은 hidden child docs (오버헤드 있음)
- **flattened**: 키가 dynamic 다양해서 explosion 방지 — 검색은 단순 (정확 keyword 매칭 수준)
- **join**: 부모-자식 관계 — `has_child` / `has_parent`. **shard 동일 보장** 필요 (`routing` 필수)

### 3-F. geo_point / geo_shape

- **geo_point**: lat/lon 단일 점. `geo_distance`, `geohash_grid` 등 효율
- **geo_shape**: polygon/line/multi 도형. `INTERSECTS / WITHIN / CONTAINS / DISJOINT`

### 3-G. range types

- 도큐먼트가 범위를 들고 있는 도메인 (이벤트 유효기간, 가격대, IP 블록):
- `integer_range` / `float_range` / `long_range` / `double_range` / `date_range` / `ip_range`
- 검색 시 `range` query → 매칭 (relation: WITHIN / CONTAINS / INTERSECTS)

### 3-H. percolator

- 저장된 query 를 색인. `percolate` query 의 짝 (→ [22-percolate.md](22-percolate.md))
- 매핑 변경 시 회귀 테스트 필수

### 3-I. histogram / aggregate_metric_double

- 사전 집계된 분포·통계 저장 — downsampling/롤업 결과를 그대로 색인
- 시계열 압축 + 빠른 조회

## 4. 사용 예제 모음

### 4-1. 가격 (scaled_float)

```json
"price": { "type": "scaled_float", "scaling_factor": 100 }   // 12.34 → 1234 저장
```

### 4-2. 셀러 facet (multi-field)

```json
"seller_name": {
  "type": "text",
  "analyzer": "nori",
  "fields": { "raw": { "type": "keyword" } }
}
```

### 4-3. ELSER sparse retrieval

```json
"content_tokens": { "type": "sparse_vector" }
```
+ ingest pipeline 의 `inference` processor 가 ELSER 로 token weight 생성

### 4-4. dense_vector + INT8 양자화

```json
"vector": {
  "type": "dense_vector",
  "dims": 384,
  "index": true,
  "similarity": "cosine",
  "index_options": { "type": "int8_hnsw", "m": 16, "ef_construction": 100 }
}
```

### 4-5. flattened (사용자 attributes)

```json
"attributes": { "type": "flattened" }
```
→ `{ "host.name": "a", "any_other_key": "v" }` 자유 색인. 검색은 `attributes.host.name` 같은 prefix.

## 5. 트레이드오프 / 안티패턴

| 결정 | 함정 |
|---|---|
| text 만 매핑 | 정렬·집계 못 함 — 항상 keyword multi-field 동반 권장 |
| dense_vector 차원 큼 | 디스크·메모리 폭증 — 양자화 검토 |
| nested 남발 | 색인·쿼리 오버헤드 큼 — flattened 로 충분한 케이스 다수 |
| join 필드 | cross-shard 안 됨 (routing 강제) |
| dynamic mapping 방치 | mapping explosion → field limit, mapping size |

- **안티패턴**:
  - 가격을 `float` — 부동소수 오차 + 정렬 깨짐. → `scaled_float`
  - 시간을 `keyword` — 범위 query 못 함. → `date`
  - URL/IP 를 `text` — 분석기 깨짐. → `keyword` 또는 `ip`/`wildcard`

## 6. ES vs OpenSearch

| 타입 | ES | OS |
|---|---|---|
| 기본 타입 | 동일 | 동일 |
| `semantic_text` | 8.13+ | **미지원** (Neural plugin 으로 다름) |
| `sparse_vector` | 동일 | OS 도 sparse_vector field + neural sparse |
| dense_vector 양자화 (BBQ/INT8) | 8.x+ 강력 | OS 도 INT8/FP16/Binary — engine 별 |
| `wildcard` | 동일 | 동일 |
| `match_only_text` | 동일 | 동일 |

## 7. 운영 / 모니터링

- `index.mapping.total_fields.limit` (기본 1000) — dynamic mapping 폭주 차단
- `_cat/indices` 의 `pri.store.size` 로 매핑 변경 후 디스크 영향 확인
- `_field_caps` 로 인덱스 패턴 전체 필드 메타 점검
- 매핑 변경 시: 가능 = ① 신규 필드 추가, ② multi-field 추가. 불가능 = 기존 필드 type 변경, analyzer 변경 → reindex 필요

## 8. msa 코드베이스 grounding

| 매핑 결정 | 현재 (가설) | 권장 |
|---|---|---|
| product.title | text + nori | text + nori + .raw keyword (정렬·집계용) |
| product.price | float? | **scaled_float (factor=100)** |
| product.attributes | object 다양 | flattened — explosion 방지 |
| product.seller_id | keyword | + constant_keyword 후보? (다중 인덱스 분리 시) |
| product.tags | text | text + .raw keyword (facet) |
| product.popularity | double | **rank_feature** — function_score 보다 빠름 |
| product.embedding (PoC) | dense_vector default | **int8_hnsw** 양자화 (메모리 4배 ↓) |
| alerts.query | (미적용) | percolator (→ §22) |

## 9. 적용 후보 / ADR

**ADR-XXXX (Proposed)**: "msa search 매핑 표준 — multi-field 강제, 가격 scaled_float, popularity rank_feature, attributes flattened"
- **이유**: 매핑 변경 비용은 reindex — 표준 정의가 비용 절감 직결
- **위험**: ADR 채택 후 기존 인덱스는 alias swap reindex 필요 (search:batch 활용)

## 10. 면접 카드 + 꼬리질문

| Q | 핵심 답변 | 꼬리 |
|---|---|---|
| Q1. text 와 keyword 의 결정적 차이 + multi-field 패턴? | 분석 vs 비분석. 한 source → 두 색인 (`title` text + `title.raw` keyword) | normalizer 의 역할 |
| Q2. nested vs flattened 선택? | 정확 매칭이 필요하면 nested, 그렇지 않고 dynamic key 회피면 flattened | nested 의 색인 비용 본질? (hidden child docs) |
| Q3. 가격 필드를 왜 scaled_float? | float 의 부동소수 오차 회피 + 정렬 정확 + 디스크 효율 | factor 결정 기준 (소수 자릿수) |
| Q4. dense_vector 양자화 BBQ 의 의미는? | Better Binary Quantization — 메모리 32배 ↓, recall 일부 trade | 언제 BBQ vs INT8? |
| Q5. semantic_text 매핑이 매력적인 이유? | 매핑 한 줄 + ingest 자동 chunk/embed — app 코드 단순화 | inference_id 가 변경되면? |

## 11. 자주 듣는 오해 정정

| 오해 | 실제 |
|---|---|
| "매핑은 자유롭게 변경 가능" | 대부분 변경 불가 — 신규 필드만 가능. 변경은 reindex |
| "dynamic: true 면 편하다" | mapping explosion 위험. strict 권장 |
| "text 도 정렬 가능" | fielddata on 가능하지만 매우 비쌈 — keyword multi-field 가 정답 |
| "벡터는 무조건 비쌈" | 양자화 (BBQ/INT8/INT4) 로 4~32배 절감 |

## 12. 다음 학습

- §99 §B Mapping 파라미터 (analyzer / index_options / store / dynamic_templates / runtime fields)
- §C Index Templates / Component Templates / Data Streams
- §M Inference API + ELSER + semantic_text (→ [28-elser-semantic-text.md](28-elser-semantic-text.md))
