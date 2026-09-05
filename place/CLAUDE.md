# Place Service

행정 지리 계층(대륙→국가→광역→도시)과 POI(음식점/카페/상점 등), **관광지(Attraction)**를
오픈데이터로 적재하고 **geo_distance 근처검색**을 제공하는 서비스 (ADR-0056 Part 2, ADR-0065).

## Modules

| Gradle path | 역할 |
|---|---|
| `:place:domain` | Pure Kotlin 도메인 (Region/Poi, 좌표 불변식, GeoMath haversine) |
| `:place:app` | Spring Boot 앱 (port 8096) — MySQL SSOT + OpenSearch read model |

## 구조 상태 (ADR-0083)

표준 준수 — UseCase 인터페이스 11 · Port 8 · Adapter 8 · 테스트 있음. 부채 없음.

## Commands

```bash
./gradlew :place:app:build       # 빌드
./gradlew :place:domain:test     # 도메인 테스트
```

## Key Rules

- **MySQL = SSOT, OpenSearch(`poi` 인덱스) = read model.** POI 는 정적 reference data 라 Kafka 없이
  **동기 색인**(저장→index). 색인은 외부 IO 이므로 DB 트랜잭션 밖에서 수행 (transactional-usage.md).
- 지리 계층은 self-FK 단일 `regions` 테이블(level). `geonames_id` 가 멱등 upsert 키.
- **`regions`(GeoNames 지명 계층)과 `admin_regions`(한국 행정구역)은 다른 것이다** (ADR-0071).
  GeoNames 의 KR CITY 296행은 흥해읍·왜관읍이 섞인 지명 덤프이고 `admin2_code` 가 전부 NULL 이라
  시군구 축으로 쓸 수 없다. 한국 행정구역은 법정동 코드로 따로 세운다.
- **원천 분류는 원본 그대로 컬럼에 남기고, 화면용 `category` 는 파생으로 계산한다**
  (`lcls_systm1~3`/`cat1~3` → `category`). 그루핑 규칙이 바뀌면 UPDATE 한 번이면 된다 —
  실제로 517건을 원천 재호출 0회로 고쳤다 (`docs/architecture/data-sources.md` §0).
- **분류 우선순위는 "좁게 말하는 쪽이 이긴다"** — 신/구 체계 중 어느 쪽인지로 정하지 않는다.
  신 체계를 통째로 앞세우면 캠핑장이 `AC`(숙박)로 가 목록에서 사라지고, 구 체계를 통째로
  앞세우면 온천·스파(`EX05`)가 `A0202`(자연)로 간다. 순서는 **소분류 → 중분류 → 구 중분류 →
  구 대분류 → 신 대분류**. `sync_tour.categorize` 와 smoke_test 에 고정돼 있다.
- 관광지의 지역 축은 `ldong_regn_cd`/`ldong_signgu_cd` 다. 기존 `area_code`/`sigungu_code` 는
  두 코드 체계가 섞여 있어(법정동 25,030행 + TourAPI 구코드 19,874행) **필터 축으로 쓰지 않는다.**
- 스키마는 **Flyway+validate** 단독 책임. 단일 datasource (warehouse 의 routing 미사용).
- OpenSearch 클라이언트는 ADR-0055 패턴(opensearch-java + HttpClient5) 재사용.

### ★ TourAPI — 두 가지가 조용히 데이터를 망가뜨린다

**1. 구 코드(areaCode·cat1)를 기준으로 잡지 마라 — 폐기 중인 축이다**

`areaBasedList2` 를 **areaCode 없이** 부르면 응답의 `areacode`·`cat1~3` 이 100% 빈 문자열로 온다
(2026-08 실측). 지역을 지정하면 채워지는데, 그러면 **areaCode 자체가 없는 레코드 43%**
(12,639 중 5,484)를 통째로 놓친다. 발급 화면상 `areaCode2`·`categoryCode2` 는
**"미사용 (삭제예정 — 법정동/분류체계 코드로 대체)"** 이고, 신체계(`lclsSystm1~3`, `lDongRegnCd`)가
원본, 구 코드가 파생이다.

- 무지정 페이징으로 전량을 받고 **신체계에서 구 코드를 역산**한다 —
  `sync_tour.py` 의 `LDONG_TO_AREA` · `LCLS1_MAP` 이 그 맵이고, 값은 추측이 아니라
  지역별 조회의 **최빈값 실측**이다. lDong `12` 는 광주·전남 통합이라 모호(전남으로 둠)
