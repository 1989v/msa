---
parent: 20-recommendation-modeling
seq: 07
title: Geo-aware 추천 — Geohash · S2 · H3 셀 인덱싱, 거리 패널티 + 인기 보정 결합 공식
type: deep
created: 2026-05-12
---

# 07. Geo-aware 추천 (거리/위치 기반)

> **Phase 3 단일 파일**. 위치는 OTA (Online Travel Agency, 온라인 여행사) 추천의 핵심 컨텍스트. 숙소 → 액티비티 cross 추천, 랜드마크 인기도 같은 패턴이 모두 위치 기반. 인덱싱 + 거리 계산 + score 결합을 균형있게.

---

## 1. Geo-aware 추천의 위치 — Funnel Stage 1

§01 §5 의 Funnel 에서 retrieval stage 의 한 갈래:

```
Stage 1: Retrieval
   ├─ CF (View Together, Buy Together, ...)
   ├─ Two-Tower (deep embedding)
   ├─ Geo-aware  ← 이 파일
   ├─ Content-based (Sentence-BERT)
   └─ 룰 기반 (Category Best)
```

Geo-aware 의 입력은:
- 사용자 현재 위치 (또는 사용자가 탐색 중인 도시/지역)
- 아이템 (숙소/액티비티) 의 위경도

산출은:
- "이 위치 근처의 후보 아이템 Top-N"

여기에 인기 보정 / 거리 패널티 / 사용자 취향 매칭을 결합하면 정밀 ranking.

### 1-1. 왜 Geo 가 OTA 추천에서 특별히 중요한가

OTA 도메인의 특성:
- 같은 도시 안에서도 "강남" 의 호텔 vs "강북" 의 호텔은 사용자 의도가 다름
- 숙소 예약 시 근처 액티비티에 대한 cross-sell 기회 (전체 매출의 20~30%)
- 랜드마크 (에펠탑, 경복궁) 가 검색의 anchor — "에펠탑 근처 호텔"
- 도시 단위는 너무 broad, 위경도 단위는 너무 fine — 그 중간 단위가 필요 (셀 인덱싱)

→ 일반 e-commerce 보다 **위치 컨텍스트의 가치가 높다**.

---

## 2. Geohash / S2 / H3 셀 인덱싱 비교

위경도 (continuous) 를 셀 (discrete) 로 매핑하는 3가지 표준 방식.

### 2-1. Geohash (1972, Gustavo Niemeyer 개선판 2008)

**아이디어**: 위경도를 base32 문자열로 인코딩.

```
경도 -180 ~ 180, 위도 -90 ~ 90
  → 이진 분할 (위경도 교대로)
  → 5비트씩 묶어 base32 문자

서울시청 (37.5665, 126.9780) → "wydm6"
서울역   (37.5547, 126.9707) → "wydm4"
```

**셀 크기**: 정밀도 (문자열 길이) 에 따라.
- 1자: 5000km × 5000km
- 4자: 39km × 19km (작은 도시)
- 6자: 1.2km × 0.6km (블록)
- 8자: 38m × 19m (건물)
- 12자: 3.7cm × 1.9cm

**장점**:
- ✅ 문자열 prefix 만 비교하면 근처 확인 (prefix 6자 같으면 ≤ 1km 근처)
- ✅ 단순 — 모든 DB / 검색엔진이 지원

**한계**:
- ❌ **셀 경계 함정** — Geohash 가 다른데 실제로 가까운 위치 (경계 바로 옆)
- ❌ **사각형 셀** — 적도 부근과 극지방에서 크기 왜곡
- ❌ 8 인접 셀까지 검색해야 정확 (boundary cell 처리)

### 2-2. S2 (Google, 2014~)

**아이디어**: 지구를 정육면체 (cube) 에 투영 → 각 면을 4분할 재귀 → cell.

```
S2CellId: 64-bit integer
   레벨 0: 6 cells (cube 면)
   레벨 30: 거의 점 (cm 단위)

서울시청 (37.5665, 126.9780) → S2CellId(레벨 15) = 0x3539c5...
```

**장점**:
- ✅ **거의 균일한 셀 크기** — 적도/극지방 왜곡 적음
- ✅ **공간 채우기 곡선 (Hilbert curve)** — 인접 셀이 정수 ID 도 가까움 → range query 효율
- ✅ Geohash 의 prefix 함정 해결

