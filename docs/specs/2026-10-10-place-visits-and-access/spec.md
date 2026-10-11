<!-- source: place/ingest/src/visitors.py, place/ingest/src/congestion.py, place/ingest/src/related.py, analytics/app/src/main/resources/clickhouse/analytics/V007__attraction_unique_clickers.sql, wishlist/feature/src/main/kotlin/com/kgd/wishlist/presentation/wishlist/controller/WishlistController.kt, search/batch/src/main/resources/opensearch/attractions-index.json, portal-fe/src/pages/place/AttractionPage.tsx, portal-fe/src/pages/place/RegionPage.tsx, portal-fe/src/pages/place/placeAttributes.ts -->
# Specification: place 방문 근거 표시 + 가는 법 (S4-3 · S4-4)

> 2026-10-10. 계획 `docs/plans/2026-10-08-place-growth-work-plan.md` S4-3 · S4-4, 이어받기 `docs/plans/2026-10-10-place-inflow-execution-handoff.md` H5.
> 조사 결과 두 가지가 계획의 전제를 바꾼다. ① **집중률은 관광지끼리 비교할 수 없다** — 원천 정의가 「각 관광지에서 가장 붐비는 시기를 100으로 본 상대 수치」다(data.go.kr 15128555). 집중률로 관광지 순위를 만들면 틀린 추천이 된다. ② **관광지 단위 방문자 수를 주는 공개 API 는 지금 키로 찾지 못했다.** 관광공사 방문자 수(`DataLabService`)는 시군구·시도 단위다. 그래서 「방문량 기반 추천」의 지금 판은 **지역(시군구) 단위**이고, 관광지 단위는 원천 확인 뒤(Q1)로 미룬다.

## Goal
place 화면에서 「사람이 몰린다」는 신호를 근거별로 따로 보인다 — 관광공사 방문자 수(시군구 단위 실적) · 이 사이트 회원의 찜 수 · 이 사이트 이용자의 클릭 수. 셋을 섞어 한 점수로 만들지 않고, 각각 원천·대상·기간을 붙인다. 관광지 상세에는 가장 가까운 도시철도역·버스정류장과 **직선거리**를 미리 계산해 「가는 법」으로 낸다. 사용자 요청 경로에는 외부 호출이 없다.

## 이미 있는 것 (2026-10-10 코드 확인)
| 데이터 | 단위 | 적재·서빙 | 화면 |
|---|---|---|---|
| 지역 방문자 수 `DataLabService` | 시군구·시도 × 일 × 현지인/외지인/외국인, 공개 지연 30일 | `--job=visitors` → `region_visitor_daily` → `GET /api/places/administrative-regions/{code}/visitors`(레디스) | 지역 페이지 `RegionVisitorTrend` |
| 집중률 예측 `TatsCnctrRateService` | 관광지 × 앞 30일, **관광지 자신의 최대=100** | `--job=congestion` → V28 → 색인 `congestion`(색인 안 함) | 상세 `AttractionCongestion` |
| 연관 관광지 `TarRlteTarService1` | 출발 관광지 × 대상(순위만, 수치 없음), 월 | `--job=related` → V29 → 색인 `relatedPlaces` | 상세 「여기 온 사람들이 함께 간 곳」 |
| 클릭 고유 이용자 `uniqueClickers14d` | 관광지 × 최근 14일, `anonymous` 제외 | analytics `attraction_popularity_daily` → 재색인 → 색인(integer, `index:false`) | 상세 배지 「많이 클릭한 곳」(≥5) |
| 찜 수 | 대상별 | `GET /api/v1/wishlist/count?type=&key=`(공개) | 게임 상세만 사용 |
| 역·정류장 | — | 없음 | 없음 |

