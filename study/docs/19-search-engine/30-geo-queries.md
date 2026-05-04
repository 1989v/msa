---
parent: 19-search-engine
seq: 30
title: Geo Queries + Geo Aggregations + Vector Tile (MVT)
type: deep-dive
created: 2026-05-04
updated: 2026-05-04
status: completed
related:
  - 99-concept-catalog.md
  - 27-mapping-field-types.md
sources:
  - https://www.elastic.co/docs/reference/query-languages/query-dsl/geo-queries
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/vector-tile-search
catalog-row: "§G Geo, §I Geo aggregations, §H _mvt"
depth: full
---

# 30. Geo Queries + Geo Aggregations + MVT

> 카탈로그 매핑: §99 §G geo / §I geo aggs / §H _mvt — `★ 신규` → `✅ 커버`
> 학습 시간: ~2h · 자가평가: A

---

## 1. 한 줄 핵심

ES (Elasticsearch) 의 geo 는 (a) 매핑 (`geo_point` / `geo_shape`), (b) 쿼리 (`geo_distance` / `geo_bounding_box` / `geo_shape`), (c) 집계 (`geohash_grid` / `geotile_grid` / `geohex_grid` / `geo_distance`), (d) 응답 포맷 (`_mvt` Vector Tile binary) 4축. 매장·배송·지도 UI 도메인의 표준 도구.

## 2. 매핑 종류

| 매핑 | 용도 | 인덱싱 자료구조 |
|---|---|---|
| `geo_point` | 단일 점 (lat/lon) | BKD-tree (Block KD-tree) |
| `geo_shape` | 폴리곤/라인/멀티 도형 | BKD + Lucene shape tessellation |
| `point` (cartesian) | 평면 좌표 (x,y) | 동일 패턴 (지구 좌표 아님) — 도면/게임 |
| `shape` (cartesian) | 평면 도형 | 동일 |

> 좌표 표기 함정: GeoJSON 은 `[lon, lat]`, well-known text 도 동일. 그러나 ES 의 `lat`/`lon` 객체 표기와 헷갈림 주의.

## 3. 쿼리 종류

### 3-A. geo_distance (반경)

```json
{
  "query": {
    "bool": {
      "filter": {
        "geo_distance": {
          "distance": "5km",
          "pin.location": { "lat": 37.5665, "lon": 126.9780 },
          "distance_type": "arc"     // arc(default) | plane(저비용 근사)
        }
      }
    }
  }
}
```

### 3-B. geo_bounding_box (박스)

```json
{
  "query": {
    "geo_bounding_box": {
      "pin.location": {
        "top_left":     { "lat": 40.73, "lon": -74.10 },
        "bottom_right": { "lat": 40.01, "lon": -71.12 }
      }
    }
  }
}
```

> geo_shape 매핑 필드도 동일 syntax 로 사용 가능 — bounding box 와 도형의 intersection.

### 3-C. geo_shape (임의 도형 + 공간 관계)

```json
{
  "query": {
    "bool": {
      "filter": {
        "geo_shape": {
          "location": {
            "shape": { "type": "envelope", "coordinates": [[13.0, 53.0], [14.0, 52.0]] },
            "relation": "within"
          }
        }
      }
    }
  }
}
```

**spatial relation 4종**:
| relation | 의미 |
|---|---|
| `INTERSECTS` (default) | 교집합 있음 |
| `DISJOINT` | 교집합 없음 |
| `WITHIN` | 도큐먼트 도형이 쿼리 도형 안에 완전히 포함 (line 미지원) |
| `CONTAINS` | 도큐먼트 도형이 쿼리 도형을 포함 |

### 3-D. distance_feature (점수 부스트)

```json
{ "distance_feature": { "field": "location", "pivot": "1000m", "origin": [-71.3, 41.15] } }
```
거리 가까울수록 점수 ↑ (decay function 자동). function_score 보다 빠름.

## 4. 집계 종류

### 4-A. geo_distance bucket

```json
"aggs": {
  "ring": {
    "geo_distance": {
      "field": "location",
      "origin": "37.5665, 126.9780",
      "unit": "km",
      "ranges": [{ "to": 1 }, { "from": 1, "to": 5 }, { "from": 5 }]
    }
  }
}
```

### 4-B. geohash_grid / geotile_grid / geohex_grid (지도 클러스터링)

```json
"aggs": { "grid": { "geohash_grid": { "field": "location", "precision": 5 } } }
```

| 형식 | 정점/모양 | 특징 |
|---|---|---|
| `geohash_grid` | 사각 (Geohash base32) | 정밀도 1~12 |
| `geotile_grid` | 정사각 (web mercator tile) | zoom 0~29, 지도 타일과 1:1 |
| `geohex_grid` | 육각 (H3) | 시각적 균등성 |

### 4-C. metric: geo_bounds / geo_centroid / geo_line

- `geo_bounds`: bucket 의 bounding box
- `geo_centroid`: bucket 의 평균 좌표
- `geo_line`: 시간 정렬된 좌표 시퀀스 — 궤적 (entity 별)

