---
parent: 19-search-engine
seq: 26
title: Aggregations 풀 카탈로그 — Bucket / Metric / Pipeline / Composite
type: deep-dive
created: 2026-05-04
updated: 2026-05-04
status: completed
related:
  - 99-concept-catalog.md
  - 07-query-dsl-patterns.md
sources:
  - https://www.elastic.co/docs/reference/aggregations
  - https://www.elastic.co/docs/reference/aggregations/pipeline
catalog-row: "§I Aggregations 카테고리"
depth: full
---

# 26. Aggregations 풀 카탈로그

> 카탈로그 매핑: §99 §I (bucket / metric / pipeline / composite) — `🟡 부분` → `✅ 커버`
> 학습 시간: ~2h · 자가평가: B

---

## 1. 한 줄 핵심

ES (Elasticsearch) 의 aggregation = "검색 결과의 dimensional rollup". 3계층 — **Bucket** (그룹화) / **Metric** (그룹 내 통계) / **Pipeline** (집계 결과의 후처리). **Composite** 는 키셋 paginated GROUP BY.

## 2. 동작 원리

```
검색 hits (matched docs)
    │
    ▼
[Bucket aggs]    : terms / date_histogram / range / nested / filters / composite
    │  (per bucket)
    ▼
[Metric aggs]    : sum / avg / cardinality / percentiles / top_hits ...
    │  (sibling 또는 parent)
    ▼
[Pipeline aggs]  : moving_fn / derivative / cumulative_sum / bucket_script ...
    │
    ▼
응답 buckets[].sub_agg.value
```

핵심 결정축: (a) 정확도 vs 메모리 (cardinality, percentile), (b) bucket 수 ceiling (terms.size, composite.size), (c) doc_values vs fielddata 비용.

## 3. 카테고리별 카탈로그

### 3-A. Bucket Aggregations (그룹화)

| 종류 | 1줄 정의 | 핵심 파라미터 / 함정 |
|---|---|---|
| `terms` | 필드값별 buckets. count desc 기본 | `size` 외 doc 들은 `sum_other_doc_count` — 정확 top-N 보장 X (shard size 함정) |
| `multi_terms` | 다중 필드 조합 GROUP BY | terms 보다 비쌈, doc_values 필요 |
| `significant_terms` / `significant_text` | 배경 대비 "이상하게 자주" 등장하는 term — 트렌드/이상 탐지 | text 는 fielddata 켜야 함 |
| `rare_terms` | terms 의 반대 — 가장 드문 term | 정확도 보장 trick (CMS-like) |
| `sampler` / `diversified_sampler` | 점수 상위 N 만 표본 → 위 agg 와 결합. diversified 는 동일 카테고리 중복 제외 | recall 일부 포기 + 비용 ↓ |
| `histogram` | 숫자 일정 간격 bucket | `interval` 작으면 bucket 폭증 |
| `date_histogram` | 날짜 calendar/fixed 간격 | `calendar_interval` (month, week) 와 `fixed_interval` (1h, 30m) 차이 |
| `auto_date_histogram` | 결과 buckets 수에 맞게 간격 자동 | 시계열 자동 차트에 좋음 |
| `variable_width_histogram` | 데이터 분포 기반 가변 폭 | percentile 같은 분포 기반 시각화 |
| `range` / `date_range` / `ip_range` | 명시 범위 bucket | bucket 정의 명시적 |
| `geo_distance` / `geohash_grid` / `geotile_grid` / `geohex_grid` | 지리 클러스터 (반경 / 해시 / 타일 / 헥스) | 지도 zoom level 기반 클러스터링 |
| `filter` / `filters` | 단일/다중 임의 query 조건 bucket | 동일 검색을 여러 슬라이스로 |
| `adjacency_matrix` | filters 의 cross-product (cohort 분석) | filter 수 N → bucket N² |
| `nested` / `reverse_nested` | nested doc 컨텍스트 진입/탈출 | nested 매핑 필수 |
| `parent` / `children` | join 필드 기반 부모↔자식 집계 | join 필드 비용 |
| `composite` | keyset paginated GROUP BY (after_key) | terms 의 size 한계 우회 — 대용량 export |
| `missing` | 필드 없는 doc bucket | null 처리 |

### 3-B. Metric Aggregations

