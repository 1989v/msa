<!-- source: portal-fe/src/pages/place/PlacePage.tsx, portal-fe/src/analytics/tracker.ts, portal-fe/src/analytics/events.ts, portal-fe/src/components/favorite/useFavorites.ts, analytics/app/src/main/kotlin/com/kgd/analytics/presentation/event/controller/EventCollectController.kt, analytics/app/src/main/kotlin/com/kgd/analytics/application/popularity/usecase/AggregateAttractionPopularityUseCase.kt, analytics/app/src/main/kotlin/com/kgd/analytics/infrastructure/popularity/ClickHouseAttractionPopularityAdapter.kt, docs/adr/ADR-0095-impression-click-pipeline.md -->
# Specification: place 허브 최소 행동 계측

> 개정 2026-10-08 — 1라운드: 중복 키·eventId 에 섹션 추가, 기준선 질의(SR-10) 신설, 개인정보·위조 헤더·용어 정합. 2라운드: `overlay` 트리거 제거, PAGE 대상 판별 합집합, 제외 상수 `POST_SELECTION_SECTIONS`, 선택률을 view 전환·튜플 전환으로 재정의, 찜 둘째 토글 유실 서술 정정, 테스트 경계(별도 파일·사람 UA·리터럴 기대값) 고정. 3라운드(심판 전건 MINOR 강등): `other` 금지 게이트·IMPRESSION 부정 단언·screenRef 합성 단언·타입 게이트 증명을 SR-9 에 추가. 판정은 `context/review-verdict-round{1,2,3}.md`.

## Goal

place 허브(`place.1989v.com/`)의 행동 중 필수 6종 가운데 넷(검색 제출 `search_submitted`·필터 적용 `filter_applied`·결과 선택 `result_clicked`·찜 완료 `save_completed`)과 허브 세션 시작·지도 열기를 기존 공통 이벤트 원장에 같은 정의로 기록해, 2단계 UX 개선 전후를 SR-10 의 질의 한 벌로 비교할 수 있게 한다. 서버 enum·`common`·Kafka 소비자는 건드리지 않고, 새 이벤트가 관광지 인기 집계를 오염시키지 않고, 허브 검색어가 상품 키워드 점수의 키로 들어가지 않는다(`unknown` 묶음이 느는 것은 Q7). 나머지 둘(`collection_shared`·`directions_clicked`)은 Out of Scope 에 이유와 함께 둔다.

## User Stories

- 운영자로서, 허브에서 세션·검색·필터·선택·찜·지도 열기가 얼마나 일어나는지 ClickHouse 질의 한 벌(SR-10)로 보고 싶다. 그래야 2단계 개선의 효과를 같은 정의로 전후 비교할 수 있다.
- 운영자로서, 허브에서 생긴 지도 열기·찜 클릭이 「많이 본 곳」 인기 집계를, 허브 검색어가 상품 키워드 지표를 왜곡하지 않기를 바란다.
- 개발자로서, 새 이벤트 종류를 넣을 때 Kafka 소비자가 멈추지 않기를 바란다. 이번에는 enum 을 늘리지 않는 설계로 그 위험을 피한다.

## 구현 전제

- origin/main `8a61f0b` 기준 워크트리(`place-stage2`)에서만 구현한다. 메인 워킹트리의 analytics·common 미커밋 변경과 섞지 않는다.
- 롤백은 이미지 되돌리기다. ClickHouse 스키마와 데이터 이행은 없다(일 집계는 DELETE+INSERT 재계산).

## Specific Requirements

### SR-1 허브 뷰 단위와 세션 시작
1. 허브 화면은 검색 조건(`query` 메모)이 바뀔 때마다 새 `viewId` 를 만든다. `query` 에는 `page` 가 들어 있어 모바일 누적 목록에서는 1쪽 카드의 노출과 2쪽 뒤의 클릭이 다른 `viewId` 를 갖는다. 이번 기준선은 노출↔클릭 CTR 을 쓰지 않는다(일 집계와 같은 단위). `trigger` 가 `page` 인 SEARCH 는 검색 제출·필터 적용 건수에 넣지 않되 선택률의 분모(결과 view)에는 넣는다(SR-10). 모바일 누적 목록에서 2쪽 도착 뒤 1쪽 카드를 누르면 그 클릭은 2쪽 view 에 귀속된다 — 유실이 아니라 귀속 이동이다.
2. 허브 마운트 시 `installFlushOnLeave` 를 설치한다(상세·지역 화면과 같은 방식).
3. 허브가 처음 열릴 때 세션당 한 번 `SESSION_START` 를 보낸다. 여기서 PLACE_HUB 세션은 화면 쪽 `sessionId`(sessionStorage, 탭 수명)와 같은 범위다. 대상은 `PAGE` / `place-hub`, 화면 `PLACE_HUB`. `screenRef` 는 빈 값이다 — 마운트 시점에는 시도가 없다(`sidoCode` 는 `selectRegion` 만 채우고 자동 선택은 `sidoRegions` 도착 뒤 effect). 섹션은 없다(`PageItem`, SR-6.1). 세션당 1회는 sessionStorage 플래그 `kgd.place.sessionStarted` 로 보장하고, 저장소를 못 쓰면 모듈 변수로 대신한다(그 경우 새로고침마다 1회). 테스트용 초기화 함수를 둔다.
4. `SESSION_START` 는 서버 `EventAction` 에 이미 있고 게임 세션 소비자도 같은 값을 쓴다. 기준선 질의는 `entity_type='PAGE' AND entity_id='place-hub'` 로 게임 세션(`entity_type='GAME'`)과 가른다. 화면 쪽 `EventAction` 유니온에 값을 더한다.