## 원천 조사 (2026-10-10, 공개 문서만 읽음 — 키 발급·가입·다운로드 안 함)
### 방문량
| 후보 | 단위 | 지금 키(`TOUR_API_KEY`)로 | 라이선스 | 판정 |
|---|---|---|---|---|
| 관광공사 빅데이터 `DataLabService` 지역 방문자(15101972) | 시군구·시도 일별 실적(이동통신) | **된다 — 이미 적재 중** | 이용허락범위 제한 없음 | **지금 판의 근거** |
| 관광지 집중률 예측(15128555) | 관광지, 자기 최대=100 | 된다 — 적재 중 | 제한 없음 | 관광지 간 순위에 **쓰지 않는다**(정의상 비교 불가) |
| 연관 관광지(`TarRlteTarService1`) | 출발별 순위 50, 수치 없음 | 된다 — 적재 중 | 제한 없음 | 방문량이 아니다. 「함께 간 곳」 그대로 둔다 |
| 관광공사 지역별 관광 수요 강도(15151868) | 지역 지수(체류·소비 강도) | 별도 활용신청(개발 자동승인) | 제한 없음 | 지수라 「방문량」 이름에 안 맞음. 후순위(Q2) |
| 한국관광 데이터랩 관광지별 내비게이션 검색 건수(T맵) | 관광지 | 공개 API 미확인 — 데이터랩 화면·지자체 파일(예: 나주시 15144170, 연 1회)로만 확인 | 지자체 파일은 제한 없음, 데이터랩 이용 조건 미확인 | 관광지 단위의 유일한 후보. **사용자 확인 필요(Q1)** |

### 역·정류장
| 후보 | 범위 | 받는 법 | 라이선스 | 판정 |
|---|---|---|---|---|
| 전국도시철도역사정보표준데이터(15013205, 국가철도공단) | 도시·광역철도 역 1,073행(2024-12-31 기준), 역명·영문역명·노선·위경도·주소 | 파일(XLSX), 연 1회(다음 2026-12-20 예정), 키 불필요 | 이용허락범위 제한 없음 | **채택** |
| 국토교통부 전국 버스정류장 위치정보(15067528) | 약 20.6만 행, 정류장번호·이름·위경도(WGS84)·수집일·도시코드·도시명·관리도시명 | 파일(CSV) 로그인 없이 받는다고 표기 · OpenAPI 는 활용신청, 연 1회(다음 2026-10-30) | 이용허락범위 제한 없음 | **채택(파일)**. BIS 연계 지자체만 담긴다 — 빠진 군이 있다 |
| 일반철도(KTX·무궁화) 역 좌표 | — | 공개 파일 미확인 | — | 이번 범위 밖(Q4) |

## Specific Requirements

### 지금 할 수 있는 범위 (키·신청 불필요)