| 종류 | 1줄 정의 | 함정 |
|---|---|---|
| `avg` / `sum` / `min` / `max` / `value_count` / `stats` / `extended_stats` | 표준 통계 | doc_values 기본 — text 필드는 fielddata 필요 |
| `cardinality` | unique 카운트 (HyperLogLog++) | `precision_threshold` 로 정확도 ↔ 메모리 — 보통 3000~40000 |
| `percentile` | 분위수 (TDigest 기본 / HDR 옵션) | percentile 9개 default, `percents` 로 조정 |
| `percentile_ranks` | 값 → 어느 percentile 인가 (역질의) | latency SLO (Service Level Objective, 서비스 수준 목표) 분석 |
| `top_hits` | bucket 별 대표 doc N — sort/_source/highlight 가능 | doc fetch 비용 ↑ |
| `top_metrics` | bucket 별 가장 최신 metric "값 하나" — top_hits 의 경량화 | sort 기준 한 metric 만 |
| `weighted_avg` | 가중 평균 (weight 필드) | |
| `median_absolute_deviation` | 외리치 강건 분산 지표 | |
| `geo_bounds` / `geo_centroid` / `geo_line` | 지리 경계/중심/궤적 | 지도 시각화 |
| `string_stats` | 문자열 길이 통계 | text 분석용 |
| `t_test` / `boxplot` | 통계 검정 / 박스플롯 | A/B 테스트 |
| `rate` | 시간당 비율 (date_histogram 안에서) | unit (`minute`/`hour`/...) |
| `matrix_stats` / `scripted_metric` | 다변량/맞춤 | scripted 는 비쌈 |

### 3-C. Pipeline Aggregations (집계 결과 후처리)

| 종류 | 정의 | 활용 |
|---|---|---|
| `avg_bucket` / `sum_bucket` / `min_bucket` / `max_bucket` / `stats_bucket` / `extended_stats_bucket` / `percentiles_bucket` | sibling: 다른 multi-bucket agg 의 metric 을 한 번 더 통계 | "월별 매출의 평균" |
| `cumulative_sum` / `cumulative_cardinality` | parent: 누적 합/유니크 | 시계열 누적 차트 |
| `derivative` | parent: 인접 bucket 차분 | "증감량" |
| `serial_diff` | period 간 차분 | 계절성 제거 |
| `moving_fn` (`moving_avg` deprecated) | parent: 이동 윈도우 함수 | 스무딩, 추세선 |
| `bucket_script` | 여러 metric 결합 (Painless) | "비율, 가중점수" |
| `bucket_selector` | bucket 필터 (Painless) — 조건 안 맞으면 제거 | 임계 미만 bucket 제거 |
| `bucket_sort` | bucket 정렬·페이지 | parent agg 결과 page |
| `normalize` | bucket 값 정규화 (mean/percent/...) | 스케일 통일 |
| `inference` (ML) | bucket value 를 ML 모델로 예측 | 이상치 라벨링 |

### 3-D. Composite (paginated GROUP BY)

```json
"aggs": {
  "by_seller_day": {
    "composite": {
      "size": 1000,
      "sources": [
        { "seller": { "terms": { "field": "seller_id" } } },
        { "day":    { "date_histogram": { "field": "ts", "fixed_interval": "1d" } } }
      ],
      "after": { "seller": "S001", "day": 1714521600000 }
    },
    "aggs": { "revenue": { "sum": { "field": "price" } } }
  }
}
```

응답에 `after_key` 가 들어와 다음 페이지 호출에 그대로 사용. **export / 대용량 GROUP BY 표준**.

## 4. 사용 예제 — 시나리오 모음

### 4-1. 카테고리별 매출 + 월별 추세

```json
{
  "size": 0,
  "aggs": {
    "by_cat": {
      "terms": { "field": "category", "size": 20 },
      "aggs": {
        "by_month": {
          "date_histogram": { "field": "order_at", "calendar_interval": "month" },
          "aggs": { "revenue": { "sum": { "field": "price" } } }
        },
        "ma": {
          "moving_fn": { "buckets_path": "by_month>revenue", "window": 3, "script": "MovingFunctions.unweightedAvg(values)" }
        }
      }
    }
  }
}
```

### 4-2. 셀러별 대표 상품 5개 (top_hits)

```json
{
  "aggs": {
    "by_seller": {
      "terms": { "field": "seller_id", "size": 50 },
      "aggs": {
        "top_products": { "top_hits": { "size": 5, "sort": [{ "score": "desc" }], "_source": ["title", "price"] } }
      }
    }
  }
}
```

### 4-3. 사용자 cardinality (Unique users)

```json
"unique_users": { "cardinality": { "field": "user_id", "precision_threshold": 40000 } }
```

### 4-4. 임계 매출 미만 bucket 제거

