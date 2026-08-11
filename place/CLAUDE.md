# Place Service

행정 지리 계층(대륙→국가→광역→도시)과 POI(음식점/카페/상점 등), **관광지(Attraction)**를
오픈데이터로 적재하고 **geo_distance 근처검색**을 제공하는 서비스 (ADR-0056 Part 2, ADR-0065).

## Modules

| Gradle path | 역할 |
|---|---|
| `:place:domain` | Pure Kotlin 도메인 (Region/Poi, 좌표 불변식, GeoMath haversine) |
| `:place:app` | Spring Boot 앱 (port 8096) — MySQL SSOT + OpenSearch read model |

## Commands

```bash
./gradlew :place:app:build       # 빌드
./gradlew :place:domain:test     # 도메인 테스트
```

## Key Rules

- **MySQL = SSOT, OpenSearch(`poi` 인덱스) = read model.** POI 는 정적 reference data 라 Kafka 없이
  **동기 색인**(저장→index). 색인은 외부 IO 이므로 DB 트랜잭션 밖에서 수행 (transactional-usage.md).
- 지리 계층은 self-FK 단일 `regions` 테이블(level). `geonames_id` 가 멱등 upsert 키.
- 스키마는 **Flyway+validate** 단독 책임. 단일 datasource (warehouse 의 routing 미사용).
- OpenSearch 클라이언트는 ADR-0055 패턴(opensearch-java + HttpClient5) 재사용.

## API

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/places/regions?level=&parentId=` | public | 계층 탐색 |
| GET | `/api/places/nearby?lat&lng&radiusKm&category&keyword` | public | 반경 내 POI 거리순 |
| POST | `/api/places/regions`(+`/bulk`), `/api/places/pois`(+`/bulk`) | ADMIN | 적재 |
| POST | `/api/places/attractions/bulk` | ADMIN | 관광지 멱등 upsert — (contentId, lang) 자연키 (ADR-0065) |
| GET | `/api/places/attractions?lang=&page=&size=` (+`/{id}`) | public | 페이지 조회 — search-batch 재색인 풀스캔용 |

## 시드

`place.seed.enabled=true` + `/seed/{regions,pois}.jsonl` 마운트 시 기동 1회 적재(멱등).
정규화 도구/샘플: `tools/seed/place/`. 소스/라이선스: GeoNames(CC BY 4.0), 상가정보(제한없음).

관광지는 별도 경로 — `tools/seed/tour/`(TourAPI ETL) → bulk API. **Attraction 은 POI 와 달리
동기 색인하지 않는다** — search-batch `attractionApiReindexJob` 이 일괄 재색인 (ADR-0065).

## Docs

- ADR: `docs/adr/ADR-0056-geo-poi-and-product-ingestion.md`
- Plan: `docs/plans/2026-06-15-product-ingestion-and-geo-poi.md`