### SR-1 방문 근거는 근거마다 따로, 이름은 근거를 말한다
1. 근거 셋: `KTO_REGION_VISITORS`(관광공사 시군구 방문자 수) · `SITE_SAVES`(이 사이트 찜 수) · `SITE_CLICKS`(이 사이트 14일 클릭 고유 이용자). 셋을 합친 점수·순위를 만들지 않는다.
2. 금지 이름: 「많이 본 곳」「인기」「핫플」. 「방문자」라는 말은 `KTO_REGION_VISITORS` 에만 쓴다 — 사이트 클릭은 방문이 아니다. 이 사이트에서 행동한 사람은 「이용자」(영문 「people on this site」)로 부르고 「방문자/visitors」를 쓰지 않는다. 코드 식별자(`visitor_id`·`uniqueClickers14d`)는 바꾸지 않는다.
3. 근거 줄 형식(국문): 「{원천} · {대상} · {기간}」. 예: 「한국관광공사 빅데이터(이동통신) · 해운대구 전체 · 2026년 8월」, 「이 사이트 회원 찜 · 이 관광지 · 누적」, 「이 사이트 이용자 클릭(같은 사람은 한 번) · 이 관광지 · 최근 14일」. 영문도 같은 세 칸.
4. 문구·하한·이름은 `portal-fe/src/pages/place/visitSignals.ts` 한 곳에 둔다. 서버 렌더(`AttractionPageRenderer`)는 같은 하한을 search 도메인 상수로 갖고, 두 값이 같은지 보는 테스트를 **새로 만든다** — 지금 `FREQUENTLY_CLICKED_MIN` ↔ `AttractionClickSignal.MIN_SAMPLE` 은 주석으로만 묶여 있고 대조하는 테스트가 없다. FE 테스트가 Kotlin 상수 파일을 읽어 `const val (SAVED_MIN|MIN_SAMPLE) = (\d+)` 를 뽑고, 0건이면 실패한다. `FREQUENTLY_CLICKED_MIN` 은 `visitSignals.ts` 로 옮기고 `placeAttributes.ts` 는 다시 내보내기만 한다(사본 금지). 서버 렌더 근거 줄 문구는 FE 와 골든 픽스처로 대조한다(`AttractionJsonLdParityTest` 방식).
5. 용어(place 용어집이 생기기 전까지 여기가 원본): 방문자 = 관광공사 이동통신 추정 인원(`KTO_REGION_VISITORS`) · 타지 방문자 = 외지인+외국인 · 다 받은 달 = 시도 안 모든 시군구가 그 달의 모든 날을 받은 달 · 이용자 = 이 사이트에서 행동한 사람 · 찜 = wishlist 항목(코드 이름 `savedCount`·`SITE_SAVES` 의 「saved」는 찜을 뜻한다) · 근거 줄 = 원천·대상·기간을 밝히는 출처 문장(배지 줄의 「많이 클릭한 곳」 배지와 다르다 — 배지는 그대로 둔다) · 직선거리 = 두 좌표 사이 하버사인 거리.

### SR-2 관광공사 방문자 수 — 시도 페이지의 「타지 방문자가 많은 시군구」
1. 시도 지역 페이지에 시군구 순위 절을 더한다. 값 = 마지막 **다 받은 달**의 `외지인 + 외국인` 합(현지인 제외 — 생활 이동이 섞여 관광 신호가 아니다). 다 받은 달은 **시도 안 모든 시군구**가 그 달의 모든 날을 받은 달이다(시군구마다 따로 판정하지 않는다). 다 받은 달이 없거나 시군구가 3개 미만인 시도(세종·제주)는 절을 숨긴다. 외지인 산정에 통근·통학이 포함되는지 원천 정의를 `data-sources.md` 방문자 절에 인용하고, 포함이면 근거 줄 끝에 「통근 포함」을 붙인다(TG0.7).
2. API: `GET /api/places/administrative-regions/{sidoCode}/visitor-ranking` → `{ month, items:[{code, name, nameEn, outsiders, foreigners, total}] }`, 레디스 `placeRegionVisitorRanking::{sido}`(TTL 26시간). 방문자 PUT 때 받은 시도의 키를 다시 만든다(write-through, 지금 `placeRegionVisitors` 와 같은 자리). 캐시 이름 `RegionCaches.VISITOR_RANKING` 을 `RegionCacheConfig` 에 직렬화기·TTL 과 함께 등록한다(등록하지 않은 이름은 막힌다). write-through 는 `RegionVisitorSyncService` 가 다른 빈의 `@CachePut` 을 불러 프록시를 탄다. `sidoCode` 는 존재하는 2자리 시도 코드가 아니면 400 이고 캐시하지 않는다. 캐시가 비었으면 조회 때 계산한다(`@Cacheable`).
3. 화면: 상위 10, 각 행은 시군구 지역 페이지 링크 · 수치(명, 소수 버림). 절 제목 「타지 방문자가 많은 시군구」, 근거 줄 「한국관광공사 빅데이터(이동통신 추정) · {시도} 시군구 · {YYYY년 M월} · 외지인+외국인」. 원천 수치는 추정치라 「약」을 붙인다.
4. 시군구 상세 페이지·관광지 상세에는 순위를 내지 않는다. 관광지 상세에는 시군구 방문자 수를 내지 않고 링크 한 줄만 둔다: 「{시군구} 방문 추이 보기」(영문 「Visitor trend in {sigungu}」) → 시군구 지역 페이지. 같은 숫자를 시군구 안 관광지 전부에 붙이지 않기 위해서다.
5. 광주·전남 통합(12) 전 옛 코드(29·46) 행은 순위에 넣지 않는다 — 지금 허브와 같은 기준.

