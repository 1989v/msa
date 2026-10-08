# 테스트 전략 — place 허브 최소 행동 계측

| 수준 | 시나리오 | critical |
|---|---|---|
| unit (vitest) | `PlacePage`: 결과 도착 시 SEARCH 1건(payload.trigger·changed·term·total, `keyword`·좌표 없음), 필터 토글 → 새 viewId + SEARCH(trigger=attribute), 카드 onSelect → CLICK(source=card, itemIndex), 지도 링크 클릭 → CLICK(section MAP_LINK), 세션 시작 1회(두 번 마운트해도 1회) | ✔ |
| unit (vitest) | `useFavorites`/`FavoriteButton`: 서버 성공 뒤에만 CLICK(section FAVORITE, saved true/false), 실패·롤백 시 미발화, tracking prop 없으면 미발화 | ✔ |
| unit (vitest) | `AttractionPage` 지도 링크 CLICK(section MAP_LINK) | |
| unit (Kotest) | `CollectEventItem.toEvent` eventId 에 entityType·sectionId 포함; 세션 폴백은 컨트롤러 테스트(아래 2라운드 표) | ✔ |
| unit (Kotest) | `ClickHouseAttractionPopularityAdapter` 재집계 SQL 이 클릭에서 `MAP_LINK`·`FAVORITE` 를 제외, 노출은 포함 | ✔ |
| component | portal-fe `tsc -b` · vitest 전체(place·favorite·analytics 범위 지정), analytics `:analytics:app:test` 범위 지정 | ✔ |
| e2e (배포 후) | CDP(일반 UA)로 허브 검색·필터·카드 선택·지도 링크 → `/api/v1/events` 본문·202 accepted 기록; `ssh msa-oci` ClickHouse `screen_type='PLACE_HUB'` 행 확인 | ✔ |

회귀 주입으로 빨간불을 본 뒤에만 「켰다」고 한다: 예) `PlacePage` 의 SEARCH `track` 호출을 지우면 해당 테스트가 실패해야 한다.

## 리뷰 1라운드 반영 (2026-10-08)

| 수준 | 추가 시나리오 | critical |
|---|---|---|
| unit (vitest, **실제 트래커**) | 허브에서 카드 CLICK → 패널 지도 링크 CLICK(MAP_LINK) → 찜 CLICK(FAVORITE) 세 건이 모두 `pendingForTest()` 에 남는다 | ✔ |
| unit (vitest) | `tracker.test.ts`: 같은 대상·같은 action·다른 섹션은 둘 다 보낸다; 같은 섹션은 한 번 | ✔ |
| unit (vitest) | 카드 IMPRESSION(IntersectionObserver 대역 + fake timers), 세션 시작 격리(`sessionStorage.clear()`·초기화 함수·저장소 실패), SR-2 경계(0건·landing·initial·복수 changed·page·같은 viewId 재발화 없음·검색 실패 미발화·링크 기본 동작 유지), SR-5 미발화 3건(비로그인·pending·롤백)·saved 두 방향, 페이지 테스트의 FavoriteButton 대역이 `tracking` prop 을 드러내 3곳 배선 확인 | ✔ |
| unit (Kotest) | 컨트롤러 6케이스(헤더 세션 · 본문 세션 폴백 · 둘 다 없음 → visitorId · `X-User-Id: 1` 이어도 userId null · 크롤러 202/0 · 101건 400), eventId 에 섹션, 어댑터 SQL 이 `POST_SELECTION_SECTIONS` 를 클릭·고유 클릭자 둘 다에서 제외 | ✔ |
| e2e (배포 후) | 「보낸 건수 = 202 accepted = ClickHouse 행 수」 세 수 한 표, SR-10 질의 실행, 인기 재집계 SELECT 1회, 찜은 테스트 계정 없으면 미확인 | ✔ |

회귀 주입 6건(각 게이트 빨간불 1회): SEARCH track 제거 · 한 호출처 `tracking` prop 제거 · 카드 `useImpression` ref 제거 · 어댑터 제외 조건 제거(countIf·uniqStateIf) · 본문 `sessionId` 분기 제거 · 중복 키의 `sectionId` 제거.

## 리뷰 2라운드 반영 (2026-10-08)