```json
"aggs": {
  "by_day": {
    "date_histogram": { "field": "ts", "calendar_interval": "day" },
    "aggs": {
      "revenue": { "sum": { "field": "price" } },
      "drop_low": { "bucket_selector": { "buckets_path": { "r": "revenue" }, "script": "params.r >= 100000" } }
    }
  }
}
```

## 5. 트레이드오프 / 안티패턴

| 측면 | 장점 | 비용 |
|---|---|---|
| terms 정확도 | top-N 빠름 | shard 별 부분 정확 — `shard_size` 튜닝 |
| cardinality | HLL++ — O(1) 메모리 | 정확도 trade-off (precision_threshold) |
| top_hits | 그룹 대표 doc | doc fetch 비용 |
| composite | paginated, 무제한 | terms 의 doc_count 정렬 못 함 |
| pipeline | 클라이언트 후처리 회피 | 어떤 pipeline 은 메모리 폭발 (cumulative) |

- **안티패턴**:
  - `terms.size: 100000` — 메모리 폭발. 그럴 땐 composite
  - text 필드 terms — fielddata on 필요 (대부분 잘못 — keyword multi-field 만들기)
  - script_metric 남발 — 비쌈, custom Painless 캐시 미흡

## 6. ES vs OpenSearch

| 항목 | ES | OS |
|---|---|---|
| 일반 agg | 동일 | 동일 |
| `inference` pipeline agg | Elastic 전용 (ML 라이선스) | 미지원 |
| `t_test` / `boxplot` | 동일 | 동일 |
| `composite` | 동일 | 동일 |

## 7. 운영 / 모니터링

- `_search?profile=true` 의 aggregations 섹션으로 노드별 비용 측정
- circuit breaker (request, fielddata) 모니터링
- `search.max_buckets` (default 65536) — 폭발 방지
- terms shard_size 가설 검증: doc_count_error_upper_bound

## 8. msa 코드베이스 grounding

| 위치 | 현재 | 적용 후보 |
|---|---|---|
| analytics (ClickHouse) | OLAP 메인 | ES 가 OLAP 보조면 composite + bucket_script |
| search aggs | 카테고리 facet 정도 (가설) | terms + multi-field, top_hits 로 셀러 facet + 대표 1 |
| operational dashboard | 슬로우 로그/메트릭은 Prom | search slow log → date_histogram + percentile_ranks 로 P95 모니터 |

## 9. 적용 후보 / ADR

**ADR-XXXX (Proposed)**: "ES aggregation 사용 가이드 — terms vs composite 경계, cardinality precision 표준"
- terms.size > 1000 = composite 권장
- cardinality precision_threshold = 40000 (메모리 비용 합리화)
- pipeline agg 우선 (클라이언트 후처리 회피)

## 10. 면접 카드 + 꼬리질문

| Q | 핵심 답변 | 꼬리 |
|---|---|---|
| Q1. terms agg 의 doc_count_error 의 의미? | shard 별 부분 정렬 결과를 합산하는 구조 — top-N 가 정확 보장 안 됨. shard_size 로 완화 | 정확 top-N 이 필수면? (composite 또는 size↑) |
| Q2. cardinality 가 정확하지 않은 이유? | HyperLogLog++ — 확률적 자료구조. precision_threshold 로 메모리↔정확 trade | precision_threshold 가 클수록? (메모리·CPU↑) |
| Q3. terms vs composite 선택? | 표시 용도면 terms (`size` 작게), 대용량 export 면 composite | composite 의 sort 한계? (sources 순서 외 못 정렬) |
| Q4. percentile TDigest vs HDR? | TDigest 가 default. 분포 꼬리 정확도가 중요하면 HDR | HDR 의 한계는? (양수 정수 + 상한 필요) |

## 11. 자주 듣는 오해 정정

| 오해 | 실제 |
|---|---|
| "terms 가 정확 top-N" | 부분 정확. doc_count_error 확인 |
| "agg 는 hits 와 무관" | aggregation 도 query 의 필터링 결과 위에서 작동 |
| "pipeline agg 는 모두 cheap" | cumulative_*, scripted 는 비쌀 수 있음 |

## 12. 다음 학습

- §99 §I 의 geo 계열 (→ [30-geo-queries.md](30-geo-queries.md))
- §H field collapsing 과 top_hits 비교 (→ [25-field-collapsing-rescore.md](25-field-collapsing-rescore.md))
- ES|QL 의 STATS — agg 의 SQL-like 표현 (→ [33-query-languages.md](33-query-languages.md))
