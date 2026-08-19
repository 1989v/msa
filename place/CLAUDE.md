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
| GET | `/api/places/attractions/overview-probes?lang=` | public | 개요 negative cache 조회 — 수집기 제외 목록 (ADR-0070) |
| POST | `/api/places/attractions/overview-probes` | ADMIN | 원천이 빈 개요를 준 (contentId, lang) 기록 |

## 시드

`place.seed.enabled=true` + `/seed/{regions,pois}.jsonl` 마운트 시 기동 1회 적재(멱등).
정규화 도구/샘플: `tools/seed/place/`. 소스/라이선스: GeoNames(CC BY 4.0), 상가정보(제한없음).

관광지는 별도 경로 — `place/ingest/`(TourAPI ETL, CronJob) → bulk API. **Attraction 은 POI 와 달리
동기 색인하지 않는다** — search-batch `attractionApiReindexJob` 이 일괄 재색인 (ADR-0065).

`place-ingest` 가 **외부 :443 을 부르는 유일한 place 계열 파드**다 (ADR-0070). 상시 파드인
`place` 에는 egress 를 열지 않는다 — 배치의 외부 접근 때문에 상시 노출면을 늘리지 않기 위해서다.
개요는 건당 1콜이라 매일 KST 04:00 에 언어별 1,000건씩 채우고, 04:30 에 재색인이 돈다.

원천이 빈 개요를 주는 레코드는 `attraction_overview_probes` 로 제외한다. **429·네트워크 실패는
넣지 않는다** — 넣으면 그 레코드가 영영 재시도되지 않는다.

## Docs

- ADR: `docs/adr/ADR-0056-geo-poi-and-product-ingestion.md`, `docs/adr/ADR-0065-k-tour-search.md`, `docs/adr/ADR-0070-attraction-content-enrichment.md`
- Plan: `docs/plans/2026-06-15-product-ingestion-and-geo-poi.md`