### SR-3 「많이 찜한 곳」 — 찜 수
1. wishlist 에 내부 집계 `GET /internal/wishlist/target-counts?type=ATTRACTION&min={n}` → `[{targetKey, count}]`(count ≥ min 만). 회원 id·시각은 내지 않는다.
2. 재색인(`AttractionApiReindexTasklet`)이 이 값을 한 번 받아 색인 `savedCount`(integer, `index:false`, doc_values 로 정렬)에 싣는다. 실패하면 필드를 비운 채 재색인을 계속한다(찜이 없어도 상세는 성립) — 실패를 로그·Job 요약에 남긴다. `savedCount` 는 **언어 문서 id 단위**로 센다 — 국·영 찜을 합치지 않는다(합치려면 `alternateId` 가 필요한데 기본값이 꺼져 있다). 근거 줄의 대상 「이 관광지」는 이 문서를 뜻한다. 값이 지나는 경로: 쓰기 `AttractionIndexDocument` → 읽기 `AttractionSearchDocument` → `SearchAttractionUseCase` 결과 → `SearchAttractionService` 매핑 → `AttractionPageRenderer` → FE `placeApi.ts`. `searchReadRequired["attractions"]` 에 `savedCount`·`signalsAsOf` 를 넣는다.
3. 하한 `SAVED_MIN = 3`. 미만은 색인에 싣지 않는다. 이 하한은 **표시 정책**이다 — 적은 수는 신호가 아니라서 둔다. 개인정보 통제가 아니다: 공개 `GET /api/v1/wishlist/count` 가 로그인 없이 어떤 대상이든 정확한 수를 낸다(이번 범위에서 좁히지 않는다).
4. 시군구 지역 페이지 절 「많이 찜한 곳」: 같은 시군구·관광 분류(`SIGHT_CATEGORIES`) 안에서 `savedCount` 내림차순 상위 6. 응답(이미 하한 이상만 담긴다)이 3건 미만이면 절을 숨긴다. 근거 줄 「이 사이트 회원 찜 · {시군구} 관광지 · 누적 · 3명 이상만」.
5. 상세: `savedCount` 가 있으면 근거 줄 「이 사이트 회원 N명이 찜했습니다」. 기준 시각은 색인 `signalsAsOf`(date, `index:false`, 재색인 날짜)를 읽어 「{YYYY-MM-DD} 기준」으로 붙인다.
6. 검색 API `sort` 에 `saved`·`clicked` 를 더한다. 이 정렬은 하한을 함께 건다 — `saved` 는 `savedCount ≥ SAVED_MIN`, `clicked` 는 `uniqueClickers14d ≥ FREQUENTLY_CLICKED_MIN` 인 문서만 돌려준다(하한 미만·값 없는 문서는 응답에 없다). 두 정렬은 벡터 레그를 끈다(`resolveEmbedding` 조건에 추가) — 하이브리드 경로에는 정렬을 걸 수 없다.
7. 네트워크 정책: `search-batch → account(wishlist)` 허용 한 줄(`04-allow-backend-to-backend.yaml`, 선례 `allow-search-batch-to-place`). 정책 `allow-search-batch-to-account` 에 `metadata.annotations: kgd.io/host-of: wishlist` 를 달고 `podSelector` 는 `app.kubernetes.io/name: account`, 파일 머리 허용 쌍 목록에 한 줄. 게이트웨이 `/internal` 차단은 기존 `GatewayRouteAuthSpec`(「클러스터 안 전용 경로 /internal」)이 이미 확인한다 — 새 테스트 없음. 내부 집계는 `min` 을 서버에서 `max(min, 1)` 로 막고 기본값은 `SAVED_MIN`, 응답 상한 10,000건.

