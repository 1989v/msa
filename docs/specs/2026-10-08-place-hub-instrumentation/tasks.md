# Task Breakdown: place 허브 최소 행동 계측 (S1-12b)

## Overview
Total Task Groups: 6

- 작업 트리: `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl` (branch `place-stage2`, origin/main `8a61f0b`). 메인 트리는 건드리지 않는다. `portal-fe/node_modules` 는 심링크, `gifticon`·`auth` 는 로컬 클론 — `git add` 는 **경로 지정**(이 두 서브모듈 포인터·`M auth` 는 담지 않는다).
- 기준선: vitest 5파일 92 passed, Kotest `CollectEventItemTest` 3 · `ClickHouseAttractionPopularityAdapterTest` 4.
- 표준: `docs/standards/test-rules.md`(Kotest BehaviorSpec + MockK, 테스트는 대상의 산출물을 본다), `docs/conventions/kotlin-style.md` §1(최소 수정 — 태스크에 필요한 라인만), `docs/conventions/package-structure.md`(application 은 infrastructure 를 import 하지 않는다 — 상수는 use case companion, 어댑터가 읽는다), `docs/conventions/logging.md`. 루트 CLAUDE.md: 「검사가 스스로 만든 근거는 근거가 아니다」·「회귀를 주입해 빨간불을 본 뒤에만 켰다」.
- 실행 방식: TG5(서버)는 TG1~TG4(FE)와 파일이 겹치지 않아 **병렬**. FE 는 TG1 → TG2 → TG3 → TG4 순차. TG6 이 마지막.
- 구현자는 커밋하지 않는다 — 검증 증거(명령 + 결과 줄)를 보고하면 메인이 경로 지정 커밋.

---

### Task Group 1: FE 이벤트 타입·트래커 중복 키 (SR-6)
**Dependencies:** None
**Phase:** fe-foundation
**Required Skills:** TypeScript, vitest
- [ ] 1.0 Complete FE 타입·트래커
  - [ ] 1.1 `portal-fe/src/analytics/__tests__/tracker.test.ts` 에 4개 테스트: ① 같은 대상·같은 action·다른 `sectionId` 두 건이 모두 큐에 남는다 ② 같은 섹션은 한 번 ③ `PageItem`(`entityType:'PAGE'`, `sectionId` 없음)이 큐에 들어가고 큐의 이벤트 객체에 `sectionId` 키가 없다(문자열 `'undefined'` 가 키에 박히지 않음 — `pendingForTest()` 로 본다) ④ `// @ts-expect-error — 목록 대상은 sectionId 필수` 로 `track('CLICK', { entityType:'ATTRACTION', entityId:'1', screenType:'PLACE_HUB' }, 'v')` 한 줄(PAGE+sectionId 둘째 줄은 넣지 않는다 — 기준선에서 Unused)
  - [ ] 1.2 `events.ts`: `SectionId` 에 `MAP_LINK`·`FAVORITE`(주석 「선택 뒤 후속 행동 — 관심 신호가 아니라 인기 집계에서 뺀다. 노출을 보내지 않는다. 서버 `AggregateAttractionPopularityUseCase.POST_SELECTION_SECTIONS` 와 한 몸」)·`MAP_OVERLAY`(주석 「지도 레이어 핀 — 노출 없는 클릭, 인기 집계 포함」); `EventAction` 에 `SESSION_START`; `TrackedItem` 을 `PlacedItem | PageItem` 판별 합집합으로 — `PlacedItem` 은 지금 interface 그대로(이름만), `PageItem` 은 `{ entityType:'PAGE'; entityId; screenType; screenRef?; sectionId?: never; sectionIndex?: never; itemIndex?: never; payload? }`; `TrackedEvent` 는 `TrackedItem & { action: EventAction; viewId: string; occurredAt: number }` 타입 별칭(선례 `src/api/shopApi.ts:110-111`)
  - [ ] 1.3 `tracker.ts`: `keyOf` 를 `` `${e.viewId}|${e.entityType}|${e.entityId}|${e.sectionId ?? ''}|${e.action}` `` 로, `:20` 주석을 「같은 (viewId, entityType, entityId, sectionId, action) 은 한 번만」으로. `track`·`useImpression`·`TrackedLink` 시그니처 불변
  - [ ] 1.4 Verify: `cd portal-fe && npx vitest run src/analytics/__tests__/tracker.test.ts && npx tsc -b`