### SR-2 검색 제출과 필터 적용은 하나의 SEARCH 이벤트
1. 검색 결과(0건 포함)가 도착하면 그 `viewId` 로 `SEARCH` 를 한 번 보낸다. 대상은 `SEARCH` / 검색어(없으면 `*`), 화면 `PLACE_HUB`, 섹션 `ATTRACTION_LIST`. `screenRef` 는 행정구역 **전체** 코드다: 시군구가 있으면 `시도코드+시군구코드`(지역 페이지의 `PLACE_REGION` 과 같은 체계), 시도만 있으면 시도 코드, 둘 다 없으면 빈 값. PLACE_HUB 의 SEARCH·IMPRESSION·CLICK 은 그 시점의 같은 값을 쓴다(SESSION_START 는 SR-1.3 대로 빈 값).
2. payload 는 `trigger`, `changed`, `term`(검색어), `category`, `attributes`, `sido`, `sigungu`, `radiusKm`, `page`, `total`, `correctedKeyword` 를 담는다. 기기 좌표(위도·경도)는 담지 않는다. 필드 이름은 `keyword` 가 아니라 `term` 이다 — Streams 키워드 지표가 `payload.keyword` 로 상품 키워드 점수를 만들므로 허브 검색어가 거기 섞이지 않게 한다.
3. `trigger` 는 조작 시점에 ref 로 남겼다가 결과 도착 시 소비한다(필드 diff 역추론이 아니다): `submit`(검색어 확정), `suggestion`(자동완성 선택), `nearMe`, `area`(이 지역 검색), `region`, `category`, `attribute`, `eventStatus`, `page`, `initial`(첫 진입 자동 시도 선택), `landing`(직전 조건이 없는 첫 질의), `lang`(언어 전환 — `switchLang` 에서 ref), `other`(ref 가 비어 있는 채 결과가 도착한 경우의 안전망). 한 조작이 여러 필드를 바꾸면 `changed` 에 전부 적고 `trigger` 는 그 조작 이름이다. ref 를 심는 지점은 Existing Code 의 허브 핸들러 전부다. `pickSuggestion` 은 좌표 없는 제안의 early return(`:840`) 뒤에 심는다. 구 지역 축 `<select>`(`!hasRegionAxis`, `:1072-1076`)는 `region`·`changed: ['areaCode']`. 자동 시도 선택과 칩·시도 마커·`RegionSheet` 가 공유하는 `selectRegion` 에는 trigger 인자를 두어 자동 선택(`:458`)만 `initial` 을 넘긴다. `trigger` 가 `undefined` 인 SEARCH 는 없다 — 안전망이 보장한다. ref 를 빠뜨린 핸들러는 `other` 를 내므로 SR-9.1 의 `other` 금지 게이트가 잡는다.
4. 필터 적용은 별도 action 이 아니라 이 SEARCH 의 `trigger`·`changed` 로 센다. 서버 `EventAction` 은 늘리지 않는다. 오버레이 토글은 목록 질의를 바꾸지 않으므로 SEARCH 가 없다(Out of Scope).
5. 검색 API 가 재시도 뒤에도 실패하면(`isError`) SEARCH 를 보내지 않는다. 실패한 제출은 분모에 들어가지 않는다는 것이 의도다.