- 일일 한도 1,000회는 **계정이 아니라 오퍼레이션별**이다 — 목록 수집은 여유롭고 개요만 병목이다

**2. `POST /api/places/attractions/bulk` 은 전체 동기화다 — 부분 레코드는 나머지를 지운다**

`Attraction.syncFrom` 이라 **보내지 않은 필드는 유지가 아니라 null 로 덮인다.**
예외는 개요 하나뿐(`overview = source.overview ?: overview` — 목록 재동기화가 며칠치 수집을
날리던 걸 막으려 2026-08-17 추가).

- 실측 사고: 검증용으로 `{contentId, lang, title, lat, lng}` 만 보냈다가 **경복궁 행의
  주소·이미지·분류·지역코드를 실제로 날렸다** (`detailCommon2` 로 복구).
  **개요만 예외라서 "개요가 남았으니 안전하다"는 착각을 하기 쉽다**
- upsert 할 때는 **항상 전체 레코드**를 보낸다. 한 필드만 고치고 싶으면 place API 로 현재
  레코드를 읽어 그 위에 덮어써서 보낸다(`backfill_overview.py` 의 `UPSERT_FIELDS` 방식).
  **운영 데이터로 실험하지 않는다** — 꼭 해야 하면 살아있는 레코드에서 페이로드를 만든다


## API

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/places/regions?level=&parentId=` | public | 계층 탐색 |
| GET | `/api/places/admin-regions?level=&parent=` | public | **한국 행정구역**(법정동 코드) 시도/시군구 (ADR-0071) |
| POST | `/api/places/admin-regions/bulk` | ADMIN | 법정동코드 자료 적재 |
| GET | `/api/places/nearby?lat&lng&radiusKm&category&keyword` | public | 반경 내 POI 거리순 |
| POST | `/api/places/regions`(+`/bulk`), `/api/places/pois`(+`/bulk`) | ADMIN | 적재 |
| POST | `/api/places/attractions/bulk` | ADMIN | 관광지 멱등 upsert — (contentId, lang) 자연키 (ADR-0065) |
| GET | `/api/places/attractions?lang=&page=&size=` (+`/{id}`) | public | 페이지 조회 — search-batch 재색인 풀스캔용 |
| GET | `/api/places/attractions/{id}/links` | public | 관광지 외부 링크 — 수집형(유튜브) + 조립 딥링크 (ADR-0070) |
| GET/POST | `/internal/attractions/links/**` | 클러스터 내부 | 수집 큐 조회 / 결과 적재 — 게이트웨이가 라우팅하지 않는다 |
| GET/POST | `/internal/attractions/google-place-ids/**` | 클러스터 내부 | 구글 place_id 미보강분 조회 / 반영 (data-sources.md §7, ID-only 무과금 SKU) |
| GET | `/api/places/attractions/overview-probes?lang=` | public | 개요 negative cache 조회 — 수집기 제외 목록 (ADR-0070) |
| POST | `/api/places/attractions/overview-probes` | ADMIN | 원천이 빈 개요를 준 (contentId, lang) 기록 |

## 이용정보 (detailIntro2)

이용시간·쉬는날·요금·주차·문의처. **건당 1콜**이라 개요와 같은 방식으로 매일(KST 05:00)
하루치씩 채운다 — 한도가 (서비스 × 오퍼레이션)별로 따로라 개요와 예산을 나눠 쓰지 않는다.

**전 유형·전 레코드를 국문·영문 모두 받는다.** 원천이 주는 필드는 유형마다 다르고
**같은 개념의 키 이름도 다르다**(`usetime` / `usetimeculture` / `usetimeleports`).
그래서 응답을 통째로 `intro_raw` 에 남기고 화면용은 파생 컬럼으로 내린다 —
파생 규칙이 바뀌어도 원천을 다시 부르지 않는다.

**요금은 유형에 따라 원천에 아예 없다** — 관광지(12)·레포츠(28)에는 `usefee` 가 없고
문화시설(14) 등에만 있다. 없는 것을 채워 넣지 말고 그 줄을 안 그린다.

수집 여부는 값이 아니라 `intro_synced_at` 으로 판정한다. 값으로 재면 원천이 빈 응답을 준
레코드를 매일 다시 부르게 된다.

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