### SR-4 이 사이트 클릭 — 기존 값을 근거와 함께
1. 새 수집 없음. `uniqueClickers14d`(≥5)를 상세 근거 줄 「최근 14일 이 사이트에서 N명이 눌렀습니다(같은 사람은 한 번)」로 낸다. 기존 배지 「많이 클릭한 곳」은 그대로 둔다.
2. 시군구 지역 페이지 절 「이 사이트에서 많이 누른 곳」: `sort=clicked`(새 값) 상위 6, 응답(이미 하한 이상만 담긴다)이 3건 미만이면 절을 숨긴다. `visitor_id` 가 클라이언트 값이라 조작을 막지 못한다 — 근거 줄의 「기준 보기」 안에 적는다.

### SR-5 가는 법 — 역·정류장 원천 적재 (3규칙)
1. 새 잡 `place/ingest --job=transit-stops`(CronJob 주 1회, 월 KST 00:00). 원천 둘: 도시철도 역사 XLSX, 버스정류장 CSV. 파일 주소는 env(`TRANSIT_RAIL_FILE_URL`·`TRANSIT_BUS_FILE_URL`)로 받는다 — 원천 파일 주소가 갱신마다 바뀌면 env 만 고친다(Q3).
2. 원천 필드 **전부** 컬럼으로 적재(① 지금 안 쓰는 영문·중문 역명·전화·관리기관 포함). 파생은 별도 컬럼(② `lat_value`·`lng_value` 검증값, `valid_coord`). 받은 원천(철도/버스)의 행을 자료 기준일로 통째로 교체하고(③ 전체 동기화 — 필드 목록을 한 곳에서 관리), 받기 실패·0행이면 이전 행을 지우지 않고 Job 을 실패시킨다. 다음도 실패로 친다(이전 행 보존): 헤더 집합이 원천별 `EXPECTED_COLUMNS`(TG0.1 원문)와 다름(빠짐·늘어남 모두) · 무효 좌표 비율 5% 초과 · 행 수가 이전 활성 회차보다 ±20% 넘게 변함. 받기는 `https` 만, 시간 제한 300초, 최대 바이트 = TG0 실측 크기 × 3.
3. 좌표 검사: 위도 33–39 · 경도 124–132 밖이거나 둘이 바뀐 것으로 보이면 `valid_coord=false` 로 저장하고 계산에서 뺀다. 버스 원천은 WGS84 표기, 철도는 미확인(Q5) — 운영 관광지 좌표와 같은 지점 표본 대조를 먼저 한다(TG0).
4. 저장(place, 다음 Flyway 번호): `transit_rail_station`(원천 전 컬럼 + 파생) · `transit_bus_stop`(원천 전 컬럼 + 파생) · `attraction_access`(attraction_id, kind `RAIL|BUS`, 원천 자연 키 — 철도 역사 코드 · 버스 `도시코드+정류장번호`, 그 시점의 이름·영문 이름·노선 사본, `distance_m`, rank, 원천 기준일, 계산 회차 `computed_at`). 대리 키 참조·FK 를 두지 않는다 — extras 조회에 조인이 없고, 원천 교체와 계산 사이에도 결과가 일관된다. Flyway 는 V35. 원천 교체는 회차 단위다: 적재 회차 id 로 새 행을 2,000행 묶음으로 쌓고, 전부 성공하면 활성화 호출 한 번으로 활성 회차를 바꾼 뒤 옛 회차를 지운다. 중간 묶음이 실패하면 활성 회차가 그대로다. access PUT 은 `rank ∈ {1,2}`, `distance_m ≤ 종류별 상한`(역 2,000·정류장 500)을 검증해 어긋나면 400. 규칙의 원본은 ingest 상수다.
5. 대장: `docs/architecture/data-sources.md` §1 표 두 행 + 본문 절(원천·라이선스·받는 법·기준일·빠진 범위·좌표 검사). 화면 출처 「국가철도공단 도시철도 역사정보(기준일)」「국토교통부 전국 버스정류장 위치정보(수집일)」. 둘 다 이용허락범위 제한 없음이지만 출처를 단다.