### SR-3 결과 선택과 카드 노출
1. 카드 좌클릭(패널 열기)과 목록 핀 클릭은 `CLICK` 을 보낸다. 대상 `ATTRACTION` / 관광지 id, 화면 `PLACE_HUB`, `screenRef` 는 SR-2.1 의 지역 코드, 섹션 `ATTRACTION_LIST`, payload `source` 는 `card` 또는 `map`. 카드는 `itemIndex`(목록 순서)를 함께 보낸다. 수정키(⌘·Ctrl·Shift·Alt) 좌클릭은 기본 동작(실주소 새 탭)을 유지한 채 `track` 을 early return(`:1349`) 앞에 두고 `payload.newTab: true` 로 보낸다. 가운데 클릭은 `click` 이 아니라 `auxclick` 이라 세지 않는다. newTab 클릭 뒤 같은 카드의 일반 클릭은 같은 키라 가지 않는다. 자동완성 선택으로 열린 패널은 CLICK 을 보내지 않는다(그 조작은 SR-2 의 `suggestion`). 목록 핀 리스너(`:603`)는 viewId 를 ref 로 읽는다 — 마커 effect 가 viewId 마다 다시 돌지 않게.
2. 오버레이 핀(음식·쇼핑·숙박 질의의 핀)은 섹션 `MAP_OVERLAY`, `source: map`, `itemIndex` 없음. 인기 집계에는 포함한다(목록 클릭과 같은 뜻). 오버레이 핀·목록 핀은 노출 없는 클릭이라 그 관광지의 일 집계 `clicks` 가 `impressions` 를 넘을 수 있다. 집계 소비자는 비율을 쓰지 않으므로 깨지지 않는다(Q4).
3. 카드 루트는 `useImpression` 으로 노출을 보낸다(면적 50%·1초 규칙은 기존 그대로). 섹션 `ATTRACTION_LIST`, `itemIndex` 포함.
4. 불변식: 클릭은 (`viewId`, `entityType`, `entityId`, `sectionId`, `action`) 당 1회, 노출은 (`viewId`, `entityType`, `entityId`, `sectionId`) 당 1회다. 그 결과 상세 화면에서 같은 관광지가 두 섹션에 겹치면 노출이 2행이 된다 — 섹션마다 CTR 이 다른 수치라는 ADR-0095 §2 와 같은 방향이며 받아들인다.

### SR-4 지도 열기
1. 허브 선택 패널과 관광지 상세의 Google Maps 링크 클릭은 `CLICK` 을 보낸다. 대상 `ATTRACTION` / 관광지 id, 화면은 각각 `PLACE_HUB`·`ATTRACTION_DETAIL`, 섹션 `MAP_LINK`, payload `kind: google_maps_search`. 이것은 「지도 열기」이지 길찾기 개시(`directions_clicked`)가 아니다.
2. `MAP_LINK` 로 IMPRESSION 을 보내지 않는다 — 노출을 동봉하는 `TrackedLink` 를 쓰지 않고 `onClick` 에서 `track` 만 부른다. 링크의 기본 동작(새 탭)은 바꾸지 않고, 계측 실패가 이동을 막지 않는다.

### SR-5 찜 완료
1. 찜 토글은 서버 PUT/DELETE 가 성공한 뒤에만 `CLICK` 을 보낸다. 대상은 `ATTRACTION` / `targetKey`(이번에는 관광지만), 섹션 `FAVORITE`, payload `saved: true|false`. `saved` 는 요청 종류(추가→true, 삭제→false)로 정하고 낙관적 반전 뒤의 캐시를 다시 읽지 않는다.
2. `onSuccess` 는 `useFavorites` 훅 안에 둔다(호출별 콜백은 언마운트 뒤 불리지 않는다). `FavoriteButton` 은 선택 prop `tracking`(`screenType`, `screenRef`, `viewId`)을 받아 훅에 넘기고, prop 이 없으면 계측하지 않는다. 이번에 prop 을 넘기는 호출처는 허브 카드·허브 선택 패널·관광지 상세 셋이다.
3. 낙관적 반전·실패 롤백·비로그인 클릭(로그인 이동)에서는 보내지 않는다. `FAVORITE` 로 IMPRESSION 을 보내지 않는다.
4. 기준선은 `saved: true` 행만 「찜 완료」로 센다. 찜 CLICK 은 (view, 관광지) 당 첫 토글 한 번만 남는다 — 방향은 payload 가 말하고, 같은 view 의 이후 토글(해제·재찜)은 `saved` 와 무관하게 중복 키에 걸려 가지 않는다. 카드 별(`:1368`)과 패널 별(`:1304`)은 같은 관광지면 같은 키라 서로도 막는다. 처음부터 찜된 채 들어와 「해제 → 찜」을 하면 그 view 의 찜 완료는 0 이다. 이 유실을 받아들인다. 신규 저장과 멱등 재응답(다른 탭에서 이미 찜한 경우)은 가르지 않는다 — 요청 종류로만 정한다.