**한계**:
- ❌ 라이브러리 의존 (Google S2)
- ❌ 사람이 읽기 어려움 (64-bit integer)
- ❌ 셀이 사각형이라 6각형 알고리즘에 비해 코너 처리 복잡

### 2-3. H3 (Uber, 2018)

**아이디어**: 지구를 **6각형 셀** 로 분할. 각 6각형을 7개로 재귀 분할.

```
H3 index: 64-bit integer
   레벨 0: 122 cells (지구 전체)
   레벨 15: 0.9m² (가장 작음)

서울시청 → H3CellId(레벨 8) = 0x88...
```

**장점**:
- ✅ **6각형 = 인접 셀까지 거리가 모두 같음** (사각형은 대각선이 더 멈)
- ✅ Uber 의 실시간 ETA / 차량 매칭 산업 검증
- ✅ ride-sharing / delivery 도메인 표준

**한계**:
- ❌ 6각형은 지구 전체를 완벽히 채우지 못함 (12개의 5각형 보정 필요)
- ❌ Geohash 처럼 prefix 매칭 안 됨 (위계 구조 다름)
- ❌ 학습 곡선 가장 가파름

### 2-4. 비교 표

| 축 | Geohash | S2 | H3 |
|---|---|---|---|
| **셀 모양** | 사각형 | 사각형 (정육면체 투영) | 6각형 |
| **크기 균일성** | 위도에 따라 왜곡 | 거의 균일 | 균일 |
| **인접 거리** | 사각형 (대각선 멈) | 사각형 | **균일 (6각형)** |
| **Prefix 매칭** | ✅ 가능 | 부분 (Hilbert) | ❌ 불가 |
| **출처** | 1972 / 2008 | Google 2014 | Uber 2018 |
| **산업 사용** | DB 기본, 단순 use case | Google, ride-sharing | Uber, delivery, 정밀 추천 |
| **추천 시스템** | 가장 흔함 (단순) | 점점 도입 | 정밀한 cross 추천 |

### 2-5. 산업 선택 기준

- **단순 근접 검색 / 기존 DB 활용**: Geohash
- **대규모 지리 데이터 / 균일 크기 필요**: S2
- **6각형 거리 정확도 + ride-sharing 도메인**: H3

OTA 추천에서는 **Geohash 또는 S2 가 일반적**. H3 는 차량 매칭 도메인이 주류.

---

## 3. 거리 계산 — 위경도 → 미터

같은 셀 안에서도 미세 정렬이 필요할 때 정확한 거리.

### 3-1. Haversine Formula (산업 default)

지구를 완전한 구 (sphere) 로 가정한 거리.

```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
c = 2 × atan2(√a, √(1-a))
distance = R × c

R: 지구 반지름 ≈ 6371 km
```

오차: 지구는 완전한 구가 아니라 적도 부분이 약간 부풀어 있음 (지오이드). Haversine 오차 ≈ ±0.5% (일반 추천에 충분).

### 3-2. Vincenty Formula

지구를 ellipsoid (타원체) 로 가정. Haversine 보다 정확하지만 비싸다.

오차: ±1mm (GIS 측량 수준).

**산업 선택**:
- 추천 시스템 거리: **Haversine** (속도 + 정확도 균형)
- 측량 / 항해: **Vincenty** (정확도 필수)

### 3-3. 데이터베이스 / 검색엔진의 거리 함수

| 시스템 | 함수 | 비고 |
|---|---|---|
| **Elasticsearch** | `geo_distance` query | sloppy_arc (빠른 근사) / arc (정확) / plane (평면) |
| **BigQuery** | `ST_DISTANCE(point1, point2)` | Vincenty 기반 (GIS 표준) |
| **PostGIS** | `ST_Distance(geom1, geom2)` | geography 타입 = Vincenty, geometry 타입 = 평면 |
| **MySQL 8** | `ST_Distance_Sphere(p1, p2)` | Haversine |

---

## 4. ES geo_distance vs BigQuery ST_DWITHIN vs PostGIS R-tree

산업 추천 시스템에서 가장 흔히 쓰는 3가지 인덱싱 시스템.

### 4-1. Elasticsearch `geo_distance` Query

```json
{
  "query": {
    "bool": {
      "filter": [
        {
          "geo_distance": {
            "distance": "5km",
            "location": { "lat": 37.5665, "lon": 126.9780 }
          }
        }
      ]
    }
  }
}
```