### SR-6 가는 법 — 사전 계산
1. 계산 위치: 같은 잡이 적재 직후 수행(순수 함수 `nearest_stops(attractions, stops, kind)`). 관광지 좌표는 `place_client.fetch_attractions()`(`/api/places/attractions` 페이지 조회)로 읽는다. 좌표로 가까운 원천 지점을 붙이는 선례는 대기 측정소 후보(`air_station_sigungu`)다. 격자(0.02°) 버킷으로 후보를 좁히되 이웃 칸 수는 `ceil(반경 / 그 위도의 칸 폭)` 으로 계산한다(역 2,000m 는 경도 방향에서 3×3 밖으로 나간다). 거리는 하버사인. 메모리: 관광지는 ACTIVE 의 `(id, lat, lng)` 만 남기고, 정류장 원천 전 컬럼은 적재 묶음을 보낸 뒤 놓고 계산용 튜플만 둔다.
2. 기준: 역은 직선 2,000m 안 가까운 순 2곳, 정류장은 500m 안 2곳. 같은 이름 정류장(길 건너 쌍)은 가까운 하나만. 범위 안에 없으면 행을 만들지 않는다. 같은 역의 노선별 행은 역명(+200m 안)으로 묶어 한 역으로 세고 노선을 「1·4호선」처럼 합친다.
3. 결과는 회차 단위로 교체한다(`PUT /internal/attractions/access`). 계산한 ACTIVE 관광지는 빈 목록까지 전부 보내고, 이번 회차에 실리지 않은 관광지(비활성·삭제 포함)의 행은 회차 끝에 `computed_at` 기준으로 지운다. 새 관광지는 다음 주 회차에 붙는다(Q6 — 매일로 당길지).
4. 재색인이 extras 조회로 `access`(색인 안 하는 객체: kind·이름·영문 이름·노선·distanceM·기준일)를 싣는다. `searchReadRequired["attractions"]` 에 `access` 를 넣고, SR-3.2 와 같은 경로(읽기 문서 → UseCase 결과 → 서비스 매핑 → 렌더러 → `placeApi.ts`)를 지난다.

### SR-7 가는 법 — 화면
1. 상세 「가까운 역·정류장」 절(지도·길찾기 단추 옆, 첫 행동은 구글 지도 대중교통 길찾기 링크): 「{역명}역 ({노선}) · 직선거리 {N}m」 형식 — 원천 역명이 「역」으로 끝나면 붙이지 않는다. 관광지 시군구가 버스 원천의 연계 지역 밖이면 버스 칸에 「이 지역은 버스정류장 위치 자료가 없습니다」(영문 「No bus stop data for this area」)를 낸다. 연계 판정 방법은 TG0 에서 정한다, 1km 이상은 「{x.x}km」. 정류장도 같은 형식. 항목이 없으면 절을 숨긴다.
2. 모든 거리 앞에 「직선거리」를 쓴다. **도보 시간은 계산하지 않는다** — 길 경로 자료가 없어 직선거리로 시간을 내면 근거가 없다. 대신 기존 구글 지도 길찾기 링크(대중교통 모드)를 같은 절에 둔다.
3. 절 아래 「직선거리이며 실제 걷는 길은 더 깁니다 · 자료 기준일 {날짜}」와 출처 줄.
4. 영문: 역은 영문 역명, 정류장은 원천 국문 이름 그대로 + 「Bus stop」(Q7).
5. 서버 렌더 본문(`AttractionPageRenderer`)에도 같은 목록을 싣는다 — 상세의 고유 블록(I3-4).