**Acceptance Criteria:**
- tracker 테스트 14건(기존 10 + 4) 통과, `tsc -b` exit 0
- `git status` 변경 파일이 `events.ts`·`tracker.ts`·`tracker.test.ts` 셋뿐(기존 호출처 수정 0 — `entityType:'PAGE'` 기존 호출처 0건)

---

### Task Group 2: 찜 훅·버튼 계측 (SR-5)
**Dependencies:** Task Group 1
**Phase:** fe-favorite
**Required Skills:** React, @tanstack/react-query, vitest
- [ ] 2.0 Complete 찜 계측
  - [ ] 2.1 `portal-fe/src/components/favorite/__tests__/FavoriteButton.test.tsx` 에 `vi.mock('../../../analytics/tracker', …track: vi.fn())` 를 두고 7개 테스트: ① 로그인 + `tracking` prop + `addFavorite` 성공 → `track('CLICK', { entityType:'ATTRACTION', entityId: targetKey, screenType, screenRef, sectionId:'FAVORITE', payload:{ saved:true } }, viewId)` 정확히 1회 ② 이미 찜(`fetchFavoriteKeys` → [targetKey]) → `removeFavorite` 성공 → `saved:false` ③ `addFavorite` reject(롤백) → track 0 ④ 게스트 → track 0 ⑤ `tracking` 없음 → track 0 ⑥ 마운트·토글 어느 시점에도 `track('IMPRESSION', …)` 0 ⑦ pending(해결 안 된 promise) 동안 0, resolve 뒤 1 — `type` 은 `ATTRACTION` 으로 돌린다
  - [ ] 2.2 `useFavorites(type, tracking?)`: `mutationFn` 이 요청 종류를 반환(`{ saved: boolean }` — 추가면 true, 삭제면 false; 캐시 재독 금지), `onSuccess: (result, targetKey) => tracking && type === 'ATTRACTION' && track('CLICK', { entityType:'ATTRACTION', entityId: targetKey, screenType: tracking.screenType, screenRef: tracking.screenRef, sectionId:'FAVORITE', payload:{ saved: result.saved } }, tracking.viewId)`. `onMutate`·`onError`·`onSettled` 불변. 다른 `type` 은 계측하지 않는다(Out of Scope)
  - [ ] 2.3 `FavoriteButton` 에 선택 prop `tracking?: { screenType: ScreenType; screenRef?: string; viewId: string }` → `useFavorites(type, tracking)`. 다른 호출처(블로그·게임·상점) 변경 없음
  - [ ] 2.4 Verify: `cd portal-fe && npx vitest run src/components/favorite/__tests__/FavoriteButton.test.tsx && npx tsc -b`
**Acceptance Criteria:**
- FavoriteButton 테스트 13건(기존 6 + 7) 통과
- `grep -rn 'FavoriteButton' portal-fe/src --include='*.tsx' -l` 의 비-place 호출처 diff 0

---

