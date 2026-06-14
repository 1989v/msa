# Plan — 상품 오픈데이터 적재 + 지리/POI 근처검색 (ADR-0056)

대상: 실제 운영급 상품 데이터로 검색 서빙 + 신규 `place` 서비스(지리 계층 + POI 근처검색). 운영 OCI.

## Phase 1 — 상품 enrichment + ETL (search 활용: 제목/카테고리/설명/가격)

- **1a** product 도메인/JpaEntity/이벤트/DTO/UseCase 에 `description`,`category` 전파 + `brand` create 경로 개방.
  `V20260615_001` 마이그레이션. `POST /api/products/bulk` 신설. ✅ `46531ac`
- **1b** search `products` 인덱스에 `description`(text/nori)·`category`(keyword) 추가, 이벤트→consumer→
  ProductDocument→인덱스→검색응답 전파, 전체 reindex(DB/API) 경로 보존. ✅ `0f80fdd`
- **1c** `reindex.source=seed` ETL — `ProductSeedIngestTasklet/Job` 이 정규화 JSONL 을 bulk Create API 로
  적재(→Kafka→OpenSearch). `tools/seed/products`(normalize.py + 샘플 + README). ✅ `17e9a21`

## Phase 2 — place 서비스 + 행정 지리 계층(regions)

- 신규 `place:domain`/`place:app`(port 8096), 단일 datasource + Flyway+validate.
- `V1` regions(self-FK, geonames_id 멱등), Region 도메인/repo/usecase/service, `GET/POST /api/places/regions(+bulk)`.
- `PlaceSeedRunner`(place.seed.enabled): GeoNames JSONL 을 레벨순 적재(parentGeonamesId→parentId 해소).
- 빌드/배포 wiring(settings/jib/gateway/k8s base), `tools/seed/place`(normalize_regions.py + 샘플). ✅ `5d26554`

## Phase 3 — POI + 근처검색

- `V2` pois, Poi 도메인/repo, OpenSearch(`poi` geo_point 인덱스, client config, PoiIndexAdapter/PoiSearchAdapter).
- `GET /api/places/nearby`(geo_distance + _geo_distance 정렬, haversine 거리), `POST /api/places/pois(+bulk)`.
- PoiIndexInitializer(@Order1 best-effort) + PlaceSeedRunner POI 확장(@Order2, 동기 색인).
- `tools/seed/place`(normalize_pois.py 상가정보 반경조회 + 샘플 16종). ✅ `c55edd0`

## Phase 4 — OCI 배포

- `k8s/base/search-batch/job-product-seed.yaml`(one-shot Job, product-seed ConfigMap, 수동 apply).
- `place` Deployment 에 optional `place-seed` ConfigMap 볼륨 + PLACE_SEED_ENABLED(기본 false).
- 네트워크폴리시는 라벨 기반이라 place 자동 포함. 이 ADR/plan/place CLAUDE.md.

## 적재 운영 (요약)

```bash
# 상품
python3 tools/seed/products/normalize.py --from-sample --out products.jsonl
kubectl create configmap product-seed -n commerce --from-file=products.jsonl
kubectl apply -f k8s/base/search-batch/job-product-seed.yaml

# 지리/POI
python3 tools/seed/place/normalize_regions.py --from-sample --out regions.jsonl
python3 tools/seed/place/normalize_pois.py --from-sample --out pois.jsonl
kubectl create configmap place-seed -n commerce \
  --from-file=regions.jsonl --from-file=pois.jsonl
kubectl set env deploy/place -n commerce PLACE_SEED_ENABLED=true   # 1회 적재(멱등)
```

## 미해결 (ADR-0056 R1~R6)

Naver 약관(R1), OFF share-alike(R2), free-tier 메모리(R3), category/categoryId 정리(R4),
place_db/mysql-place provisioning(R5), 참가격 가격 join(R6).
