# 지리/POI 오픈데이터 시드 (ADR-0056 Part 2)

`place` 서비스의 행정 지리 계층(regions)과 POI를 오픈데이터로 적재한다.

## 적재 방식 — 앱 자체 시드 (self-seed)

`place` 서비스가 기동 시 `place.seed.enabled=true` 이고 테이블이 비어있으면 마운트된 JSONL을
읽어 적재한다(`PlaceSeedRunner`, 멱등). Kafka/별도 배치 모듈 없이 정적 참조 데이터를 적재하는
가장 가벼운 방식 — POI는 거의 변하지 않는 reference data 이기 때문(상품과 달리 고빈도 트랜잭션 아님).

```
GeoNames / 상가정보  ──normalize_*.py──▶  {regions,pois}.jsonl  ──(ConfigMap/PVC 마운트)──▶  place 기동 시 적재
                                                                          │
                                                          regions → MySQL,  pois → MySQL + OpenSearch(poi 인덱스)
                                                                          ▼
                                              GET /api/places/regions , GET /api/places/nearby (geo_distance)
```

## 데이터 소스 & 라이선스

| 소스 | 제공 | 라이선스 |
|------|------|----------|
| GeoNames (cities15000 / countryInfo / admin1CodesASCII) | 대륙/국가/광역/도시 + 좌표 + 인구 | **CC BY 4.0** (상업/재배포 OK, 출처표시) |
| 소상공인시장진흥공단 상가(상권)정보 (data.go.kr #15083033) | 상호명/업종/위경도/주소 | **이용허락범위 제한없음** (Phase 3) |
| (선택) Foursquare OS Places | 글로벌 POI | Apache-2.0 (Phase 3) |

> 출처표시 예: "이 서비스는 GeoNames(CC BY 4.0) 데이터를 사용합니다."
> OSM/Nominatim/Geofabrik(ODbL share-alike)·SimpleMaps(유료)는 재배포 viral 리스크로 회피.

## 1) 정규화 (로컬)

```bash
# regions — GeoNames (키 불필요). 키 없이 즉시 샘플:
python3 normalize_regions.py --from-sample --out regions.jsonl
# 실제 GeoNames 덤프로 전세계 도시 5000개:
python3 normalize_regions.py --out regions.jsonl --max-cities 5000

# pois — 소상공인 상가정보. 키 없이 즉시 샘플(강남 일대 16종):
python3 normalize_pois.py --from-sample --out pois.jsonl
# data.go.kr 키로 강남구청 반경 2km 음식점(I2):
python3 normalize_pois.py --cx 127.0473 --cy 37.5172 --radius 2000 --inds I2 --out pois.jsonl
```

POI JSONL 한 줄 스키마:
`{source, sourceKey, name, latitude, longitude, categoryMajor?, categoryMid?, categorySub?, roadAddress?, jibunAddress?}`

## 근처검색 (nearby)

적재 후 `place` 가 `poi` OpenSearch 인덱스(geo_point)에 색인하므로 거리순 검색이 가능하다:

```bash
# 강남구청 반경 2km 음식점, 거리 오름차순
curl "http://localhost:8096/api/places/nearby?lat=37.5172&lng=127.0473&radiusKm=2&category=음식"
# 게이트웨이 경유 (public): GET http://<gw>/api/places/nearby?...
```

응답은 `distanceKm`(haversine)로 가까운 순 정렬된다.

regions JSONL 한 줄 스키마:
`{level, name, nameKo?, countryCode?, admin1Code?, geonamesId, parentGeonamesId?, latitude?, longitude?, population?}`
`parentGeonamesId` 는 상위 노드의 `geonamesId` 를 가리키며, 적재 시 자동으로 `parentId` 로 해소된다.

## 2) 적재

로컬:
```bash
PLACE_SEED_ENABLED=true PLACE_SEED_REGIONS_PATH=$(pwd)/regions.jsonl \
  ./gradlew :place:app:bootRun
```

K8s(OCI): regions.jsonl 을 ConfigMap 으로 만들어 `/seed` 에 마운트하고 `PLACE_SEED_ENABLED=true`
(상세 매니페스트는 ADR-0056 Phase 4 / k8s/base/place).

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PLACE_SEED_ENABLED` | `false` | true 일 때만 시드 (테이블 비어있을 때 1회) |
| `PLACE_SEED_REGIONS_PATH` | `/seed/regions.jsonl` | regions 시드 경로 |
| `PLACE_SEED_POIS_PATH` | `/seed/pois.jsonl` | pois 시드 경로 (Phase 3) |
| `PLACE_POI_INDEX` | `poi` | OpenSearch POI 인덱스명 (Phase 3) |
