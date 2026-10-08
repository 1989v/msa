# 요구사항 — place 허브 최소 행동 계측 (S1-12b)

## 목표

1. place 허브에서 일어나는 여섯 행동(검색 제출·필터 적용·결과 선택·찜 완료·지도 링크 클릭·세션 시작)이 **기존 공통 이벤트 원장**(`POST /api/v1/events` → Kafka `analytics.event.collected` → ClickHouse `analytics.events`)에 같은 정의로 쌓인다. 2단계 UX 개선 **전**에 기준선을 잡기 위한 것이다.
2. 새 이벤트가 기존 집계(관광지 인기 `attraction_popularity_daily`, Streams 키워드 지표)를 오염시키지 않는다.
3. 서버 enum·`common` 모듈·Kafka 소비자를 건드리지 않는다 — 소비자에 ErrorHandlingDeserializer 가 없어 새 enum 값은 포이즌 필이 되고(`analytics/.../KafkaConsumerConfig.kt:18-36`, `recommendation/.../RecommendationEventConsumer.kt:65-72` else 없는 when), `common` 변경은 전 JVM 이미지를 다시 굽는다(무료 단일 노드).

## 범위

### R1 허브 화면 계측 (`portal-fe/src/pages/place/PlacePage.tsx`)
- 검색 상태(`query` useMemo, `:278-306`)가 바뀔 때마다 새 `viewId`(`newViewId`), 마운트 시 `installFlushOnLeave`.
- **세션 시작**: 허브 마운트 시 세션당 1회 `track('SESSION_START', { entityType:'PAGE', entityId:'place-hub', screenType:'PLACE_HUB', screenRef:'' })` — 섹션 없음(`PageItem`, SR-6.1). 세션당 1회 보장은 `sessionStorage` 플래그(`kgd.place.sessionStarted`, 저장 실패 시 모듈 변수)로. `SESSION_START` 는 Kotlin `EventAction` 에 이미 있고(`common/.../EventAction.kt:9-17`) TS 유니온에만 없다(`events.ts:13`) → TS 에 추가.
- **검색 제출 + 필터 적용**: 검색 결과가 도착했을 때(`useQuery` data, 0건 포함) `track('SEARCH', { entityType:'SEARCH', entityId: keyword || '*', screenType:'PLACE_HUB', screenRef: 시도/시군구 코드, sectionId:'ATTRACTION_LIST', payload })`. payload 에 `trigger`(`landing` 포함)(`submit`·`suggestion`·`nearMe`·`area`·`region`·`category`·`attribute`·`eventStatus`·`page`·`initial`·`landing`·`lang`·`other` — 오버레이 토글은 목록 질의가 아니라 SEARCH 없음), `changed`(바뀐 필드 이름 배열), `term`(검색어; `keyword` 라는 이름은 Streams 상품 키워드 지표가 읽으므로 피한다), `category`, `attributes`, `sido`, `sigungu`, `radiusKm`(기기 좌표는 적재하지 않는다 — 방침 §2 에 위치 행이 없고 ADR-0078 최소화), `page`, `total`, `correctedKeyword`. 첫 진입 자동 시도 선택(`:449-469`)은 `trigger:'initial'` 로 구분한다. 필터 적용 사건은 별도 action 이 아니라 **이 SEARCH 의 `trigger`/`changed`** 로 센다(enum 추가 금지, 목표 3).
- **결과 선택**: 카드 좌클릭(`PlaceCard onSelect`, `:1200-1202`)과 목록 핀(`:603`, `ATTRACTION_LIST`)·오버레이 핀(`:727`, `MAP_OVERLAY`, SR-3.2) 클릭에 `track('CLICK', { entityType:'ATTRACTION', entityId, screenType:'PLACE_HUB', screenRef: SR-2.1 의 지역 코드, sectionId:'ATTRACTION_LIST', itemIndex(카드만), payload:{ source:'card'|'map' } })`. 카드에는 `itemIndex` 를 넘긴다.
- **카드 노출**: `PlaceCard` 루트에 `useImpression`(`ATTRACTION`/`PLACE_HUB`/`ATTRACTION_LIST`/`itemIndex`) — ADR-0095 의 지면별 CTR 질의를 위해(인기 집계 소비자는 비율을 쓰지 않으므로 노출 없는 섹션이 있어도 집계는 깨지지 않는다, Q4).
- **지도 링크**: 허브 선택 패널(`:1318-1325`)과 상세(`AttractionPage.tsx:507-514`)의 Google Maps `<a>` 클릭에 `track('CLICK', { entityType:'ATTRACTION', entityId, screenType, sectionId:'MAP_LINK', payload:{ kind:'google_maps_search' } })`. 길찾기 개시가 아니라 「지도 열기」임을 payload 가 말한다.
- **찜 완료**: `useFavorites.toggleMutation`(`useFavorites.ts:28-48`)에 `onSuccess` 를 더해 서버 PUT/DELETE 가 끝난 뒤에만 `track('CLICK', { entityType: 대상 매핑, entityId: targetKey, screenType, screenRef, sectionId:'FAVORITE', payload:{ saved: true|false } })`. `FavoriteButton` 에 선택 prop `tracking?: { screenType, screenRef?, viewId }` 를 두고 place 화면(허브 패널·카드·상세)만 넘긴다. prop 이 없으면 계측하지 않는다(블로그·게임·상점 화면은 범위 밖). 낙관적 반전(`onMutate`)이나 실패 롤백에서는 보내지 않는다.
- TS `SectionId` 에 `MAP_LINK`·`FAVORITE`·`MAP_OVERLAY` 추가(`events.ts:23-40`), `TrackedItem` 은 `PlacedItem | PageItem` 판별 합집합(SR-6.1). 서버 `Placement.sectionId` 는 자유 문자열이라 변경 없음.