### Task Group 3: 허브·상세 화면 계측 (SR-1 ~ SR-4, SR-9.1 mock 테스트)
**Dependencies:** Task Group 1, Task Group 2
**Phase:** fe-hub
**Required Skills:** React, vitest, fake timers, IntersectionObserver 대역(`src/components/ads/__tests__/adsTestKit.ts` `installIntersectionObserver`)
- [ ] 3.0 Complete 허브 계측
  - [ ] 3.1 `PlacePage.test.tsx` 에 `track` mock(`RegionPage.test.tsx:13-19` 패턴)과 `tracking` prop 을 드러내는 `FavoriteButton` 대역(`({ targetKey, tracking }) => <button data-testid="fav" data-key={targetKey} data-view={tracking?.viewId} data-ref={tracking?.screenRef} />`)을 두고 테스트(핵심 행동만, 약 20개):
    - 세션: 첫 마운트 `SESSION_START` 1회 `{ entityType:'PAGE', entityId:'place-hub', screenType:'PLACE_HUB', screenRef:'' }` + `sectionId` 키 없음; 언마운트 뒤 재마운트 0; `sessionStorage.clear()` + `resetPlaceSessionForTest()` 뒤 다시 1; `sessionStorage.setItem` 이 throw 해도 1회(모듈 변수 폴백)
    - SEARCH 경계: `initial`(자동 시도 선택 서울 `'11'`) → `{ entityType:'SEARCH', entityId:'*', screenType:'PLACE_HUB', screenRef:'11', sectionId:'ATTRACTION_LIST', payload:{ trigger:'initial', term:'', sido:'11', total:6, page:0 } }` 이고 payload 에 `keyword`·`lat`·`lng`·`geo` 키 없음; `landing`(`fetchAdministrativeRegions` → `[]` 라 `pickingRegion` false) → `trigger:'landing'`·`entityId:'*'`; `submit`(검색어 입력 + Enter, `runKeywordSearch`) → `trigger:'submit'`·`term`; `suggestion`(`suggestPlaces` 응답 클릭) → SEARCH `trigger:'suggestion'` 1건 + CLICK 0; `nearMe`(geolocation stub) → `radiusKm:5` 만, 좌표 키 없음; `region`(구 축 `<select>`, `hasRegionAxis` false) → `changed:['areaCode']`; 시군구 선택(시도 `'11'` + 시군구 `'110'`) → `screenRef:'11110'`; 분류 칩 → `trigger:'category'`·`changed` 에 `category`·`listEventStatus`·`page`; 속성 칩 → `trigger:'attribute'`; 행사 상태 칩 → `trigger:'eventStatus'`; 데스크톱 다음 쪽 → `trigger:'page'`; 언어 전환 → `trigger:'lang'`·`changed:['lang']`; 0건 응답도 SEARCH; 같은 응답 재렌더에 같은 viewId 재발화 없음; 검색 실패(`searchAttractions` reject ×4, fake timers 로 1+2+4초 진행) → SEARCH 0; 오버레이 칩 토글 → SEARCH 0 + viewId 불변; **공통 afterEach 게이트**: `track` 호출 중 `action==='SEARCH'` 인 것의 `payload.trigger` 가 `'other'` 인 건이 하나라도 있으면 실패
    - CLICK: 카드 클릭 → `{ entityType:'ATTRACTION', entityId, screenType:'PLACE_HUB', screenRef: 같은 view 의 SEARCH 와 같은 값, sectionId:'ATTRACTION_LIST', itemIndex, payload:{ source:'card' } }` + viewId == SEARCH 의 셋째 인자; `fireEvent.click(card, { metaKey:true })` 반환 `true`(기본 동작 유지) + CLICK `payload.newTab:true`; 패널 지도 링크 클릭 → `{ sectionId:'MAP_LINK', payload:{ kind:'google_maps_search' } }` + `defaultPrevented` false
    - IMPRESSION: `installIntersectionObserver()` + `vi.useFakeTimers({ toFake:['setTimeout','clearTimeout'] })` → 결과 도착 뒤 `show(1)` + `advance(DWELL_MS)` → 카드마다 `{ sectionId:'ATTRACTION_LIST', itemIndex }`; 카드 클릭으로 패널을 연 뒤 `show(1)`+`advance` 한 번 더 → IMPRESSION 호출 전부 `sectionId==='ATTRACTION_LIST'`(`MAP_LINK`·`FAVORITE` 0)
    - 찜 배선: 카드·패널 대역의 `data-view` == SEARCH viewId, `data-ref` == SEARCH `screenRef`
    - `AttractionPage.test.tsx`: 지도 링크 클릭 → `{ screenType:'ATTRACTION_DETAIL', screenRef: id, sectionId:'MAP_LINK', payload:{ kind:'google_maps_search' } }`; FavoriteButton 대역 `data-view` == 페이지 viewId(이미 `newViewId` 를 쓰는 페이지 — 대역은 이 파일의 기존 mock 구조를 따른다)
  - [ ] 3.2 `PlacePage.tsx` 기반: `const viewId = useMemo(() => newViewId(), [query])` + `viewIdRef`; `useEffect(installFlushOnLeave, [])`; `SESSION_START` effect(마운트 1회, sessionStorage 플래그 `kgd.place.sessionStarted`, 저장소 실패 시 모듈 변수, `export function resetPlaceSessionForTest()`); `screenRef` 계산 `sidoCode ? sidoCode + (sigunguCode ?? '') : ''` + ref
  - [ ] 3.3 SEARCH: `triggerRef`/`changedRef` 를 SR-2.3 의 핸들러 전부에 심는다 — `runKeywordSearch`(submit) · `pickSuggestion`(suggestion, `:840` early return 뒤) · `searchThisArea`(area) · `nearMe`(nearMe) · `selectRegion` 에 `trigger` 인자(자동 선택 `:458` 만 `'initial'`, 칩 `:1181`·시도 마커·`RegionSheet`·`RegionDrilldown` 은 `'region'`) · 구 축 `<select>`(`region`, `changed:['areaCode']`) · 분류 칩 전체/분류(`category`, `changed` 복수) · `toggleAttribute`(attribute) · 행사 상태 칩(eventStatus) · 쪽 넘김 4곳(page) · `switchLang`(lang, `:881` 가드 뒤). 결과 도착 effect(`[data, isError, viewId]`): `isError` 면 없음; 이 viewId 에 아직 안 보냈으면 `track('SEARCH', { entityType:'SEARCH', entityId: keyword || '*', screenType:'PLACE_HUB', screenRef, sectionId:'ATTRACTION_LIST', payload:{ trigger: ref ?? (첫 질의면 'landing' : 'other'), changed, term: keyword, category, attributes:[...attributes], sido: sidoCode, sigungu: sigunguCode, radiusKm: geo?.radiusKm, page, total: data.totalElements, correctedKeyword: data.correctedKeyword } }, viewId)` 뒤 ref 비움. 좌표·`keyword` 키 금지
  - [ ] 3.4 CLICK: `PlaceCard` 에 `viewId`·`screenRef`·`index` prop, `onClick` 에서 early return(`:1349`) **앞에** `track('CLICK', …, { source:'card', itemIndex, newTab: 수정키 여부 })`; 목록 핀 `:603` 과 오버레이 핀 `:727` 리스너는 `viewIdRef`·`screenRefRef` 로 읽어 `source:'map'`(오버레이는 `sectionId:'MAP_OVERLAY'`, `itemIndex` 없음); 패널 지도 링크 `:1317` 에 `onClick={() => track('CLICK', { …, sectionId:'MAP_LINK', payload:{ kind:'google_maps_search' } }, viewId)}`(기본 동작 유지); `FavoriteButton` 카드(`:1368`)·패널(`:1304`)에 `tracking={{ screenType:'PLACE_HUB', screenRef, viewId }}`
  - [ ] 3.5 `PlaceCard` 루트 `<a>` 에 `useImpression({ entityType:'ATTRACTION', entityId, screenType:'PLACE_HUB', screenRef, sectionId:'ATTRACTION_LIST', itemIndex }, viewId)` ref
  - [ ] 3.6 `AttractionPage.tsx`: 지도 링크(`:507-514`) `onClick` 에 `MAP_LINK` CLICK(`screenRef: id`); `FavoriteButton`(`:386`)에 `tracking={{ screenType:'ATTRACTION_DETAIL', screenRef: id, viewId }}`
  - [ ] 3.7 Verify: `cd portal-fe && npx vitest run src/pages/place/__tests__/PlacePage.test.tsx src/pages/place/__tests__/AttractionPage.test.tsx && npx tsc -b && npm run lint --if-present`