**인덱싱**: BKD-tree (Block KD-tree) — Lucene 6+ 의 표준. 다차원 점 검색에 최적.

**성능**:
- 1억 point: 5km 반경 검색 ~10ms (cluster 1 노드)
- BM25 (Best Match 25) 와 결합 가능 — function_score 로 거리 패널티 직접 표현
- ANN (Approximate Nearest Neighbor, 근사 최근접 이웃) 결합 가능 — dense_vector + geo_distance hybrid

**OTA 추천 활용**: 검색 + 추천이 같은 인덱스에서 → Hybrid Search (#19 §07 cross-ref) 의 자연스러운 확장.

### 4-2. BigQuery `ST_DWITHIN`

```sql
SELECT
  offer_id,
  ST_DISTANCE(
    ST_GEOGPOINT(lon, lat),
    ST_GEOGPOINT(126.9780, 37.5665)
  ) AS distance_meters
FROM offers
WHERE ST_DWITHIN(
  ST_GEOGPOINT(lon, lat),
  ST_GEOGPOINT(126.9780, 37.5665),
  5000  -- 5km
)
ORDER BY distance_meters
LIMIT 100
```

**인덱싱**: BigQuery 의 clustered table + ST_DWITHIN bounding box pre-filter.

**성능**:
- 대규모 batch 잡 (cb-nearby 같은) — 모든 offer × 모든 city 의 거리 계산 OK
- 실시간 단건 쿼리는 비쌈 (BigQuery slot 시간)
- → **batch 산출 + Redis 캐시 + 실시간 룩업** 패턴 표준

### 4-3. PostGIS — Geography vs Geometry

```sql
-- Geography type: WGS84 좌표계, 지구 표면 거리 (Vincenty)
SELECT * FROM offers
WHERE ST_DWithin(
  location::geography,
  ST_GeogFromText('POINT(126.9780 37.5665)'),
  5000  -- meters
);

-- R-tree index on geography column
CREATE INDEX idx_offer_location_geog
ON offers USING GIST (location);
```

**인덱싱**: GIST (Generalized Search Tree) — R-tree variant. **공간 인덱스의 고전**.

**성능**:
- PostgreSQL 기반 트랜잭션 시스템에 자연스러움
- 1000만 point: 5km 반경 검색 ~5ms
- 다른 RDB 쿼리와 함께 transaction — order/inventory 와 함께 묶기 좋음

### 4-4. 선택 기준

| 시나리오 | 추천 시스템 |
|---|---|
| 검색 + 추천 통합 | **Elasticsearch** geo_distance |
| 대규모 batch 추천 산출 | **BigQuery** ST_DWITHIN |
| 트랜잭션 시스템 통합 | **PostGIS** GIST |
| 실시간 ride-sharing | **Redis Geo** (GEOSEARCH 명령) |

OTA 추천의 일반 패턴:
- Batch: BigQuery (cb-nearby, lb 등의 산출)
- Serving: Redis (캐시 + 실시간 geo 검색)
- Hybrid: ES (검색-추천 통합)

---

## 5. 거리 패널티 + 인기 보정 결합 공식 (핵심)

Geo-aware 추천의 가장 중요한 부분. 단순히 "근처의 인기 상품" 이 아니다.

### 5-1. 단순 결합의 함정

**시도 1: 거리만**
```
score = -distance
```
→ 가장 가까운 게 항상 1위. 품질 무시. 적은 노출도 1위.

**시도 2: 인기만**
```
score = popularity
```
→ 도시 전체에서 가장 인기 상품만 노출. 위치 컨텍스트 손실.

**시도 3: 단순 곱 / 합**
```
score = popularity × (1 / distance)
score = popularity - α × distance
```
→ 단위 불일치. distance=0 에서 발산. 비직관적.

### 5-2. 표준 결합 공식 — Exponential Distance Decay

산업 표준:

```
score(item, user_location) = popularity(item) × exp(-distance(item, user_location) / τ)

τ: 특성 거리 (characteristic distance, 미터 단위)
```

**의미**:
- distance = 0: exp(0) = 1 → popularity 그대로
- distance = τ: exp(-1) ≈ 0.37 → popularity × 0.37
- distance = 2τ: exp(-2) ≈ 0.135 → popularity × 0.135
- distance = 3τ: exp(-3) ≈ 0.05 → popularity × 0.05

τ 가 "거리가 멀어질 때 얼마나 빠르게 weight 감쇠하는가" 의 조절 파라미터.

**도메인별 τ 권장값**:
- 도시 내 호텔: τ ≈ 1km (5km 만 멀어도 거의 제외)
- 도시 내 액티비티: τ ≈ 2km
- 도시 외곽 / 자연 관광: τ ≈ 10km
- 국가 단위 여행: τ ≈ 100km

### 5-3. 정규화 — log popularity

popularity 가 power-law 분포 (인기 상품이 너무 크다) 면 score 가 popularity 에 지배됨.

보정:
```
score = log(1 + popularity) × exp(-distance / τ)
```

§02 §9-3 의 log-count 변환 + 거리 감쇠 결합.

### 5-4. 사용자 매칭 결합

거리 + 인기 + 사용자 취향:

```
score = log(1 + popularity)              ← 인기 (§05 행동 가중합 결과)
      × exp(-distance / τ)               ← 거리 패널티
      × cosine(user_vec, item_vec)       ← 사용자 매칭 (CF / Two-Tower)
```

**산업 풀 공식 (Phase 7 §17 의 cold-start 까지 포함)**:
```
score = ( log(1 + popularity) × exp(-distance / τ) ) ^ α
      × ( cosine(user_vec, item_vec) ) ^ β
      × ( exp(-age_days / γ) ) ^ δ      ← time decay (§05 §4-2)
      × cold_start_bonus                ← 신상품 부스팅

α, β, γ, δ: hyperparameter
```

복잡하지만 각 항이 명확한 의미. **A/B 테스트로 튜닝** (Phase 9).

### 5-5. 숙소 → 액티비티 Cross Cells

산업의 cross-nearby 엔진 패턴. 사용자가 호텔 예약 → 그 호텔 근처 액티비티 추천.

```
score(activity, hotel_location)
  = popularity(activity)                    ← 액티비티 자체 인기
  × exp(-distance(activity, hotel) / τ)     ← 호텔과의 거리 (τ=2km)
  × category_diversity_bonus(user)          ← 사용자가 안 본 카테고리 우대
```

**핵심**: hotel.location 을 사용자의 "잠재 위치" 로 사용. 사용자가 그 hotel 에 묵으니까 그 근처에 있을 것이라는 추론.

---

## 6. 랜드마크 인기도 (lb / ldp) 패턴

산업 카탈로그의 lb (Landmark Best) / ldp (Landmark Display Preference) 엔진.

### 6-1. 시그널 — 랜드마크 anchored 검색

사용자 검색 행동의 특수성:
- "에펠탑 근처 호텔" — 랜드마크가 anchor
- "강남역 맛집" — 역사가 anchor
- "경복궁 도보 5분" — 랜드마크가 anchor

→ **POI (Point of Interest, 관심 지점)** 가 검색의 좌표가 된다.

### 6-2. lb (Landmark Best) 산출 패턴

```sql
-- 도시 × 랜드마크 별 인기 offer 산출
WITH landmark_offer_distance AS (
  SELECT
    l.landmark_id,
    l.city_id,
    o.offer_id,
    ST_DISTANCE(l.location, o.location) AS distance_meters
  FROM landmarks l
  JOIN offers o ON o.city_id = l.city_id
  WHERE ST_DWITHIN(l.location, o.location, 5000)  -- 5km 이내만
),
scored AS (
  SELECT
    landmark_id,
    offer_id,
    -- log popularity × exp distance decay
    LOG10(1 + reservation_cnt * 100 + click_cnt * 20 + addwish_cnt * 10)
      * EXP(-distance_meters / 1500.0)  -- τ = 1.5km
      AS score
  FROM landmark_offer_distance lod
  JOIN offer_actions_30d oa ON lod.offer_id = oa.offer_id
),
ranked AS (
  SELECT
    landmark_id,
    offer_id,
    score,
    ROW_NUMBER() OVER (PARTITION BY landmark_id ORDER BY score DESC) AS rank
  FROM scored
)
SELECT * FROM ranked WHERE rank <= 20
```

### 6-3. ldp (Landmark Display Preference) — 도시별 랜드마크 인기 순위

ldp 는 한 단계 위. **"이 도시에서 어떤 랜드마크가 사용자 검색에 자주 나타나는가?"**

```
ldp_score(landmark) = α × log(1 + search_count)         ← 검색 빈도
                    + β × log(1 + offer_click_count)    ← 그 랜드마크 anchored 검색의 click
                    + γ × log(1 + reservation_count)    ← 전환률
                    - δ × landmark_age_days             ← 신선도
```

도시 메인 페이지의 "유명 명소" 섹션이 이 ldp 로 정렬.

---

## 7. nearby 패밀리의 Long-term CTR 보정

산업 카탈로그의 nearby-tna / nearby-products / long-stay-nearby 엔진.

### 7-1. Long-term CTR 의 의미

단기 CTR (7일) 만 보면 변동이 큼:
- 마케팅 캠페인 효과
- 시즌 특수 (성수기 비수기)
- 신상품 호기심 클릭

→ **장기 CTR (30일~90일) 로 보정** 이 안정적.

### 7-2. Long-term Smoothing 패턴

```
long_term_ctr(offer) = exp(decay_factor × age) × short_term_ctr
                     + (1 - exp(decay_factor × age)) × historical_avg_ctr

decay_factor: 데이터 양에 따라 자동 조정 (Bayesian smoothing 변형)
```

§06 의 Bayesian smoothing 과 비슷한 정신 — 데이터 적으면 historical 평균에 회귀.

### 7-3. nearby-tna vs nearby-products vs long-stay-nearby

| 엔진 | 대상 | 핵심 시그널 |
|---|---|---|
| **nearby-tna** | TNA (투어/액티비티) 간 근접 | 같은 카테고리 다양성 |
| **nearby-products** | 통합 (main/detail 페이지용) | 도메인 cross |
| **long-stay-nearby** | 장기 숙박 간 근접 | 장기 CTR + 가격대 매칭 |

장기 숙박 (long-stay) 의 특수성:
- 사용자가 신중하게 결정 (1주 이상 묵음)
- 가격대 차이가 score 에 큰 영향
- 장기 CTR 안정성 중요

---

## 8. 산업 코드 패턴 — Geo + Score 결합

### 8-1. Elasticsearch function_score (검색 + 추천 통합)

```json
{
  "query": {
    "function_score": {
      "query": {
        "bool": {
          "filter": [
            { "term": { "city_id": "seoul" } },
            { "term": { "category": "hotel" } }
          ]
        }
      },
      "functions": [
        {
          "exp": {
            "location": {
              "origin": "37.5665,126.9780",
              "scale": "1km",
              "offset": "0",
              "decay": 0.5
            }
          }
        },
        {
          "field_value_factor": {
            "field": "popularity",
            "modifier": "log1p"
          }
        }
      ],
      "score_mode": "multiply"
    }
  }
}
```

- `exp(location, scale=1km, decay=0.5)` 가 정확히 `exp(-distance / 1442m)` 와 동등 (1442 ≈ 1km / ln(0.5))
- `field_value_factor` 의 `log1p` 가 `log(1 + popularity)`
- `score_mode: multiply` 로 두 score 결합

### 8-2. Python — 사용자 위치 기반 ranking

```python
import math

def geo_score(item_popularity, distance_meters, tau_meters=1500):
    """log(1 + popularity) × exp(-distance / tau)"""
    return math.log1p(item_popularity) * math.exp(-distance_meters / tau_meters)

def rank_nearby(items, user_lat, user_lon):
    """items: [(item_id, popularity, lat, lon), ...]"""
    from haversine import haversine
    scored = []
    for item_id, popularity, lat, lon in items:
        dist = haversine((user_lat, user_lon), (lat, lon)) * 1000  # km → m
        score = geo_score(popularity, dist)
        scored.append((item_id, score, dist))
    return sorted(scored, key=lambda x: -x[1])[:20]
```

---

## 9. 흔한 함정 7가지

| # | 함정 | 실제 |
|---|---|---|
| 1 | "Geohash prefix 같으면 가까운 거리" | 셀 경계 함정 — Geohash 다른데 더 가까울 수 있음. 8 인접 셀까지 검색 필요. |
| 2 | "위경도 차이를 거리로 직접 사용" | 위도/경도 1° 의 거리가 적도와 극지방 다름. Haversine 또는 ST_DISTANCE 필수. |
| 3 | "거리만으로 ranking" | 적은 노출 아이템 1위 (§02 §10 함정). popularity 결합 필수. |
| 4 | "거리 패널티를 1/distance 로" | distance=0 발산. exp(-distance/τ) 가 산업 표준 (smooth + 0~1 범위). |
| 5 | "PostGIS geometry type 사용" | geometry = 평면 좌표, 한국에서 5km 오차. **geography type** 이 지구 표면 정확. |
| 6 | "단기 CTR 으로 nearby ranking" | 시즌/캠페인 변동에 흔들림. long-term CTR + Bayesian smoothing (§06) 필수. |
| 7 | "ES geo_distance 가 정확한 거리 보장" | distance_type=sloppy_arc 기본 (빠른 근사, ±0.5%). 정밀 필요하면 arc. |

---

## 10. 꼬리 질문 (§26 면접 카드 후보)

1. **Geohash 의 prefix 매칭 함정은?**
   - 답: 셀 경계 부근에서 Geohash 가 달라도 실제 거리는 가까움. 예: "wydm6" 과 "wydm4" 가 1m 차이일 수 있는데 prefix 다름. 8 인접 셀까지 검색해야 정확. S2/H3 가 이 함정 우회.

2. **H3 가 Uber 에서 산업 표준이 된 이유는?**
   - 답: 6각형 셀의 균일성 — 인접 셀까지 거리가 모두 같음 (사각형은 대각선이 더 멈). ride-sharing/delivery 의 거리 매칭에 직결. 단 6각형은 지구 전체 완벽 채우지 못함 → 12개 5각형 보정.

3. **거리 패널티에 exp 가 아니라 1/distance 쓰면 어떻게 되나?**
   - 답: distance=0 에서 발산. 단위 미정 (1/m? 1/km?). exp(-distance/τ) 는 0~1 범위 + smooth + τ 로 조절 가능. 산업 표준이 된 이유.

4. **숙소 → 액티비티 cross 추천에서 hotel.location 을 어떻게 활용?**
   - 답: 사용자의 "잠재 위치" 로 사용. 사용자가 그 hotel 에 묵으니까 그 근처에 있을 것이라는 추론. score = popularity × exp(-distance(activity, hotel) / τ), τ=2km 정도. 추가로 user 가 안 본 category 우대.

5. **랜드마크 인기도 (lb) 와 일반 인기도 (cb) 의 차이는?**
   - 답: cb 는 도시×카테고리 단위 인기. lb 는 도시×랜드마크 단위 인기. 사용자 검색이 랜드마크 anchored 일 때 (예: "에펠탑 근처 호텔") cb 보다 lb 가 직접 매칭. distance + popularity 결합 공식 사용.

6. **PostGIS 의 geography vs geometry 차이는?**
   - 답: geography — WGS84 좌표계, 지구 표면 (Vincenty/대원거리). geometry — 평면 좌표 (Euclidean). 한국에서 5km 거리 계산 시 geometry 는 평면 가정으로 오차 큼. 지리 데이터는 **geography** 가 정확.

7. **Long-term CTR 보정이 단기 CTR 보다 안정적인 이유는?**
   - 답: 마케팅 캠페인 / 시즌 / 신상품 호기심 같은 단기 노이즈 흡수. 30~90일 평균이 본질적 인기 반영. 단 데이터 적은 신상품은 long-term 도 부족 → Bayesian smoothing (§06) 결합 필수.

---

## 11. cross-ref

| 주제 | 연결된 study |
|---|---|
| BKD-tree (Lucene 공간 인덱스) | #19 §02 (Lucene internals) |
| Hybrid Search (BM25 + dense + geo) | #19 §07 (function_score 의 자연스러운 확장) |
| ANN 인덱스 (HNSW) | Phase 5 §10 (geo + embedding 결합) |
| 행동 가중합 popularity | §05 (geo score 의 popularity 항) |
| Wilson / Bayesian smoothing | §06 (적은 노출 아이템 거리 ranking 보정) |
| Time decay | §05 §4-2 (geo score 의 freshness 항) |
| Cold-start fallback | Phase 7 §17 (geo + popularity + default) |
| msa search 의 ES 인덱스 | search 서비스 (#19 §15) |
| msa CB 구현 | Phase 10 §22 (ClickHouse 의 geo 함수 검토) |
| R-tree (DB 인덱스) | #4 DB 인덱스 (B-tree 확장으로서의 R-tree) |