### 사용자 신청·확인 뒤 범위
### SR-8 관광지 단위 방문량 (Q1 승인 뒤)
1. 원천이 확인되면(데이터랩 관광지별 내비게이션 검색 건수 또는 같은 급의 관광지 단위 실적) 같은 잡 구조로 적재하고, 시군구 지역 페이지에 「관광공사 {지표명} 상위」 절을 더한다. 근거 줄은 SR-1.3 형식, 「검색 건수」면 이름도 「내비게이션 검색이 많은 곳」이다(방문자 수라고 부르지 않는다).
2. 원천 확인 전에는 연관·집중률로 대신 만들지 않는다.

### SR-9 수요 강도·일반철도 (Q2 · Q4)
1. 수요 강도(15151868)는 활용신청 뒤 시도 페이지 보조 지표로만 검토. 일반철도 역은 공개 좌표 원천을 찾으면 SR-5 와 같은 표로.

## 무료 티어·운영 제약
- 외부 호출은 CronJob 만: `transit-stops` 주 1회, 파일 2개(UTC 일 15:00 = 월 KST 00:00 — 다른 place-ingest 전량 스캔과 겹치지 않는 자리, `concurrencyPolicy: Forbid`). 방문자 수는 기존 잡(하루 2콜) 그대로. 사용자 요청 경로는 place·search·레디스만 읽는다.
- 저장 증가: 버스 약 20.6만 행 + 역 1,073 + `attraction_access` 최대 관광지 수 × 4 — 수십 MB 수준. 잡 메모리는 TG0 실측으로 정한다(파이썬 객체 20만 개 기준 추정 100MB 안팎).
- 재색인 시간 증가: wishlist 집계 1콜 + extras 의 access 조인. 재색인 전후 소요를 기록한다.
- wishlist 집계는 `(target_type, target_key)` 인덱스 없이 전체를 훑는다 — 하루 1콜이라 지금은 둔다. TG0.5 에서 행 수를 적고 수십만 행을 넘으면 인덱스 마이그레이션을 검토한다.

## 범위 밖
- 「가봤다」(방문 이력) — 계획대로 별도 설계. 세 근거를 합친 추천 점수. 도보·대중교통 소요 시간 계산. 실시간 버스 도착(외부 호출이 요청 경로에 들어간다).

## 검증
- 근거 줄: 상세·시도·시군구 페이지에서 세 근거가 각각 원천·대상·기간을 갖고 나오는지 CDP 로 DOM 텍스트를 읽는다(국·영, 모바일·데스크톱).
- 집중률을 순위에 쓰지 않는다: `visitSignals.ts`·서버 렌더 어디에도 `congestion` 정렬이 없음을 grep 게이트로.
- 직선거리: 표본 관광지 10곳(서울 도심·부산·제주·군 지역)의 계산값을 지도 도구로 잰 직선거리와 ±30m 로 대조해 `verifications/` 에 남긴다.
- 하한: `SAVED_MIN`·`SITE_CLICKS` 하한을 하나 낮춘 회귀를 임시 사본에 주입해 테스트가 빨개지는지 본다.
- 경계 테스트는 **리터럴**로 쓴다(찜 2·3, 클릭 4·5, 999m·1000m, 기대 문구 「직선거리 1.0km」) — 상수 이름으로 경계를 만들면 상수를 낮춰도 초록이다. 회귀 주입은 사본마다 따로(FE `SAVED_MIN` · search/domain `SAVED_MIN` · batch 가 넘기는 `min` · 헤더 검사 한 줄), 컴파일·tsc 를 통과하는 회귀로 한다.
- CDP 대상은 「근거가 있는 표본 페이지」와 「근거가 없는 페이지(절 숨김)」를 TG0 분포로 미리 정한다. 표본이 0이면 그 근거는 컴포넌트 테스트로만 확인했다고 적는다.