## 5. _mvt (Mapbox Vector Tile)

```http
POST /<index>/_mvt/<field>/<z>/<x>/<y>
```

검색 결과 + agg 결과를 **Mapbox Vector Tile binary** 로 내려준다 — Mapbox/Leaflet/MapLibre 지도 UI 와 직결. JSON 변환 단계 제거 → 대용량 지도 UI 가속.

옵션:
- `extent` (타일 격자), `buffer`, `grid_precision`, `grid_type` (`grid` / `point`)
- `with_labels` (point 라벨)
- 검색 본문 그대로 (query/sort/size/aggs)

## 6. 트레이드오프 / 안티패턴

| 결정 | 함정 |
|---|---|
| arc vs plane distance | plane 은 적도/극지에서 오차 — 일반은 arc |
| geo_shape 정밀도 | 인덱싱 비용 ↑. 단순 매칭은 geo_bounding_box 로 |
| geohash_grid precision 7+ | bucket 폭증 — `search.max_buckets` 위험 |
| join + geo | join 필드 cross-shard 안 됨 |

- **안티패턴**:
  - 위치를 `keyword` 로 저장 → range 불가
  - relation 미지정 (모두 INTERSECTS) — 의도 누락 시 오해
  - 매번 _search → JSON → 클라이언트 변환 (대량) → `_mvt` 미활용

## 7. ES vs OpenSearch

| 항목 | ES | OS |
|---|---|---|
| geo_point / geo_shape | 동일 | 동일 |
| geohex_grid (H3) | 8.x 도입 | OS 도 지원 (k-NN 별개) |
| `_mvt` | ES 표준 | OS 도 지원 (시점/플러그인 확인) |
| distance_feature | 동일 | 동일 |

## 8. 운영 / 모니터링

- BKD tree 색인 → segment merge 시 IO 비용 — 시계열 위치 데이터는 별도 인덱스 분리
- circuit breaker (request) — 큰 polygon WITHIN 매우 비쌈
- vector tile 캐시: CDN/edge 캐시와 결합 가능 (zoom/x/y key)
- precision 동적 조정: zoom level 에 따라 grid precision 매핑 표 (`zoom→precision`) 표준화

## 9. msa 코드베이스 grounding

| 시나리오 | 적용 후보 |
|---|---|
| 매장 / 거점 (가상) | `geo_point` + `geo_distance` 필터 + facet |
| 배송 가능 영역 | `geo_shape` (polygon) WITHIN 사용자 좌표 |
| 지도 UI 의 상품 클러스터 | `geotile_grid` + `_mvt` 응답 → MapLibre 직결 |
| product 카탈로그 (현재) | 위치 데이터 없음 — 미적용 |

## 10. 적용 후보 / ADR

**ADR-XXXX (Proposed, 시나리오 기반)**: "위치 도메인 진입 시 매핑 = geo_point 우선, 폴리곤 매칭은 geo_shape, 지도 UI 는 _mvt 표준"
- **이유**: 매핑 결정은 reindex — 처음에 잘 잡으면 비용 ↓
- **위험**: geohash precision / shape 정밀도 = sizing 영향 — 사이징 가이드 동반

## 11. 면접 카드 + 꼬리질문

| Q | 핵심 답변 | 꼬리 |
|---|---|---|
| Q1. geo_point 와 geo_shape 의 결정? | 점 = geo_point (BKD), 도형 = geo_shape (tessellation). 비용·기능 trade | distance 만 필요하면 geo_point + geo_distance 가 가장 빠름 |
| Q2. geo_bounding_box 가 빠른 이유? | BKD-tree 의 사각 범위 검색이 매우 효율적 | 경위도 경계 (date line) 처리는? |
| Q3. _mvt 의 가치? | 검색 결과를 vector tile binary 로 — JSON→클라이언트 변환 단계 제거, 캐시 가능 | 캐시 키 설계? (z/x/y + query hash) |
| Q4. distance_feature 가 function_score 보다 빠른 이유? | 사전 정의된 decay 함수 + numeric/date/geo 전용 빠른 점수 계산 | recency 부스트도 적용 가능? |
| Q5. geohash_grid precision 결정? | 지도 zoom level 과 1:1 매핑 표 만들고 동적 조정 | 폭증 방지 (max_buckets) |

## 12. 자주 듣는 오해 정정

| 오해 | 실제 |
|---|---|
| "GeoJSON 도 lat/lon 순서" | 아님. GeoJSON 은 `[lon, lat]` |
| "WITHIN 이면 line 도 됨" | 아님 — line 미지원 |
| "_mvt 는 Elastic 전용" | 표준 binary 포맷 — Mapbox/MapLibre 호환 |

## 13. 다음 학습

- §99 §I geohex_grid, geotile_grid 추가 활용
- §99 §A geo_point/geo_shape 매핑 옵션 (precision/orientation)
- §H _mvt 와 캐싱 전략 (CDN 결합)