**Acceptance Criteria:**
- PlacePage 기존 16 + 신규 약 20, AttractionPage 기존 51 + 2 통과; `other` 게이트 통과
- 카드 링크·지도 링크의 기본 동작 불변(테스트의 `defaultPrevented`/반환값)
- `git status` 변경이 `PlacePage.tsx`·`AttractionPage.tsx`·두 테스트 파일뿐

---

### Task Group 4: 실제 트래커 통합 테스트 (SR-9.1 별도 파일, SR-1.2)
**Dependencies:** Task Group 3
**Phase:** fe-integration
**Required Skills:** vitest, jsdom beacon/Blob
- [ ] 4.0 Complete 통합 케이스
  - [ ] 4.1 `portal-fe/src/pages/place/__tests__/PlacePage.tracking.test.tsx` — tracker·FavoriteButton mock **없음**. 선행: `placeApi` mock(`searchAttractions`·`fetchAdministrativeRegions` → 서울 1건·`fetchAttraction`·`suggestPlaces`), `wishlistApi` mock(`fetchFavoriteKeys`·`addFavorite`·`removeFavorite` resolve), `document.cookie='portal_user_id=1; Path=/'`, 데스크톱 `matchMedia`, `beforeEach` 에 `resetTrackerForTest()`·`resetIdentityForTest()`·`resetPlaceSessionForTest()`, `fetch` stub. 4 케이스: ① initial SEARCH → 카드 클릭 → 패널 지도 링크 클릭 → 패널 찜 클릭(성공) → `pendingForTest()` 에 CLICK 3건의 `sectionId` 가 `ATTRACTION_LIST`·`MAP_LINK`·`FAVORITE` 이고 viewId 가 전부 같다(+ SESSION_START·SEARCH 도 큐에) ② `Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn(), configurable:true })` + `window.dispatchEvent(new Event('pagehide'))` → Blob 본문(`await blob.text()`)의 `events` 에 세 CLICK, 최상위 `visitorId`·`sessionId` ③ 처음부터 찜된 상태(`fetchFavoriteKeys` → [id]) 해제 → 찜 → FAVORITE CLICK **1건**(`saved:false`) ④ `saved` 두 방향은 다른 viewId: 찜(`saved:true`) → 검색 조건 변경(새 viewId) → 해제(`saved:false`) → 2건
  - [ ] 4.2 Verify: `cd portal-fe && npx vitest run src/pages/place/__tests__/PlacePage.tracking.test.tsx`