### SR-6 화면 쪽 타입과 상수
1. `SectionId` 유니온에 `MAP_LINK`·`FAVORITE`·`MAP_OVERLAY` 를 더한다. `MAP_LINK`·`FAVORITE` 주석: 「선택 뒤 후속 행동 — 관심 신호가 아니라 인기 집계에서 뺀다. 노출을 보내지 않는다. 서버 `AggregateAttractionPopularityUseCase.POST_SELECTION_SECTIONS` 와 한 몸」. `MAP_OVERLAY` 주석: 「지도 레이어 핀 — 노출 없는 클릭, 인기 집계 포함」. `TrackedItem` 을 판별 합집합으로 바꾼다 — `PlacedItem`(지금 모양, `sectionId: SectionId` 필수) `| PageItem`(`entityType: 'PAGE'`, `sectionId?: never`, `sectionIndex?: never`, `itemIndex?: never`). `TrackedEvent` 는 `TrackedItem & { action; viewId; occurredAt }` 타입 별칭이 된다. `track`·`useImpression`·`TrackedLink` 시그니처는 그대로. 섹션을 빠뜨린 목록 호출처는 컴파일이 막는다(SR-8 이 거부 목록이라 빈 섹션 CLICK 은 집계에 들어간다). 서버 `Placement.sectionId` 는 자유 문자열이라 변경이 없다.
2. `EventAction` 유니온에 `SESSION_START` 를 더한다. `EntityType` 은 그대로.
3. 트래커 중복 키는 `viewId|entityType|entityId|sectionId|action` 이다(`PageItem` 은 `sectionId ?? ''` — 템플릿에 `undefined` 문자열이 박히지 않게).

### SR-7 수집 서버 (analytics)
1. 수집 요청 본문에 선택 필드 `sessionId`(`@Size(max = 128)`)만 더한다. 세션 결정 순서는 `X-Session-Id` 헤더 → 본문 `sessionId` → visitorId. visitor 는 헤더만 쓴다(게이트웨이가 항상 채움, 없으면 `anonymous`). 본문 `visitorId` 는 DTO 에 두지 않는다(도달 불가 경로). 모르는 키는 Jackson 기본값대로 무시하고 거절하지 않는다 — beacon 본문은 지금도 `{ events, visitorId, sessionId }` 라(`tracker.ts:65-69`) 거절하면 pagehide 전송 전부가 400 이 된다.
2. `X-User-Id` 헤더를 읽지 않는다 — `userId` 는 null 고정. 이 라우트는 게이트웨이 인증 필터를 거치지 않아 클라이언트가 임의 값을 넣을 수 있다.
3. 이벤트 id 는 `viewId:entityType:entityId:sectionId:action` 으로 만든다. `sectionId` 는 `orEmpty()`(PAGE 대상은 빈 칸). `viewId` 가 없으면 지금처럼 UUID. 크롤러 UA 거부(202 · accepted 0)와 100건 상한은 그대로.

### SR-8 인기 집계 오염 방지
1. 관광지 인기 일 집계의 클릭 수와 고유 클릭자 집계에서 섹션 `MAP_LINK`·`FAVORITE` 행을 제외한다. 노출 집계는 바꾸지 않는다. 섹션 중복 키 변경으로 상세 두 섹션 겹침 노출이 2행이 되는 것은 받아들인다(허브는 노출 섹션이 하나라 변화 없음).
2. 제외 목록은 application 의 `AggregateAttractionPopularityUseCase.companion` 에 `val POST_SELECTION_SECTIONS = setOf("MAP_LINK", "FAVORITE")` 로 둔다(`MAX_REAGGREGATE_DAYS` 옆. 어댑터가 application 상수를 읽는 선례는 `CollectEventsUseCase.ANONYMOUS_VISITOR`). 이름이 「목록이 아님」이 아닌 이유: `MAP_OVERLAY` 도 목록 밖·노출 없음인데 집계에 넣는다 — 기준은 「선택 뒤 후속 행동」이다. 어댑터는 `INSERT_DAY` 를 `private val` 로 내리고 `joinToString { "'$it'" }` 로 `section_id NOT IN (...)` 을 `countIf(action = 'CLICK' AND …)` 와 `uniqStateIf(… AND …)` 두 곳에 보간한다. 설정값·환경변수로 올리지 않는다. 어댑터 테스트는 상수로 기대값을 만들지 않는다 — 리터럴 `section_id NOT IN ('MAP_LINK', 'FAVORITE')` 가 두 술어 안에 있음을 보고, `impressions` 의 `countIf(action = 'IMPRESSION')` 에는 제외가 없음을 보고, `POST_SELECTION_SECTIONS shouldBe setOf("MAP_LINK", "FAVORITE")` 를 따로 고정한다. `events.ts` 주석과 상호 참조한다. `AggregateAttractionPopularityUseCase` KDoc 에 「`clicks`·`unique_clickers` 는 목록 선택(카드·목록 핀·오버레이 핀)만 센다 — `POST_SELECTION_SECTIONS` 제외, 노출은 그대로」 한 줄.

