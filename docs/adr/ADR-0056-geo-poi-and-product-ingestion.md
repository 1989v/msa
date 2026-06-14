# ADR-0056 오픈데이터 상품 적재 파이프라인 + 신규 place 서비스(지리/POI 근처검색)

## Status

Accepted (2026-06-14)

**Date**: 2026-06-14
**Authors**: kgd
**Related**:
- **ADR-0013** (Inventory SSOT) — product.stock 은 캐시, 적재 시 stock 직접 주입 금지.
- **ADR-0055** (OpenSearch 전환) — products 인덱스/매핑 SSOT, opensearch-java raw 클라이언트 패턴 재사용.
- **ADR-0019** (K8s Migration) — 신규 서비스/Job 매니페스트 구조, Jib arm64, overlay 이원화.
- **ADR-0029** (멱등 컨슈머) — product 이벤트 발행은 commit-after-publish 유지.

**Supersedes / Extends**: 없음 (신규).

---

## Context

포트폴리오 커머스 플랫폼의 상품 데이터가 임시 소수 건뿐이라, **실제 운영급 데이터**로 검색을
서빙하고자 한다. 추가로 **지리정보(대륙/국가/광역/도시 + 좌표 + POI)** 를 오픈데이터로 적재하고
상품-검색과 유사한 **주변 POI 근처검색** 서비스를 연동하려 한다. 운영은 **OCI Ampere A1 free
tier(arm64)** 이므로 footprint 를 가볍게 유지해야 한다.

### 데이터 소스 선정 (라이선스 우선)

쿠팡/네이버 등 크롤링은 robots.txt·ToS 위반 + 저작권법 §93(DB제작자 권리)·정보통신망법 §48·
부정경쟁방지법 카목 리스크로 **배제**(공개 발행되는 포트폴리오는 재배포 노출 재점화). 대신 합법·
재배포 가능한 공개 데이터만 사용한다.

| 도메인 | 소스 | 라이선스 |
|---|---|---|
| 상품(식품) | 식약처 식품(첨가물)품목제조보고 #15064909 | 이용허락범위 제한없음 |
| 상품 가격 | 한국소비자원 참가격 #3043385 | KOGL 제1유형(출처표시) |
| 상품 보강 | Open Food Facts Korea | ODbL (enrichment-only, 원본 미보관) |
| 지리 계층 | GeoNames (cities15000/countryInfo/admin1) | CC BY 4.0 |
| POI | 소상공인 상가정보 #15083033 | 이용허락범위 제한없음 |
| POI(글로벌) | Foursquare OS Places | Apache-2.0 |

회피: OSM/Nominatim/Geofabrik(ODbL share-alike viral), SimpleMaps(유료), Naver 쇼핑 API
(자체 DB 저장/재배포 약관 미확정 — 사용 시 별도 확인 필요, R1).

---

## Decision

### Part 1 — 상품 적재 파이프라인

- **D1** product 카탈로그에 `description`(검색 본문) + `category`(검색 facet) 추가. `brand` 는 기존.
  `description` 은 `ddl-auto=validate` 정합을 위해 VARCHAR(2000)(TEXT 아님). 마이그레이션
  `V20260615_001`.
- **D2** 적재는 **Create API 경유**(DB 직삽입 아님) — `POST /api/products/bulk` 신설(한 트랜잭션 N건
  저장 후 건별 `product.item.created` 발행, commit-after-publish 유지). 그래야 Kafka→search
  consumer→OpenSearch 색인 파이프라인을 실제로 태운다.
- **D3** ETL 은 기존 `search:batch` 모듈 재사용(Kotlin/Jib arm64) — `reindex.source=seed` 일 때
  `ProductSeedIngestTasklet/Job` 활성화, 정규화 JSONL 을 청크 단위 bulk POST.
- **D4** `description`/`category` 를 product 이벤트·search `ProductDocument`/인덱스 매핑(text:nori /
  keyword)·검색 응답까지 전파. 전체 reindex(DB/API) 경로도 보존.
- **D5** 정규화 도구는 `tools/seed/products/`(normalize.py + 샘플 JSONL). 원천 raw 미커밋.

### Part 2 — 신규 `place` 서비스 (지리/POI)

- **D6** **신규 마이크로서비스 `place`** 신설(`place:domain`/`place:app`, port 8096). 서비스 간 DB
  공유 금지 규약 + 별 도메인이므로 search 확장이 아닌 독립 서비스. Clean Architecture.
- **D7** product→search 와 동일 원칙: **MySQL = SSOT, OpenSearch = read model**. 단 POI 는 정적
  reference data(고빈도 트랜잭션 아님)이므로 Kafka 대신 **동기 색인**(저장→OpenSearch index,
  외부 IO 는 DB 트랜잭션 밖). product(고빈도)와 의도적 분기.
- **D8** 지리 계층은 self-FK 단일 `regions` 테이블(level=CONTINENT/COUNTRY/REGION/CITY) +
  `geonames_id` 멱등 키. POI 는 `pois` 테이블 + `poi`(geo_point) 인덱스.
- **D9** 근처검색은 `GET /api/places/nearby` — OpenSearch `geo_distance` 필터 + `_geo_distance`
  정렬, 표시 거리는 haversine. POI 인덱스는 single-node 대비 shard 1/replica 0/refresh 30s + nori.
- **D10** 적재는 **앱 자체 시드**(`PlaceSeedRunner`, `place.seed.enabled=true` + 테이블 빈 경우만,
  멱등). 별도 Kafka/배치 모듈 없이 정적 데이터 적재. regions 는 레벨 순서로 적재하며
  `parentGeonamesId→parentId` 해소.
- **D11** 단일 datasource + **Flyway+validate**(warehouse 의 routing 대신 단순화). OpenSearch
  client 는 ADR-0055 패턴(opensearch-java + HttpClient5) 재사용.
- **D12** gateway `/api/places/**` 라우트(조회 public, 쓰기 ADMIN). 네트워크폴리시는 라벨
  (`part-of=commerce-platform`) 기반이라 place 자동 포함.

---

## Consequences

**긍정**: 합법·재배포 가능한 실제 한국어 데이터로 검색/근처검색을 시연. 기존 이벤트·색인 인프라를
재사용해 신규 표면 최소화. POI 동기 색인으로 OCI Pod 수 억제(별도 consumer 없음).

**부정/리스크**:
- **R1** Naver 쇼핑 API 재배포 약관 미확정 → 기본 파이프라인 제외. 사용 시 약관 확인 필수.
- **R2** OFF ODbL share-alike → category 는 자체 정규화, 원본 미보관. 이미지 hotlink/자체호스팅 회피.
- **R3** OCI free-tier(24GB) — place + ETL Job 추가. place 는 Tier M, ETL 은 one-shot Job. 데이터는
  lean subset(GeoNames cities15000, 상가 시도+업종 필터, POI MVP=서울).
- **R4** `category` vs 기존 search `categoryId` 중복 — `category`(신규 keyword) 채택, `categoryId`
  는 미사용 유지(추후 정리).
- **R5** place 는 `place_db` 스키마 + (k8s)`mysql-place` DNS 필요 — 인프라 provisioning 선행.
- **R6** 가격 정규화: 참가격 join 미구현 시 식약처 품목에 카테고리 기반 합성가 부여(문서화) — 추후
  참가격 fuzzy join 으로 대체.

## 실행 (구현 완료)

플랜: `docs/plans/2026-06-15-product-ingestion-and-geo-poi.md` (Phase 1~4).