### R2 수집 서버 (`analytics`)
- **beacon 식별자 계약**: `CollectEventsRequest` 에 선택 필드 `sessionId`(`@Size(max=128)`)만 더하고(본문 `visitorId` 는 게이트웨이가 헤더를 항상 덮어써 도달 불가), 컨트롤러는 `X-Session-Id` 헤더가 없을 때 본문 `sessionId` 를 쓰고 그것도 없으면 지금처럼 visitorId 로 대체한다(`EventCollectController.kt:49`). visitor 는 게이트웨이가 헤더를 항상 덮어쓰므로(`VisitorIdFilter.kt:31-33`) 헤더 우선 유지.
- **eventId 에 entityType·sectionId 포함**: `"$viewId:${entityType}:$entityId:${sectionId}:${action}"`(`EventCollectDtos.kt:59`). FE 중복 키(`tracker.ts:23-25`)도 `sectionId` 를 넣어 같은 축으로 — 리뷰 1라운드 BLOCK(같은 관광지의 선택·지도·찜 CLICK 이 한 키로 접힘) 해소.
- **인기 집계 오염 방지**: `ClickHouseAttractionPopularityAdapter`(`:51-63`)의 클릭 `countIf` 와 `unique_clickers` 에서 `section_id IN ('MAP_LINK','FAVORITE')` 를 제외한다 — 상수 `POST_SELECTION_SECTIONS`(SR-8.2). 노출은 그대로(허브 카드 노출은 목록 노출이 맞다).
- Streams 키워드 지표(`AnalyticsStreamTopology.kt:123-131`)는 `action == SEARCH` 전부를 `payload.keyword` 로 묶는다 → 허브 SEARCH payload 의 검색어 필드명은 `term` 이고 `keyword` 를 넣지 않는다. 허브 행은 통합 검색과 같은 `unknown` 키로 간다. 토폴로지 정리는 Q7.
- ClickHouse 스키마 변경 없음(`LowCardinality(String)`).

### R3 검증 신호
- CDP(일반 Chrome UA — 헤드리스 UA 는 `CrawlerUserAgents` 가 202/accepted=0 으로 버림)로 허브에서 검색 1회·필터 1회·카드 선택 1회·지도 링크 1회를 하고 `POST /api/v1/events` 요청 본문과 `202 {accepted:N}` 을 기록한다.
- 배포 뒤 `ssh msa-oci` 로 ClickHouse `analytics.events` 에서 `screen_type='PLACE_HUB'` 행이 action 별로 1건 이상, `section_id` 분포에 `ATTRACTION_LIST`·`MAP_LINK`·`FAVORITE` 가 있는지 확인(찜은 테스트 계정 없으면 미확인으로 남김).
- 인기 집계 재계산 결과에 MAP_LINK·FAVORITE 클릭이 들어가지 않는 것은 어댑터 테스트(SQL 문자열)로.

## 범위 밖
- `EventAction`·`EntityType` 추가(FILTER·SAVE 등) — 소비자 ErrorHandlingDeserializer 선행 후 별도 슬라이스.
- 상세(`ATTRACTION_DETAIL`)의 다른 계측 보강, 통합 검색·지역 페이지 변경, 광고 경로.
- `queryExperimentMetrics` 의 깨진 `event_type` 컬럼 조회(`EventRepositoryAdapter.kt:64-101`) — 보고만.
- ClickHouse 중복 제거(ReplacingMergeTree 전환) — 기준선 쿼리는 `uniqExact(tuple(view_id, entity_type, entity_id, section_id, action))` 로 센다(리뷰 1라운드: 중복 키에 섹션 추가).
- 게이트웨이 vid 덮어쓰기·FE `kgd.visitorId` 불일치.

## 제약
- 이미지: portal-fe + analytics 둘만 다시 굽는다. `common`·gateway·engagement 는 건드리지 않는다.
- 요청 경로 외부 호출 없음. 개인정보: 검색어는 지금도 통합 검색이 entityId 로 보내는 것과 같은 범위이며 좌표는 적재하지 않는다(`radiusKm` 만).
- `PlacePage.test.tsx` 는 tracker mock 없이 돌고 있다 → 새 테스트는 `RegionPage.test.tsx:13-19` 패턴(`vi.mock('../../../analytics/tracker')`)으로. 예외: 실제 트래커 통합 케이스는 별도 파일(SR-9.1)에서 tracker·FavoriteButton mock 없이.
- Kotest BehaviorSpec + MockK(`docs/standards/test-rules.md`).

## 재사용
`track`·`useImpression`·`newViewId`·`installFlushOnLeave`(`portal-fe/src/analytics/*`), `TrackedItem` 타입, `CollectEventItem.toEvent`, 기존 `CollectEventItemTest`·`ClickHouseAttractionPopularityAdapterTest` 패턴, `RegionPage.test.tsx` 의 track mock 패턴.

## 실패 의미 · 관측
- 계측 실패는 화면 동작에 영향을 주지 않는다(기존 `flush` 가 throw 하지 않음, `warnIfRejected` 1회 경고).
- 중복: 같은 `viewId` 안 같은 (entityType, entityId, sectionId, action) 은 FE 가 한 번만 보낸다. 세션 시작은 세션당 1회.
- 디버깅: 브라우저 네트워크 탭의 `/api/v1/events` 본문, 서버 202 `accepted`, ClickHouse `screen_type='PLACE_HUB'` 질의.