### SR-9 검증
1. 화면(vitest): 실제 트래커로 「카드 CLICK → 패널 지도 링크 CLICK → 찜 CLICK」 세 건이 모두 대기열에 남는 통합 케이스 1건, `tracker.test.ts` 에 「같은 대상·다른 섹션 CLICK 둘 다 보낸다」, 페이지 테스트의 `FavoriteButton` 대역은 `tracking` prop 을 드러내 허브 카드·패널·상세 세 배선을 확인, 카드 IMPRESSION(IntersectionObserver 대역 + fake timers), 세션 시작 격리(`sessionStorage.clear()` + 초기화 함수, 저장소 실패 케이스), SR-2 경계(0건·`landing`·`initial`·복수 `changed`·`page`·같은 viewId 재발화 없음·링크 기본 동작 유지·검색 실패 미발화), SR-5 미발화 3건(비로그인·pending·롤백)과 `saved` 두 방향. 나머지 발화·미발화는 `track` mock 으로. 통합 케이스는 별도 파일 `pages/place/__tests__/PlacePage.tracking.test.tsx`(tracker·FavoriteButton mock 없음. `wishlistApi` mock + `portal_user_id` 쿠키 + `fetchAttraction` mock + 데스크톱 `matchMedia`. `beforeEach` 에 `resetTrackerForTest()`·`resetIdentityForTest()`). 세 CLICK 의 섹션이 `ATTRACTION_LIST`·`MAP_LINK`·`FAVORITE` 이고 viewId 가 같다. `navigator.sendBeacon` stub + `pagehide` 로 beacon 본문에 세 건(SR-1.2 를 같은 케이스로). 같은 파일에 「해제(`saved:false`) → 찜(`saved:true`)은 `pendingForTest()` 에 한 건」. `saved` 두 방향 케이스는 서로 다른 viewId 로. SEARCH 케이스 하나에 금지 키 부정 단언 — `payload` 에 `term` 있음·`keyword` 없음, `nearMe` 를 geolocation stub 으로 누른 뒤 `lat`·`lng`·`geo` 없음·`radiusKm` 만. 「vitest 가 일으킨 SEARCH 가운데 `trigger === 'other'` 가 하나라도 있으면 실패」(테스트는 모든 질의를 아는 핸들러로 일으키므로 `other` 는 곧 ref 누락). 트리거별 케이스에 `submit`(`runKeywordSearch` `:854-859`)·`region`(구 축 `<select>` `:1072-1076`, `changed: ['areaCode']`)·`category`(분류 칩 `:1046-1050`, `changed` 복수)·`eventStatus`(`:1099-1102`)·`lang`(`switchLang` `:880-884`)을 한 줄씩 더한다. `area`(`searchThisArea` `:861-870`)는 `mapRef.current` 가 필요해 jsdom 밖 — SR-9.4 로. 수정키 클릭: `fireEvent.click(card, { metaKey: true })` 반환 `true` + CLICK `newTab: true`. 자동완성 선택 → CLICK 미호출, SEARCH `trigger:'suggestion'` 1건. landing 케이스에 `entityId:'*'` 단언. 오버레이 칩 토글 → SEARCH 미발화·viewId 불변. SESSION_START 단언값 `screenRef: ''`·`sectionId` 없음. FavoriteButton 대역이 받은 `viewId` 가 같은 화면 SEARCH 의 `viewId` 와 같은 값. 실행 메모: IMPRESSION 은 결과 도착 뒤 `vi.useFakeTimers({ toFake: ['setTimeout','clearTimeout'] })` + `advance(DWELL_MS)`; 검색 실패 케이스는 `retry: 3` 지수 지연(1+2+4초)을 fake timers 로 넘긴다. 카드 IMPRESSION 케이스에서 카드 클릭으로 패널을 연 뒤 `show(1)` + `advance(DWELL_MS)` 를 한 번 더 하고, `track` mock 의 IMPRESSION 호출 전부가 `sectionId === 'ATTRACTION_LIST'`(`MAP_LINK`·`FAVORITE` 0건). `FavoriteButton.test.tsx` 에 `track` mock 을 두고 마운트·토글 어느 시점에도 IMPRESSION 0. `initial` 케이스에 `screenRef: '11'`, 시군구 선택 케이스(시도 `'11'` + 시군구 `'110'`)에 `screenRef: '11110'`, 카드 CLICK 케이스에 같은 view 의 `screenRef` 가 같은 값. `tracker.test.ts` 에 `// @ts-expect-error — 목록 대상은 sectionId 필수` 로 `track('CLICK', { entityType:'ATTRACTION', entityId:'1', screenType:'PLACE_HUB' }, 'v')` 한 줄(`tsconfig.app.json` 이 `src` 전체를 포함하므로 커밋 전 훅 `compile-changed.sh` 의 `tsc -b` 가 본다). PAGE 대상에 sectionId 를 주는 둘째 줄은 넣지 않는다 — `PlacedItem.entityType` 이 `EntityType` 전체라 그 리터럴은 `PlacedItem` 으로 컴파일돼 지시문이 Unused 로 스스로 빨개진다.
2. 서버(Kotest): 컨트롤러 테스트(MockMvc standalone + MockK) 6케이스 — standalone 에 `GlobalExceptionHandler` advice(선례 `AttractionSearchControllerTest.kt:22`). 비크롤러 5케이스는 `User-Agent` 에 사람 브라우저 UA 를 넣는다 — MockMvc 기본 요청에는 UA 가 없어 `isCrawler(null)` 이 true 라 전부 202/0 이 된다. `collect` 인자를 `slot<List<AnalyticsEvent>>()` 로 받아 `accepted == 1` 과 `sessionId`·`visitorId`·`userId` 를 본다. 케이스: 헤더 세션, 본문 세션 폴백(본문은 beacon 모양 그대로 `{ events, visitorId, sessionId }` → 202, `sessionId` 는 본문 값, `visitorId` 는 `anonymous`), 둘 다 없으면 visitorId, `X-User-Id: 1` 이어도 `userId == null`, 크롤러(UA `HeadlessChrome`) 202/0 + `verify(exactly = 0)`, 101건 400; `CollectEventItemTest` eventId 에 섹션 포함; 어댑터 테스트 SR-8.2.
3. 회귀 주입 12건으로 각 게이트의 빨간불을 한 번씩 본다: SEARCH `track` 제거 · 한 호출처의 `tracking` prop 제거 · 카드 `useImpression` ref 제거 · 어댑터 제외 절 제거(countIf·uniqStateIf 각각) · `POST_SELECTION_SECTIONS` 를 `emptySet()` 으로(절 제거와 별개) · 본문 `sessionId` 분기 제거 · 중복 키의 `sectionId` 제거 · payload 에 `keyword: term` 한 줄 추가 · 아무 핸들러 하나의 ref 심기 제거(그 트리거 케이스와 `other` 금지가 함께 빨간불) · 허브 지도 링크를 `TrackedLink` 로 교체(IMPRESSION 부정 단언 빨간불) · `PlacedItem.sectionId` 선택화('Unused @ts-expect-error directive' 로 빨간불) · screenRef 합성에서 시도 접두 제거(`'110'` 이 되어 빨간불).
4. 배포 뒤: 일반 Chrome UA 의 CDP 로 허브 검색·필터·이 지역 검색(`trigger: area` — `mapRef` 가 필요해 jsdom 밖)·카드 선택·목록 핀 클릭(`ATTRACTION_LIST`/`source: map`)·오버레이 핀 클릭(`MAP_OVERLAY`)·지도 링크를 실행해 — 핀은 `window.google.maps` 가 필요해 vitest 밖이다 — 「보낸 건수 = `202 accepted` = ClickHouse 저장 행 수」 세 수를 한 표에 적고, SR-10 질의와 인기 재집계 `SELECT` 를 ClickHouse 에서 한 번 실행한다. 찜은 테스트 계정이 없으면 「미확인」으로 남긴다.