**Acceptance Criteria:**
- 4건 통과. 큐 길이 < 20 이라 `pendingForTest()` 에 남는다(자동 flush 안 됨)

---

### Task Group 5: 수집 서버·인기 집계 (SR-7, SR-8) — FE 와 병렬
**Dependencies:** None
**Phase:** server
**Required Skills:** Kotlin, Spring MVC(MockMvc standalone), Kotest BehaviorSpec, MockK
- [ ] 5.0 Complete analytics 서버
  - [ ] 5.1 테스트 먼저:
    - `CollectEventItemTest`: eventId == `"v1:SEARCH:하이브리드 검색:SEARCH_GROUP:SEARCH"`; `entityType:"PAGE"`·`sectionId` 없음·`action:"SESSION_START"` 본문 → `"v1:PAGE:place-hub::SESSION_START"`
    - 신규 `analytics/app/src/test/kotlin/com/kgd/analytics/presentation/event/EventCollectControllerTest.kt`: `MockMvcBuilders.standaloneSetup(EventCollectController(collect)).setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build())).setControllerAdvice(com.kgd.common.exception.GlobalExceptionHandler()).build()`(선례 `order/feature/.../OrderSheetControllerTest.kt:48-50`, `search/app/.../AttractionSearchControllerTest.kt:22`), `collect` 는 `mockk<CollectEventsUseCase>()` + `slot<List<AnalyticsEvent>>()`. 비크롤러 케이스는 `header("User-Agent", "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130.0 Safari/537.36")`. 6 케이스: ① `X-Session-Id` 헤더 → 저장 이벤트 `sessionId` == 헤더, `accepted == 1` ② 헤더 없음 + beacon 모양 본문 `{"events":[…],"visitorId":"vx","sessionId":"sb"}` → 202, `sessionId == "sb"`, `visitorId == "anonymous"`(본문 `visitorId` 는 무시·거절 없음) ③ 둘 다 없음 → `sessionId == visitorId`(헤더 `X-Visitor-Id: v9` → `"v9"`) ④ `X-User-Id: 1` 이어도 `userId == null` ⑤ UA `HeadlessChrome` → 202 `accepted:0` + `verify(exactly = 0) { collect.collect(any()) }` ⑥ 101건 → 400(본문이 `ApiResponse` 실패 모양)
    - `ClickHouseAttractionPopularityAdapterTest`: `oneLine(insert)` 이 리터럴 `countIf(action = 'CLICK' AND section_id NOT IN ('MAP_LINK', 'FAVORITE'))` 과 `uniqStateIf(visitor_id, action = 'CLICK' AND section_id NOT IN ('MAP_LINK', 'FAVORITE') AND visitor_id != 'anonymous')` 를 포함, `countIf(action = 'IMPRESSION')` 에는 `NOT IN` 없음(정규식 또는 부분 문자열로), `AggregateAttractionPopularityUseCase.POST_SELECTION_SECTIONS shouldBe setOf("MAP_LINK", "FAVORITE")` 별도 — 기대값을 상수로 조립하지 않는다(기존 `ANONYMOUS_VISITOR` 보간 단언은 리터럴 `'anonymous'` 로 바꾼다)
  - [ ] 5.2 `EventCollectDtos.kt`: `CollectEventsRequest` 에 `@field:Size(max = 128) val sessionId: String? = null`; eventId `"$view:${entityType!!.name}:$entityId:${sectionId.orEmpty()}:${action!!.name}"`; KDoc(`:52`) 을 「(viewId, entityType, entityId, sectionId, action)」으로
  - [ ] 5.3 `EventCollectController.kt`: `sessionId = sessionHeader?.takeIf{…} ?: request.sessionId?.takeIf { it.isNotBlank() } ?: visitorId`; `userId` 는 `null` 고정(`X-User-Id` 읽기와 `USER_HEADER` 상수 삭제, KDoc 한 줄 「이 라우트는 인증 필터를 거치지 않아 클라이언트 값이라 읽지 않는다 — 회원 귀속은 Q9」)
  - [ ] 5.4 `AggregateAttractionPopularityUseCase.companion` 에 `val POST_SELECTION_SECTIONS: Set<String> = setOf("MAP_LINK", "FAVORITE")` + KDoc 「`clicks`·`unique_clickers` 는 목록 선택(카드·목록 핀·오버레이 핀)만 센다 — 이 집합은 제외, 노출은 그대로. FE `events.ts` 의 같은 이름 주석과 한 몸」; 어댑터 `INSERT_DAY` 를 `private val` 로 내리고 `private val EXCLUDED = POST_SELECTION_SECTIONS.joinToString { "'$it'" }` 보간 — `countIf(action = 'CLICK' AND section_id NOT IN ($EXCLUDED))`, `uniqStateIf(visitor_id, action = 'CLICK' AND section_id NOT IN ($EXCLUDED) AND visitor_id != '${ANONYMOUS_VISITOR}')`
  - [ ] 5.5 Verify: `./gradlew :analytics:app:test --tests '*CollectEventItemTest' --tests '*EventCollectControllerTest' --tests '*ClickHouseAttractionPopularityAdapterTest' --offline -q` + `build/test-results/test/*.xml` 의 tests/failures 수