| 수준 | 추가 시나리오 | critical |
|---|---|---|
| unit (vitest, 별도 파일 `PlacePage.tracking.test.tsx`) | tracker·FavoriteButton mock 없음. 선행 조건: `wishlistApi` mock + `portal_user_id` 쿠키 + `fetchAttraction` mock + 데스크톱 `matchMedia`, `beforeEach` 에 `resetTrackerForTest()`·`resetIdentityForTest()`. 카드 CLICK → 지도 링크 CLICK → 찜 CLICK 세 건이 같은 viewId 로 큐에 남고, `sendBeacon` stub + `pagehide` 로 본문에 세 건. 「해제(saved:false) → 찜(saved:true)」 은 1건만 | ✔ |
| unit (vitest) SR-2 추가 경계 | 금지 키 부정 단언(`term` 있음 · `keyword`·`lat`·`lng`·`geo` 없음 · `radiusKm` 만), `trigger` undefined 인 SEARCH 가 있으면 실패, 수정키 좌클릭 → 기본 동작 유지 + `newTab: true`, 자동완성 선택 → CLICK 미발화 + SEARCH `suggestion` 1건, landing `entityId:'*'`, 오버레이 토글 → SEARCH 미발화·viewId 불변, SESSION_START `screenRef:''`·`sectionId` 없음, FavoriteButton 대역의 `viewId` == 같은 화면 SEARCH 의 `viewId`, `saved` 두 방향은 서로 다른 viewId | ✔ |
| unit (Kotest) 컨트롤러 | standalone 에 `GlobalExceptionHandler` advice, 비크롤러 케이스는 사람 UA 헤더(없으면 `isCrawler(null)` 이 true 라 전부 202/0), `collect` 인자 `slot` 으로 `accepted == 1`·`sessionId`·`visitorId`·`userId` 단언, 크롤러는 UA `HeadlessChrome` + `verify(exactly = 0)`, 본문 세션 폴백은 beacon 모양 `{ events, visitorId, sessionId }` 그대로 → 202 | ✔ |
| unit (Kotest) 어댑터 | 리터럴 `section_id NOT IN ('MAP_LINK', 'FAVORITE')` 가 countIf·uniqStateIf 두 술어 안에 있음, `impressions` 의 countIf 에는 제외 없음, `POST_SELECTION_SECTIONS shouldBe setOf("MAP_LINK", "FAVORITE")` 별도 고정 — 기대값을 상수로 만들지 않는다 | ✔ |
| e2e (배포 후) | CDP 목록에 목록 핀 클릭(`ATTRACTION_LIST`/`source: map`)·오버레이 핀 클릭(`MAP_OVERLAY`) 추가 — `window.google.maps` 가 필요해 vitest 밖 | ✔ |

회귀 주입 8건으로 갱신: 1라운드 6건 + payload 에 `keyword: term` 추가 + `POST_SELECTION_SECTIONS` 를 `emptySet()` 으로(절 제거와 별개).

실행 메모: IMPRESSION 은 결과 도착 뒤 `vi.useFakeTimers({ toFake: ['setTimeout','clearTimeout'] })` + `advance(DWELL_MS)` 순서(react-query 타이머 주의). 검색 실패 케이스는 `useQuery` 의 `retry: 3`(`PlacePage.tsx:319`) 이 클라이언트 `retry:false` 를 덮으므로 지수 지연(1+2+4초)을 fake timers 로 넘겨야 `isError`.

## 리뷰 3라운드 반영 (2026-10-08, 심판 전건 MINOR)

| 수준 | 추가 시나리오 | critical |
|---|---|---|
| unit (vitest) SR-2 | `other` 금지 게이트(vitest 가 일으킨 SEARCH 에 `trigger==='other'` 가 있으면 실패 — `undefined` 게이트는 안전망 때문에 동어반복이라 대체), 트리거별 케이스 `submit`·`region`(구 축 select)·`category`(changed 복수)·`eventStatus`·`lang`, screenRef 합성 단언(`initial` → `'11'`, 시도 `'11'`+시군구 `'110'` → `'11110'`, 카드 CLICK 은 같은 값) | ✔ |
| unit (vitest) IMPRESSION | 카드 IMPRESSION 케이스에서 패널을 연 뒤 `show(1)`+`advance(DWELL_MS)` 한 번 더 → IMPRESSION 전부 `ATTRACTION_LIST`(`MAP_LINK`·`FAVORITE` 0건); `FavoriteButton.test.tsx` 에 track mock → IMPRESSION 0 | ✔ |
| component (`tsc -b`) | `tracker.test.ts` 에 `@ts-expect-error` 한 줄(목록 대상 sectionId 누락) — PAGE+sectionId 둘째 줄은 기준선에서 Unused 라 넣지 않는다 | ✔ |
| e2e (배포 후) | CDP 목록에 「이 지역 검색」(`trigger: area`) 추가; SR-10 「ref 누락 점검」 질의(`trigger='other'` 0건) 실행 | ✔ |

회귀 주입 12건으로 갱신: 2라운드 8건 + 핸들러 하나의 ref 제거 + 지도 링크 `TrackedLink` 교체 + `PlacedItem.sectionId` 선택화 + screenRef 합성 접두 제거.