### SR-10 기준선 정의 (이 슬라이스의 산출물)
공통 조건: `screen_type = 'PLACE_HUB'`, `visitor_id != 'anonymous'`, payload 는 `String` 컬럼이라 `JSONExtract*` 로 읽는다. 중복 튜플에는 `section_id` 가 들어간다. 비율은 노출↔클릭 CTR 이 아니라 view 전환과 튜플 전환이다.

| 지표 | 정의 |
|---|---|
| 허브 세션 | `uniqExact(session_id)` where `action='SESSION_START' AND entity_type='PAGE' AND entity_id='place-hub'` |
| 검색 제출 | `uniqExact(view_id)` where `action='SEARCH' AND JSONExtractString(payload,'trigger') IN ('submit','suggestion','nearMe','area')` |
| 필터 적용 | 같은 식, `trigger IN ('region','category','attribute','eventStatus')` |
| 결과 view | `uniqExact(view_id)` where `action='SEARCH' AND trigger != 'landing'` — 카드가 그려진 view 전부(initial·page·lang·restore·other 포함). 지역 고르기 화면(`pickingRegion`)으로 넘어간 view 도 SEARCH 가 나가 여기 들어간다(카드는 없다). 비율의 분모는 이것 하나다 |
| 결과 선택 | `uniqExact((view_id, entity_id))` where `action='CLICK' AND section_id IN ('ATTRACTION_LIST','MAP_OVERLAY')` |
| 찜 완료 | 같은 식, `section_id='FAVORITE' AND JSONExtractBool(payload,'saved')` |
| 지도 열기 | 같은 식, `section_id='MAP_LINK'` |
| 건수에서 빼는 것 | 검색 제출·필터 적용 건수에는 `trigger IN ('landing','initial','page','lang','other','relax','restore')` 를 넣지 않는다. 두 지표는 허용 목록 `IN (...)` 이라 쿼리는 그대로다. `relax` 와 `restore`(로그인 복귀로 되살린 허브의 첫 질의, 2026-10-09 로그인 복귀 스펙 SR-1.2) 는 결과 view 에는 들어간다. 결과 view 에서는 `landing` 만 뺀다 — 지역 선택 화면이라 카드가 없다(`PlacePage.tsx:1192`) |
| 0건 해제 | `uniqExact(view_id)` where `action='SEARCH' AND JSONExtractString(payload,'trigger')='relax'` — 해제 버튼·「모두 해제」·「원래 검색어로 검색」으로 생긴 view 전부(0건이 아닌 화면에서 누른 원래 검색어 링크, 해제 뒤 다시 0건인 view, 지역 고르기 화면으로 넘어간 view 포함). 복구율은 이번에 정의하지 않는다 |
| ref 누락 점검 | `count()` where `action='SEARCH' AND trigger='other'` — 0 이어야 한다. 안전망은 fail-open 이라 운영에서 ref 누락은 `other` 로 조용히 분모에만 들어간다. 기준선을 읽을 때마다 같이 본다 |
| 비율 | 세션당 검색 = 검색 제출 ÷ 허브 세션. 선택률 = 결과 view 가운데 `ATTRACTION_LIST`·`MAP_OVERLAY` CLICK 이 1건 이상인 view 수 ÷ 결과 view 수 — 분자는 분모 집합 안에서만 센다. 선택당 지도 열기(찜) = 결과 선택 튜플 가운데 같은 (view_id, entity_id) 에 `MAP_LINK`(`FAVORITE`·saved) CLICK 이 있는 튜플 수 ÷ 결과 선택 튜플 수 — 자동완성으로 연 패널의 지도·찜 행은 선택 CLICK 이 없어 이 비율에 들어가지 않고 절대 건수에만 남는다. 상세 화면(`ATTRACTION_DETAIL`) 행은 따로 센다 |