**Acceptance Criteria:**
- CollectEventItemTest 5(기존 3+2), EventCollectControllerTest 6, Adapter 6(기존 4 수정 + 2) 통과, failures 0
- `git status` 변경이 analytics 4파일 + 테스트 3파일뿐. `common` 변경 0

---

### Task Group 6: 문서·회귀 주입·통합 검증
**Dependencies:** Task Group 1~5
**Phase:** verify
**Required Skills:** git, vitest, gradle
- [ ] 6.0 Complete 검증
  - [ ] 6.1 `docs/adr/ADR-0095-impression-click-pipeline.md`: `:63` screen_ref 행에 「목록 화면은 비우되, 지역을 축으로 고른 목록(허브·지역 허브)은 그 지역 코드」, `:83` 「같은 `view_id` + `entity_id` + `section_id` 는 노출 1회」, `:140` 「(view_id, entity_id, section_id) 로 1회만」, §6(`:106` 절)에 「`clicks`·`unique_clickers` 는 목록 선택(카드·목록 핀·오버레이 핀)만 센다 — `POST_SELECTION_SECTIONS`(MAP_LINK·FAVORITE) 제외, 노출은 그대로」 한 줄. `common` 주석은 건드리지 않는다(Q8)
  - [ ] 6.2 회귀 주입 12건 — 하나씩 임시 적용 → 지정 테스트 **빨간불** 확인 → `git checkout -- <파일>` 로 되돌림 → 초록 재확인. 결과를 `docs/specs/2026-10-08-place-hub-instrumentation/verifications/regression-injection.md` 표(주입 · 명령 · 실패한 테스트 이름 · 되돌림 뒤 `git diff --stat` 빈 줄)로: ① SEARCH `track` 제거 ② 패널 `FavoriteButton` 의 `tracking` prop 제거 ③ 카드 `useImpression` ref 제거 ④ 어댑터 `NOT IN` 절 제거(countIf·uniqStateIf 각각) ⑤ `POST_SELECTION_SECTIONS = emptySet()` ⑥ 본문 `sessionId` 분기 제거 ⑦ `keyOf` 의 `sectionId` 제거 ⑧ payload 에 `keyword: keyword` 추가 ⑨ `runKeywordSearch` 의 ref 심기 제거(submit 케이스 + `other` 게이트 둘 다 빨강) ⑩ 허브 지도 링크를 `TrackedLink` 로 교체 ⑪ `PlacedItem.sectionId` 를 `sectionId?: SectionId` 로(Unused `@ts-expect-error` 로 `tsc -b` 빨강) ⑫ `screenRef` 합성에서 시도 접두 제거
  - [ ] 6.3 통합: `cd portal-fe && npx vitest run src/analytics src/components/favorite src/pages/place && npx tsc -b` · `./gradlew :analytics:app:test --tests '*CollectEventItemTest' --tests '*EventCollectControllerTest' --tests '*ClickHouseAttractionPopularityAdapterTest' --offline -q` · `git status --short` 가 의도한 파일만
  - [ ] 6.4 Verify: 위 세 명령의 결과 줄 + `regression-injection.md` 12행
**Acceptance Criteria:**
- 12/12 주입이 빨간불 → 되돌림 뒤 초록
- 통합 명령 전부 exit 0, 변경 파일 목록이 스펙 범위(FE 7 + analytics 7 + ADR 1 + verifications 1)

## Execution Order
1. Task Group 1 (FE 타입·트래커) ‖ Task Group 5 (서버) — 병렬
2. Task Group 2 (찜) — TG1 뒤
3. Task Group 3 (허브·상세) — TG2 뒤
4. Task Group 4 (통합 테스트) — TG3 뒤
5. Task Group 6 (문서·주입·통합) — 전부 뒤