```sql
-- 선택률
SELECT countIf(selected) / count() AS pick_rate FROM (
  SELECT view_id,
         max(action = 'SEARCH' AND JSONExtractString(payload, 'trigger') != 'landing') AS result_view,
         max(action = 'CLICK' AND section_id IN ('ATTRACTION_LIST', 'MAP_OVERLAY')) AS selected
  FROM analytics.events WHERE screen_type = 'PLACE_HUB' AND visitor_id != 'anonymous'
  GROUP BY view_id) WHERE result_view;
-- 선택당 지도 열기 · 찜
SELECT countIf(map_open) / count() AS map_rate, countIf(saved) / count() AS save_rate FROM (
  SELECT view_id, entity_id,
         max(action = 'CLICK' AND section_id IN ('ATTRACTION_LIST', 'MAP_OVERLAY')) AS selected,
         max(action = 'CLICK' AND section_id = 'MAP_LINK') AS map_open,
         max(action = 'CLICK' AND section_id = 'FAVORITE' AND JSONExtractBool(payload, 'saved')) AS saved
  FROM analytics.events WHERE screen_type = 'PLACE_HUB' AND visitor_id != 'anonymous' AND entity_type = 'ATTRACTION'
  GROUP BY view_id, entity_id) WHERE selected;
```

## Existing Code to Leverage

- 트래커: `portal-fe/src/analytics/tracker.ts`(`track`, `flush`, `installFlushOnLeave`, `keyOf`, `pendingForTest`), `identity.ts`(`newViewId`, `sessionId`, `resetIdentityForTest`), `useImpression.ts`, `events.ts`(타입). 판별 합집합 선례 `portal-fe/src/api/shopApi.ts:110-111`(`?: never`).
- 호출 패턴: `portal-fe/src/pages/search/UnifiedSearchPage.tsx:55-71`(결과 도착 뒤 SEARCH), `portal-fe/src/pages/place/RegionPage.tsx:271-296`(TrackedLink·전체 지역 코드 `screenRef`), `AttractionPage.tsx:221-223`(viewId·flush 설치).
- 허브 핸들러: `PlacePage.tsx` `query`(278-306) · `useQuery`(308-321, `enabled` 없음, `retry: 3`) · `toggleAttribute`(349-357) · 쪽 넘김(모바일 센티널 377 · 데스크톱 이전/다음 1209·1218 · 더 보기 1231) · `pickingRegion`(417) · `selectRegion`(420-440) · 자동 시도 선택(449-469) · 목록 핀(603) · 오버레이 질의·핀(684-698, 727) · `pickSuggestion`(837-852, early return 840) · `runKeywordSearch`(854-859) · `searchThisArea`(861-870) · `nearMe`(872-877) · 언어 전환 `switchLang`(880-884) · 분류 칩(전체 1033-1036 · 분류 1046-1050, category·listEventStatus·page 를 같이 바꿈 → `changed` 복수) · 구 지역 축 select(1072-1076) · 행사 상태 칩(1099-1102) · 지역 칩(1181) · 패널 찜(1304) · 지도 링크(1317-1324) · `PlaceCard`(1329-1383, 수정키 early return 1349, 카드 찜 1368).
- 찜: `useFavorites.ts` `toggleMutation`(28-48, `onSuccess` 없음), `FavoriteButton.tsx`(53-78).
- 서버: `EventCollectController.kt`(35-56, 세션 폴백 48-49, `X-User-Id` 50), `EventCollectDtos.kt`(20-82, eventId 58-59), `AggregateAttractionPopularityUseCase.kt`(companion `MAX_REAGGREGATE_DAYS`), `ClickHouseAttractionPopularityAdapter.kt`(25-32 DELETE+INSERT, 51 `INSERT_DAY` const, 55-57 countIf·uniqStateIf), `AnalyticsStreamTopology.kt:123-131`(SEARCH → `payload.keyword`), ads `EventDtos.kt:16-19`(`@Size(max=128)` 선례), `common/.../CrawlerUserAgents.kt:45`(UA 없음 = 크롤러).
- 테스트 패턴: `portal-fe/src/pages/place/__tests__/RegionPage.test.tsx:13-19, 100-110`(track mock), `PlacePage.test.tsx:14, 63`(FavoriteButton null mock·QueryClient retry:false), `tracker.test.ts`, `adsTestKit.ts:114`(IntersectionObserver 대역), `FavoriteButton.test.tsx:34`(`portal_user_id` 쿠키), `analytics/.../CollectEventItemTest.kt`, `ClickHouseAttractionPopularityAdapterTest.kt:57`(상수 보간 기대값 — 이번엔 쓰지 않는 꼴), `search/app/.../AttractionSearchControllerTest.kt:17-23`(MockMvc standalone + advice).
- 문서: `docs/adr/ADR-0095-impression-click-pipeline.md` §3(`:83`)과 FE 노출 감지(`:140`)의 「(view_id, entity_id) 1회」 두 줄을 「+ section_id」로 개정한다. `:63` 에 「목록 화면은 비우되, 지역을 축으로 고른 목록(허브·지역 허브)은 그 지역 코드」, §6 에 「`clicks`·`unique_clickers` 는 목록 선택(카드·목록 핀·오버레이 핀)만 센다 — `POST_SELECTION_SECTIONS` 제외, 노출은 그대로」 를 더한다.

## Out of Scope

- `collection_shared` — 공유 기능이 없다(S3-4b 뒤 S3-6a 에서). `directions_clicked` — 이번 `MAP_LINK` 는 지도 열기이지 길찾기 개시가 아니다.
- 오버레이 토글 자체 — 지도 레이어이지 목록 질의가 아니다. 오버레이 사용은 `MAP_OVERLAY` 핀 CLICK 으로만 남는다(세려면 Q13).
- 뽑기(`PlacePage.tsx:964-979`, `useQuery` 밖 직접 호출)와 「이곳 보기」(상세 이동) — 검색도 결과 선택도 아니다.
- 같은 검색어 재제출 — `query` 가 안 바뀌어 SEARCH 가 없다.
- 가운데 클릭(`auxclick`). 찜의 신규 저장 vs 멱등 재응답 구분.
- 비관광지 찜 매핑(PRODUCT·GAME·BLOG_POST) — 호출처가 없고 소비자 쪽 섹션 제외가 먼저다.
- `EventAction`·`EntityType` 추가(FILTER·SAVE), Kafka 소비자 ErrorHandlingDeserializer, `common` 변경(`AnalyticsEvent.kt`·`Placement.kt` 주석·`V005` 주석 갱신 포함).
- 상세 화면의 다른 계측 보강, 통합 검색·지역 페이지 변경, 광고 경로.
- `/privacy` §2 에 검색어 행이 없는 것(보고만), `occurredAt` 클램프·이 라우트의 레이트리밋·`ExperimentAssignmentFilter` 의 클라이언트 `X-User-Id` 신뢰(보고만).
- `EventRepositoryAdapter.queryExperimentMetrics` 의 깨진 `event_type` 조회(보고만), ClickHouse 중복 제거 엔진 전환, 게이트웨이 visitor 덮어쓰기.

## Open Questions

- pre-impl 미결: 없음(`context/open-questions.yml` Q1~Q4 는 가정으로 닫음, 리뷰 1라운드 결정은 Q11, 2라운드 결정은 `context/review-verdict-round2.md` §2).
- post-impl: Q5 소비자 ErrorHandlingDeserializer, Q6 깨진 실험 지표 쿼리, Q7 Streams 키워드 브랜치를 `entityType==SEARCH` 면 `entityId` 로 키 잡고 빈 키워드는 건너뛰게, Q8 `common`·`Placement.kt:13`·`V005` 주석의 「(viewId, entityId) 1회」·「목록 화면이면 빈 문자열」 갱신, Q9 회원 귀속이 필요해지면 라우트를 `GatewayRouteConfig` 로 옮겨 인증 필터(required=false), Q10 place glossary 생성 + `trigger`·`changed`·`term`·`MAP_LINK`·`FAVORITE`·`MAP_OVERLAY`·`place-hub` 등재 + wishlist glossary 의 `Favorite` Avoid 해소, Q12 범위 밖 보안 보고 4건, Q13 오버레이 토글을 셀 것인가 — 어느 viewId·어느 섹션·idle 재조회 중복 기준이 먼저 필요.
