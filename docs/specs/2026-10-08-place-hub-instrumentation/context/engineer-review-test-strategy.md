# 테스트 전략 리뷰 — place 허브 최소 행동 계측

## 3라운드 (2026-10-08)

- 차원: test-strategy · 대상 트리: `wt-impl`(origin/main `8a61f0b`) · 대상 문서: 2라운드 개정 `spec.md`(SR-1~SR-10), `planning/test-quality.md`(「리뷰 2라운드 반영」 절), `planning/requirements.md`, `context/open-questions.yml`, `context/review-verdict-round2.md`(§2 상충 결정 5건은 확정 — 재론하지 않음).
- 경로는 레포 루트 기준. 스펙 앵커는 `spec.md` 의 SR 번호.

### Seed Discovery

| 단계 | 읽은 것 |
|---|---|
| 스펙 | 위 다섯 문서 + 2라운드·1라운드 원문(아래 절) |
| 표준 | `docs/standards/test-rules.md`, 전역 규칙 「검사가 스스로 만든 근거는 근거가 아니다」·「회귀를 주입해 빨간불을 본 뒤에만」, `.claude/hns-hooks.env:3-4`(커밋 전 컴파일 = portal-fe `tsc -b`) |
| 코드 | `portal-fe/src/analytics/{tracker,identity,events,useImpression}.ts`, `TrackedLink.tsx`, `components/favorite/{useFavorites.ts,FavoriteButton.tsx}`, `pages/place/PlacePage.tsx`(251-252, 283-285, 391-403, 417-469, 1192-1202, 1260-1266, 1304, 1317-1324, 1344-1352, 1368), `RegionPage.tsx:78,271-285`, `analytics/.../EventCollectController.kt:45-50`, `EventCollectDtos.kt:56-82`, `ClickHouseAttractionPopularityAdapter.kt:51-62`, `AggregateAttractionPopularityUseCase.kt:22-24`, `portal-fe/tsconfig.app.json:30`, `vitest.config.ts`, `package.json:58`(jsdom 25) |
| 기존 테스트 | `tracker.test.ts`, `PlacePage.test.tsx:7-71`, `RegionPage.test.tsx:13-24`, `AttractionPage.test.tsx:15,20`, `FavoriteButton.test.tsx:8-47`, `adsTestKit.ts:67-71,114-152`, `CollectEventItemTest.kt`, `ClickHouseAttractionPopularityAdapterTest.kt`, `src/test/setup.ts`(전역 스텁 없음) |
| KB | Bash 없이 `HNS_KB_PATH` 볼트 `wiki/` 직접 grep. 인용: [[gate-failure-modes]] (1989v 볼트, updated 2026-09-11) ⑥「검사가 0회 돈다」· 규율 1「회귀를 주입해 빨간불을 본 뒤에 켰다고 말한다」 |

### 2라운드 발견의 해소 판정

| # | 2라운드 | 판정 | 근거 |
|---|---|---|---|
| N-1 | `keyword`/`term` 이 문서 셋에서 갈리고 금지 키 부정 단언 없음 | **해소** | `test-quality.md:5` 「term·total, `keyword`·좌표 없음」, `requirements.md:25` 「필드명은 `term` 이고 `keyword` 를 넣지 않는다」(`:14` 와 일치). SR-9.1 「`term` 있음·`keyword` 없음, `nearMe` geolocation stub 뒤 `lat`·`lng`·`geo` 없음·`radiusKm` 만」, SR-9.3 주입 ⑧ `keyword: term` |
| N-2 | 실제 트래커 통합 케이스가 호이스트된 `vi.mock` 과 충돌 | **해소** | SR-9.1 별도 파일 `PlacePage.tracking.test.tsx`(tracker·FavoriteButton mock 없음, `wishlistApi` mock + `portal_user_id` 쿠키 + `fetchAttraction` mock + 데스크톱 `matchMedia`, `beforeEach` 초기화 둘), `requirements.md:43` 예외, `test-quality.md:31`. 선행 조건이 실제 경로를 살리는지는 아래 「부모 지목 확인 ①」 |
| N-3 | MockMvc UA 부재로 컨트롤러 6케이스가 0회 검사 | **해소** | SR-9.2 「비크롤러 5케이스는 사람 UA — 없으면 `isCrawler(null)` 이 true」, `slot` 으로 `accepted == 1`·`sessionId`·`visitorId`·`userId`, 크롤러 `HeadlessChrome` + `verify(exactly = 0)`, 본문 폴백은 beacon 모양 그대로 → 202. `test-quality.md:33` |
| N-4 | 어댑터 기대값이 프로덕션 상수에서 옴 | **해소** | SR-8.2 「어댑터 테스트는 상수로 기대값을 만들지 않는다 — 리터럴 `section_id NOT IN ('MAP_LINK', 'FAVORITE')` 가 두 술어 안, `impressions` 에는 제외 없음, `POST_SELECTION_SECTIONS shouldBe setOf(...)` 별도 고정」, SR-9.3 주입 ⑤ `emptySet()`(절 제거와 별개). `test-quality.md:34` |
| N-5 | AC 잔여 5건(수정키·자동완성·핀·`'*'`·SESSION_START screenRef) | **해소** | SR-9.1 「`fireEvent.click(card, { metaKey: true })` 반환 `true` + `newTab: true`」·「자동완성 선택 → CLICK 미호출, SEARCH `suggestion` 1건」·「landing 케이스에 `entityId:'*'`」·「SESSION_START `screenRef: ''`·`sectionId` 없음」(SR-1.3 이 값을 고정), SR-9.4 목록 핀·오버레이 핀 CDP. `test-quality.md:32,35` |
| N-6 | `saved` 둘째 방향 유실을 mock 이 못 봄 | **해소** | SR-5.4 「같은 view 의 이후 토글은 `saved` 와 무관하게 중복 키에 걸려 가지 않는다 … 처음부터 찜된 채 해제 → 찜이면 찜 완료 0」, SR-9.1 「해제(`saved:false`) → 찜(`saved:true`)은 `pendingForTest()` 에 한 건」 + 「`saved` 두 방향은 서로 다른 viewId」. `test-quality.md:31-32` |
| N-7 | `requirements.md` 의 개정 전 결정이 기대값을 가름 | **해소** | `:13` 「`screenRef:''` — 섹션 없음(`PageItem`)」, `:15` 「`screenRef: SR-2.1 의 지역 코드`」, `:19` `MAP_OVERLAY` 포함, `:51` 「(entityType, entityId, sectionId, action)」, `:25` `term`. 다섯 줄 전부 `spec.md` 와 같다 |
| N-8 | 실행 함정 메모(IMPRESSION fake timers 순서, `retry: 3`) | **반영** | SR-9.1 끝 「실행 메모」, `test-quality.md:39` |
| R-1 잔여 | 대역이 받은 `viewId` == 같은 화면 SEARCH 의 `viewId` | **해소** | SR-9.1 「FavoriteButton 대역이 받은 `viewId` 가 같은 화면 SEARCH 의 `viewId` 와 같은 값」, `test-quality.md:32` |

2라운드 8건 + 잔여 1건 전부 해소. 미해소 0.

### 부모 지목 확인

**① `PlacePage.tracking.test.tsx` 의 선행 조건이 실제 트래커 경로를 살리는가 — 산다.**
- `resetTrackerForTest`(`tracker.ts:109-116`: 큐·`seen`·타이머 초기화)와 `resetIdentityForTest`(`identity.ts:64-67`)는 **현재 코드에 있다** — 스펙이 신설을 요구하지 않고 그대로 쓴다. `pendingForTest`(`tracker.ts:119-121`)는 큐 사본.
- 큐가 남는 조건: `FLUSH_SIZE` 20(`tracker.ts:12`) 미만 — 통합 케이스의 이벤트는 SESSION_START 1 + SEARCH 1 + CLICK 3 = 5 이고 IO 가 없어 IMPRESSION 은 0(`useImpression.ts:51` 조기 반환). 5초 타이머(`:14`)는 `beforeEach` 초기화가 지운다.
- 떠남 경로: `installFlushOnLeave`(`tracker.ts:94-106`)가 `pagehide` → `flush(true)` → `navigator.sendBeacon` 이 있으면 `{ events, visitorId, sessionId }` Blob(`:63-71`). **허브에는 이 설치가 아직 없다**(`PlacePage.tsx` 에 `installFlushOnLeave` 0건) — SR-1.2 가 신설하고, 통합 케이스의 `pagehide` 단언이 그 설치를 빨갛게 하는 유일한 검사다.
- 찜 경로: `isLoggedIn()`(`useFavorites.ts:16`) 은 `portal_user_id` 표시 쿠키(`FavoriteButton.test.tsx:33-38`), `addFavorite`/`fetchFavoriteKeys` 는 `wishlistApi` mock(`:8-13`). 데스크톱이면 `aside.place-detail`(`PlacePage.tsx:1260-1266`)에 지도 링크(`:1317-1324`)와 찜(`:1304`)이 있고 `selected` 는 `fetchAttraction` mock 으로 그려진다.
- 실행 함정 둘(판정에 영향 없음, 아래 메모 ①②): `tracker.test.ts:104` 꼴 `vi.stubGlobal('navigator', { sendBeacon })` 은 navigator 전체를 바꿔 `navigator.geolocation` 분기(`PlacePage.tsx:460, 873`)를 지나간다 — `Object.defineProperty(navigator, 'sendBeacon', …)` 로. beacon 본문은 Blob 이라 jsdom 25 에서 `FileReader.readAsText` 로 읽는다.

**② 회귀 주입 8건 ↔ 빨개지는 테스트 — 전부 대응이 성립한다.**

| # | 주입(SR-9.3) | 빨개지는 테스트 | 왜 |
|---|---|---|---|
| ① | SEARCH `track` 제거 | `PlacePage.test.tsx` SEARCH 1건(`test-quality.md:5`) | mock 호출 0 |
| ② | 한 호출처 `tracking` prop 제거 | FavoriteButton 대역 3곳 배선 — 카드·패널은 `PlacePage.test.tsx:14` 대역, 상세는 `AttractionPage.test.tsx:15` 대역(`test-quality.md:21`) | 대역이 드러낸 prop 이 null |
| ③ | 카드 `useImpression` ref 제거 | 카드 IMPRESSION(IO 대역 `adsTestKit.ts:114-152` `show(1)` + `advance(DWELL_MS)`) | 관찰 대상이 없어 콜백 0회 |
| ④ | 제외 절 제거(countIf / uniqStateIf 각각) | 어댑터 리터럴 두 술어 `shouldContain` 각각(`test-quality.md:34`) | 한쪽만 지워도 그쪽 단언 실패 |
| ⑤ | `POST_SELECTION_SECTIONS = emptySet()` | `shouldBe setOf(...)` 별도 고정 + 보간 결과가 `NOT IN ()` 이라 리터럴 단언도 | 둘 다 실패 |
| ⑥ | 본문 `sessionId` 분기 제거 | 컨트롤러 「본문 세션 폴백」(`test-quality.md:33`) | `sessionId` 가 본문 값 대신 `anonymous`(`EventCollectController.kt:48-49`) |
| ⑦ | 중복 키의 `sectionId` 제거 | `tracker.test.ts` 「같은 대상·다른 섹션 둘 다」(`test-quality.md:20`) + `PlacePage.tracking.test.tsx` 세 건(`:31`) | `tracker.ts:23-25` 키로 되돌아가 둘째·셋째 CLICK 이 `seen` 에 걸림 |
| ⑧ | payload `keyword: term` 추가 | SEARCH 금지 키 `not.toHaveProperty('keyword')`(`test-quality.md:32`) | 키 존재 |

**③ SR-10 질의 두 벌이 e2e 에서 실행되는가 — 실행된다.** SR-9.4 「SR-10 질의와 인기 재집계 `SELECT` 를 ClickHouse 에서 한 번 실행한다」, `test-quality.md:23` 「SR-10 질의 실행, 인기 재집계 SELECT 1회」. CDP 목록(검색·필터·카드 선택·목록 핀·오버레이 핀·지도 링크)이 `result_view`·`selected`·`map_open` 을 전부 만들므로 두 질의(`spec.md:89-102`) 모두 0 이 아닌 행이 나온다. 다만 「실행」만 있고 기대값이 없다 — 메모 ③.

### 체크리스트 재판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | AC 마다 테스트 | 미흡(경미) | SR-4.2·SR-5.3 「IMPRESSION 을 보내지 않는다」·SR-2.1 `screenRef` 합성이 어느 수준에도 없다 → N3-2, N3-3 |
| 2 | 레이어 배정 | 통과 | 단위(track mock)·통합(실제 트래커 별도 파일)·컨트롤러(MockMvc)·어댑터(SQL 문자열)·타입(tsc)·배포 뒤(CDP + ClickHouse). 핀은 e2e 로 간다 |
| 3 | Mock 경계 | 통과 | N-2·N-3·N-4·N-6 해소. 통합 파일의 mock 목록이 명시됐다 |
| 4 | 테스트 데이터 전략 | 통과 | 초기화 함수 둘 실존, 쿠키·`wishlistApi`·`fetchAttraction` 픽스처 명시, `saved` 두 방향은 다른 viewId |
| 5 | 부정·경계 | 미흡(경미) | `trigger` undefined 게이트가 빨개질 수 없다 → N3-1. 타입 게이트 빨간불 증명 없음 → N3-4 |
| 6 | 네이밍 | 통과 | 변화 없음 |

---

### N3-1 — 「`trigger` 가 `undefined` 인 SEARCH 가 있으면 실패」 게이트는 빨개질 수 없다 (REVISE · 중)

- 스펙 결정: SR-2.3(`spec.md:32`) 「`other`(ref 가 비어 있는 채 결과가 도착한 경우의 안전망) … `trigger` 가 `undefined` 인 SEARCH 는 없다(SR-9.1 게이트)」. SR-9.1(`:67`) 「`trigger` 가 `undefined` 인 SEARCH 가 하나라도 있으면 실패」. `test-quality.md:32` 같은 문장.
- 왜 못 빨개지나: 안전망이 `undefined` 를 `other` 로 바꾼다. 핸들러 하나에 ref 심기를 빠뜨리는 **실제 회귀**는 `undefined` 가 아니라 `other` 를 낳고, 이 게이트는 그것을 통과시킨다. 안전망 자체를 지우는 주입도 테스트가 모르는 핸들러에서만 `undefined` 를 내므로 단위 테스트는 여전히 초록 — [[gate-failure-modes]] ⑥ 「검사가 0회 돈다」.
- 왜 중요한가: SR-10(`spec.md:84`) 은 `other` 를 검색 제출·필터 적용 건수에서 뺀다. ref 를 빠뜨린 핸들러의 SEARCH 는 **원장에 남되 기준선에서 조용히 사라진다** — Goal 의 「같은 정의로 전후 비교」가 핸들러 하나만큼 틀어진 채 초록이다.
- 수정안: ① 게이트 문장을 「vitest 가 만든 SEARCH 가운데 `trigger === 'other'` 인 것이 하나라도 있으면 실패」로 바꾼다 — 단위 테스트는 모든 질의를 아는 핸들러로 일으키므로 `other` 는 곧 ref 누락이다. ② 트리거별 케이스에 지금 없는 `submit`(`runKeywordSearch` `:854-859`)·`region`(구 축 `<select>` `:1072-1076`, `changed: ['areaCode']`)·`category`(분류 칩 `:1046-1050`, `changed` 복수)·`eventStatus`(`:1099-1102`)·`area`(`searchThisArea` `:861-870`, `mapMoved` 가 켜져야 버튼이 그려지므로 jsdom 에서 어려우면 e2e 로)·`lang`(`switchLang` `:880-884`) 을 한 줄씩 더한다. ③ 주입: 아무 핸들러 하나의 ref 심기를 지우면 그 트리거 케이스와 `other` 금지가 함께 빨간불.

### N3-2 — 「`MAP_LINK`·`FAVORITE` 로 IMPRESSION 을 보내지 않는다」가 어느 수준에도 없다 (REVISE · 중)

- 스펙 결정: SR-4.2(`spec.md:44`) 「`MAP_LINK` 로 IMPRESSION 을 보내지 않는다 — 노출을 동봉하는 `TrackedLink` 를 쓰지 않고 `onClick` 에서 `track` 만 부른다」, SR-5.3(`:49`) 「`FAVORITE` 로 IMPRESSION 을 보내지 않는다」. SR-9.1·`test-quality.md` 어디에도 이 부정 단언이 없다.
- 왜 중요한가: SR-8.1 은 노출 집계를 제외 없이 둔다(`ClickHouseAttractionPopularityAdapter.kt:55` `countIf(action = 'IMPRESSION')` — 개정 뒤에도 제외 없음이 단언 대상). 지역 페이지의 링크 선례는 `TrackedLink`(`RegionPage.tsx:271-285`)이고 그것은 `useImpression` 을 동봉한다(`TrackedLink.tsx:25`). 구현자가 선례를 따라 지도 링크를 `TrackedLink` 로 그리면 패널이 열릴 때마다 그 관광지의 `impressions` 가 한 행 늘고 — 클릭 제외로 막은 오염이 노출 쪽으로 새는데 — 계획된 테스트가 전부 초록이다.
- 수정안: 카드 IMPRESSION 케이스(IO 대역 + fake timers)에 이어서 카드 클릭으로 패널을 열고 `show(1)` + `advance(DWELL_MS)` 를 한 번 더 한 뒤, `track` mock 의 IMPRESSION 호출 전부가 `sectionId === 'ATTRACTION_LIST'` 임을 단언한다(`MAP_LINK`·`FAVORITE` 0건). `FavoriteButton.test.tsx` 에는 `track` mock 을 두고 「마운트·토글 어느 시점에도 IMPRESSION 호출 0」 한 줄. 주입: 지도 링크를 `TrackedLink` 로 바꾸면 빨간불.

### N3-3 — SR-2.1 `screenRef` 합성(시도+시군구)이 어느 수준에도 없다 (REVISE · 낮)

- 스펙 결정: SR-2.1(`spec.md:30`) 「시군구가 있으면 `시도코드+시군구코드`(지역 페이지의 `PLACE_REGION` 과 같은 체계)」. `test-quality.md:5` 의 SEARCH 단언 목록(trigger·changed·term·total)에 `screenRef` 가 없고 SR-9.1 에도 없다.
- 왜 갈리기 쉬운가: 허브 상태의 `sigunguCode` 는 **시도 접두를 뗀 값**이다(`PlacePage.tsx:402-403` `r.code.slice(2) === sigunguCode`). 지역 페이지의 `screenRef` 는 URL 의 전체 코드(`RegionPage.tsx:78,280`, 픽스처 `jongno.code = '11110'`, `RegionPage.test.tsx:24`). 구현이 `sigunguCode` 를 그대로 넣으면 `'110'`, 이어 붙이면 `'11110'` — 둘 다 테스트 없이 초록이고 「같은 체계」가 조용히 깨진다.
- 수정안: `initial` 케이스에 `screenRef: '11'`, 시군구 선택 케이스(`selectRegion` 에 `{ sidoCode:'11', sigunguCode:'110' }`)에 `screenRef: '11110'` 한 줄씩. 같은 값이 그 view 의 CLICK·IMPRESSION 에도 실리는지는 카드 CLICK 케이스에 `screenRef` 한 줄.

### N3-4 — SR-6.1 타입 게이트의 빨간불 증명이 없다 (REVISE · 낮)

- 스펙 결정: SR-6.1(`spec.md:53`) 「섹션을 빠뜨린 목록 호출처는 컴파일이 막는다(SR-8 이 거부 목록이라 빈 섹션 CLICK 은 집계에 들어간다)」. 심판 §2-④ 「선택화는 fail-open」. SR-9.3 주입 8건에 「`PlacedItem.sectionId` 선택화」가 없고, 그것을 빨갛게 할 줄이 어디에도 없다 — `portal-fe/src` 에 `@ts-expect-error` 0건.
- 왜 중요한가: 이 게이트는 테스트가 아니라 타입이라 **되돌려도 아무 테스트가 안 빨개진다**. 누가 편의로 `sectionId?: SectionId` 로 풀면 SR-8 의 거부 목록이 빈 섹션을 집계에 넣는 경로가 조용히 열린다 — [[gate-failure-modes]] 규율 1 「회귀를 주입해 빨간불을 본 뒤에 켰다고 말한다」.
- 수정안: `tracker.test.ts` 에 `// @ts-expect-error — 목록 대상은 sectionId 필수` 로 `track('CLICK', { entityType:'ATTRACTION', entityId:'1', screenType:'PLACE_HUB' }, 'v')` 한 줄, `// @ts-expect-error — PAGE 대상은 sectionId 를 못 가진다` 로 `{ entityType:'PAGE', entityId:'place-hub', screenType:'PLACE_HUB', sectionId:'ATTRACTION_LIST' }` 한 줄. `tsconfig.app.json:30` 이 `src` 전체를 포함하므로 `tsc -b`(커밋 전 훅 `compile-changed.sh`)가 본다. 주입: `sectionId` 를 선택화하면 「Unused '@ts-expect-error' directive」로 빨간불. SR-9.3 을 9건으로.

### 실행 메모 (정보)

1. `sendBeacon` 스텁은 `Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn(() => true), configurable: true })` — `tracker.test.ts:104` 의 전체 교체 꼴은 `navigator.geolocation` 분기(`PlacePage.tsx:460, 873`)를 바꾼다.
2. beacon 본문은 Blob(`tracker.ts:70`). jsdom 25(`package.json:58`)에서 `Blob.prototype.text()` 가 없을 수 있으니 `FileReader.readAsText` 로 읽는다. 단언은 「CLICK 세 건이 **포함**」이다 — 본문에는 SESSION_START·SEARCH 도 있다.
3. SR-10 e2e 는 「실행」만 적혀 있다. CDP 가 입력을 전부 알므로 기대값이 있다 — 선택률 질의의 안쪽 부질의에서 CDP 의 view_id 가 `result_view = 1, selected = 1`, 지도 열기 질의에서 클릭한 (view_id, entity_id) 가 `map_open = 1`. 세 수 표 옆에 이 두 행을 적으면 질의가 문법만이 아니라 뜻까지 검사된다.
4. 주입 목록 밖 게이트: SESSION_START 세션당 1회(플래그 검사 제거 → 「두 번 마운트해도 1회」 빨간불), `installFlushOnLeave` 설치(제거 → 통합 케이스 `pagehide` 단언 빨간불). 둘 다 테스트는 있으니 목록에 한 줄씩만.
5. `CollectEventItemTest` 「eventId 에 섹션」에 PAGE 대상(`sectionId` null) 한 건 — `v1:PAGE:place-hub::SESSION_START`(SR-7.3 `orEmpty()`). 빠지면 `null` 문자열이 박혀도 초록이다.
6. SR-5.2 「호출별 콜백은 언마운트 뒤 불리지 않는다」는 훅 안 `onSuccess` 를 고른 이유다. 그 차이를 보려면 「pending 중 언마운트 → resolve → CLICK 1건」 한 건이 필요하지만, 이번 Goal 에 필요한 AC 는 「성공 뒤에만」이고 그것은 있다 — 적어 두기만 한다.

### 최종

2라운드 8건(N-1~N-8)과 R-1 잔여는 개정 스펙·`test-quality.md`·`requirements.md` 에 전부 반영됐고, 부모가 지목한 셋 — 별도 파일의 선행 조건이 실제 트래커 경로를 살리는가(초기화 함수 둘 실존, 큐·beacon 경로 확인), 주입 8건이 각각 어느 테스트를 빨갛게 하는가(전부 대응), SR-10 질의가 e2e 에서 실행되는가(실행) — 도 성립한다. 새로 더한 넷은 「게이트가 빨개질 수 없다」(N3-1 `other` 안전망, N3-4 타입 게이트)와 「AC 가 어느 수준에도 없다」(N3-2 IMPRESSION 부정 단언, N3-3 `screenRef` 합성)뿐이고, 전부 단언 한두 줄 + 주입 한 건이라 스펙 재리뷰 없이 tasks 단계에서 반영할 수 있다. 사람 판단이 필요한 결정은 없다.

3라운드 판정: **REVISE** (2라운드 미해소 0 · 새 발견 4건 — 중 2 · 낮 2 · 실행 메모 6)

---

## 2라운드 (2026-10-08)

- 차원: test-strategy · 대상 트리: `wt-impl`(origin/main `8a61f0b`) · 대상 문서: 개정 `spec.md`(SR-1~SR-10), `planning/test-quality.md`(「리뷰 1라운드 반영」 절), `planning/requirements.md`, `context/open-questions.yml`(Q11).
- 경로는 레포 루트 기준. 스펙 앵커는 `spec.md` 의 SR 번호.

### Seed Discovery

| 단계 | 읽은 것 |
|---|---|
| 스펙 | `spec.md`, `planning/test-quality.md`, `planning/requirements.md`, `context/open-questions.yml`, 1라운드 원문(아래 절) |
| 표준 | `docs/standards/test-rules.md`, `docs/standards/fe-visual-verification.md:197-205`(계측은 사람 UA + 보낸 수·저장 행 수 대조), 전역 규칙 「검사가 스스로 만든 근거는 근거가 아니다」·「회귀를 주입해 빨간불을 본 뒤에만」 |
| 코드 | `portal-fe/src/analytics/{tracker,identity,useImpression,events}.ts`, `components/favorite/{useFavorites.ts,FavoriteButton.tsx}`, `pages/place/PlacePage.tsx`(278-321, 449-475, 603, 727, 837-877, 1200-1202, 1260-1266, 1304, 1317-1324, 1344-1352, 1368), `AttractionPage.tsx:221-223, 507-514`, `auth/auth.ts:14,45`, `analytics/.../EventCollectController.kt`, `EventCollectDtos.kt`, `ClickHouseAttractionPopularityAdapter.kt`, `AnalyticsStreamTopology.kt:123-131`, `common/.../CrawlerUserAgents.kt:28,45` |
| 기존 테스트 | `analytics/__tests__/tracker.test.ts`, `favorite/__tests__/FavoriteButton.test.tsx`, `place/__tests__/{PlacePage,RegionPage,AttractionPage}.test.tsx`, `ads/__tests__/adsTestKit.ts:67-71,114-152`, `CollectEventItemTest.kt`, `ClickHouseAttractionPopularityAdapterTest.kt`, `search/.../AttractionSearchControllerTest.kt:17-23`, `portal-fe/vitest.config.ts`, `src/test/setup.ts` |
| KB | `kb-search.sh` 는 이 리뷰어에 Bash 가 없어 실행 불가 — `HNS_KB_PATH` 볼트 `wiki/` 를 직접 grep(1라운드와 같은 방법). 인용: [[gate-failure-modes]] (1989v 볼트, updated 2026-09-11) · [[anonymous-identity-headers]] (1989v, 2026-09-20) · [[frontend-visual-verification]] (1989v, 2026-09-10) · `wiki/index.md:326` 통합 검색 계측 기록(2026-09-20, 「계측은 보냈다가 아니라 저장된 행 수로 판정」) |

### 1라운드 발견의 해소 판정

| # | 1라운드 | 판정 | 근거 |
|---|---|---|---|
| B-1 | `track` mock 이 중복 키 접힘(지도 링크·찜 CLICK 유실)을 못 본다 | **해소** | SR-6.3 중복 키 `viewId\|entityType\|entityId\|sectionId\|action`, SR-3.4 불변식, SR-7.3 eventId 에 sectionId, SR-10 「중복 튜플에 section_id」, `requirements.md:23·37`, Q11(`open-questions.yml:53-57`). 검증은 SR-9.1 실제 트래커 통합 1건 + `tracker.test.ts` 「같은 대상·다른 섹션 둘 다」 + 회귀 주입 ⑥(SR-9.3). 선택지 (a) 그대로다 |
| R-1 | `FavoriteButton` null 대역이 배선 3곳을 가린다 | **해소** | SR-9.1 「대역이 `tracking` prop 을 드러내 허브 카드·패널·상세 세 배선 확인」, 주입 ②. 잔여 한 줄: 대역이 받은 `viewId` 가 같은 화면 SEARCH 의 세 번째 인자와 **같은 값**임을 단언하라고는 적혀 있지 않다 — 적는다 |
| R-2 | 카드 IMPRESSION 테스트 없음 | **해소** | SR-9.1 「카드 IMPRESSION(IntersectionObserver 대역 + fake timers)」, 주입 ③. 실행 함정은 N-8 |
| R-3 | 세션 폴백은 컨트롤러 테스트여야 | **해소** | SR-9.2 컨트롤러 6케이스(MockMvc standalone + MockK). SR-7.1 이 본문 `visitorId` 를 받지 않기로 해 1라운드 ④⑤ 는 소멸. 잔여는 N-3(UA 부재·beacon 본문) |
| R-4 | 세션 시작 격리 없음 | **해소** | SR-1.3 「테스트용 초기화 함수」, SR-9.1 「`sessionStorage.clear()` + 초기화 함수 + 저장소 실패」 |
| R-5 | SR-2 경계 8종 | **해소(부분)** | SR-9.1 에 0건·landing·initial·복수 changed·page·같은 viewId·링크 기본 동작·검색 실패 8종. geo 반올림은 SR-2.2 가 좌표를 **안 담기로** 해 소멸(그 자리에 부정 단언이 필요 — N-1). 「검색어 없음 → `'*'`」 는 이름으로 없다 — N-5 |
| R-6 | SR-5 부정 케이스 | **해소** | SR-9.1 미발화 3건 + `saved` 두 방향. BLOG_POST 매핑은 Out of Scope(`spec.md:99`)로 소멸. 잔여는 N-6(`saved` 둘째 방향이 트래커에서 떨어지는 것을 mock 이 못 본다) |
| R-7 | 회귀 주입 목록·배포 뒤 세 수 대조 | **해소** | SR-9.3 주입 6건(countIf·uniqStateIf 각각), SR-9.4 「보낸 건수 = 202 accepted = ClickHouse 행 수」 한 표 + SR-10 질의 + 재집계 SELECT 1회 + 찜 미확인. 잔여는 N-4(주입 ④ 의 형태) |

1라운드 8건은 전부 스펙에 반영됐다. 아래 새 발견은 반영된 문장이 **실제 테스트로 옮겨질 때** 걸리는 것들이다.

### 체크리스트 재판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | AC 마다 테스트 | 미흡(경미) | SR-3.1 `newTab`·자동완성 패널 미발화, SR-3.1 목록 핀·SR-3.2 오버레이 핀(어느 수준에도 없음), SR-2.1 `'*'` → N-5 |
| 2 | 레이어 배정 | 통과 | 컨트롤러(MockMvc)·DTO(단위)·어댑터(SQL 문자열)·훅·페이지·실제 트래커 통합·배포 뒤 CDP. 핀 클릭만 e2e 로 보내야 하는데 목록에 없다(N-5) |
| 3 | Mock 경계 | **미흡** | 실제 트래커 통합 케이스가 놓일 파일의 호이스트된 `vi.mock` 과 충돌 → N-2. 어댑터 기대값이 프로덕션 상수에서 온다 → N-4. `saved` 둘째 방향 → N-6 |
| 4 | 테스트 데이터 전략 | 통과 | 격리 함수·`sessionStorage.clear()`·기존 픽스처(`PlacePage.test.tsx:19-50`, `RegionPage.test.tsx:23`). 통합 파일의 로그인 쿠키·`wishlistApi` mock 은 N-2 에서 명시 |
| 5 | 부정·경계 | 미흡 | 금지 키(`keyword`·좌표) 부정 단언 없음 → N-1. beacon 본문 모양 → N-3. N-5 |
| 6 | 네이밍 | 통과 | 변화 없음 |

---

### N-1 — 검색어 payload 필드명이 문서 셋에서 갈리고, 금지 키 부정 단언이 없다 (REVISE · 높음)

- 스펙 결정: SR-2.2(`spec.md:31`) 「필드 이름은 `keyword` 가 아니라 `term` 이다 — Streams 키워드 지표가 `payload.keyword` 로 상품 키워드 점수를 만들므로」.
- 테스트 계획: `planning/test-quality.md:5` 「SEARCH 1건(payload.trigger·changed·**keyword**·total)」 — 개정 전 이름 그대로.
- 요구사항: `planning/requirements.md:14` 는 `term`, 같은 문서 `:25` 는 「허브 SEARCH payload 에 `keyword` 를 넣어 `"unknown"` 키로 떨어지지 않게 한다」 — 문서 안에서 반대다.
- 코드: `AnalyticsStreamTopology.kt:126-131` 은 `action == SEARCH` 전부를 `payload["keyword"]` 로 키 잡는다. 테스트가 `keyword` 를 단언하면 구현이 `keyword` 를 넣고, Goal 2(「허브 검색어가 상품 키워드 지표를 왜곡하지 않는다」)가 **초록인 채로** 깨진다.
- 수정안: ① `test-quality.md:5` `keyword` → `term`, `requirements.md:25` 를 `:14` 와 맞춘다. ② SEARCH 테스트 하나에 **금지 키 부정 단언**을 둔다 — `expect(payload).toHaveProperty('term')` + `expect(payload).not.toHaveProperty('keyword')`. 같은 테스트에 SR-2.2 「기기 좌표는 담지 않는다」도 — `navigator.geolocation.getCurrentPosition` 을 stub 해 `nearMe`(`PlacePage.tsx:872-877`)를 누른 뒤 payload 에 `lat`·`lng`·`geo` 가 없고 `radiusKm` 만 있음. ③ 회귀 주입: payload 에 `keyword: term` 한 줄을 더하면 빨간불.

### N-2 — 실제 트래커 통합 케이스의 mock 경계가 놓일 파일과 충돌한다 (REVISE · 중)

- `vi.mock` 은 파일 전체에 호이스트된다. `PlacePage.test.tsx:14` 는 `FavoriteButton` 을 `() => null` 로, `RegionPage.test.tsx:13-16`(스펙이 가리키는 패턴, `requirements.md:43` 「새 테스트는 이 패턴으로」)은 `track: vi.fn()` 으로 — `importOriginal` 을 펼치므로 `pendingForTest` 는 진짜지만 `track` 이 가짜라 **큐에 아무것도 안 들어간다.** 두 mock 중 하나라도 있는 파일에서는 SR-9.1 통합 케이스(`test-quality.md:19`)가 성립하지 않는다.
- 찜 CLICK 까지 보려면 필요한 것: 진짜 `FavoriteButton` + 진짜 tracker + `wishlistApi` mock(`FavoriteButton.test.tsx:8-13`) + 로그인 표시 쿠키 `portal_user_id`(`FavoriteButton.test.tsx:34-38`, `auth.ts:14,45`) + 패널용 `fetchAttraction` mock(패널은 `selected` 쿼리로 그려진다 — `PlacePage.tsx:471-475`, `:1260-1266`). 데스크톱(`matchMedia` false)이면 `aside.place-detail` 에 지도 링크(`:1317-1324`)와 찜(`:1304`)이 있다.
- 수정안: 통합 케이스는 **별도 파일**(예: `pages/place/__tests__/PlacePage.tracking.test.tsx`, tracker·FavoriteButton 둘 다 mock 없음). `beforeEach` 에 `resetTrackerForTest()`·`resetIdentityForTest()`(`tracker.ts:109`, `identity.ts:64`). 카드 클릭 → 패널 지도 링크 클릭 → 찜 클릭(addFavorite resolve 대기) → `pendingForTest()` 의 CLICK 3건이 섹션 `ATTRACTION_LIST`·`MAP_LINK`·`FAVORITE` 이고 `viewId` 가 같다. 덤으로 `navigator.sendBeacon` 을 stub 하고 `window.dispatchEvent(new Event('pagehide'))` → beacon 본문에 그 3건 — SR-1.2(`installFlushOnLeave`)가 같은 케이스로 덮인다. `test-quality.md:19` 에 파일 위치를, `requirements.md:43` 에 이 예외를 적는다.

### N-3 — 컨트롤러 6케이스는 MockMvc 의 UA 부재에 걸리고, beacon 본문 모양 케이스가 없다 (REVISE · 중)

- `CrawlerUserAgents.kt:45` — UA 가 null/blank 면 크롤러다. MockMvc 기본 요청에는 UA 가 없다 → `EventCollectController.kt:45-47` 이 **모든** 케이스를 202/`accepted=0` 으로 돌려보내고 `collect` 는 안 불린다. 상태코드만 단언하면 비크롤러 5케이스가 0회 검사로 통과한다([[gate-failure-modes]] ⑥ 「검사가 0회 돈다」).
- 수정안: 비크롤러 5케이스는 `header("User-Agent", "Mozilla/5.0 (…) Chrome/…")` 를 넣고 `slot<List<AnalyticsEvent>>()` 로 잡아 `accepted == 1` 과 `sessionId`/`visitorId`/`userId` 값을 본다(`AttractionSearchControllerTest.kt:17-23` 의 standalone + MockK). 크롤러 케이스는 UA 에 `HeadlessChrome`(`CrawlerUserAgents.kt:28`) + `verify(exactly = 0) { collect(any()) }`.
- beacon 본문(`tracker.ts:65-69`)은 `{ events, visitorId, sessionId }` 최상위다. SR-7.1 「본문 `visitorId` 는 받지 않는다」가 '거절' 로 구현되면 pagehide 전송 전부가 400 이 되어 2026-09-20 과 같은 조용한 유실이 된다(`wiki/index.md:326`). 「본문 `sessionId` 폴백」 케이스의 본문을 **beacon 모양 그대로**(`visitorId` 포함) 쓰고 → 202, `sessionId` 는 본문 값, `visitorId` 는 헤더 없으면 `anonymous` 를 단언한다. 케이스 수는 그대로 6이다.

### N-4 — SR-8.2 「상수로 SQL 문자열을 만들어 대조」는 기대값이 대상에서 온다 (REVISE · 중)

- 스펙 결정: SR-8.2(`spec.md:64`) 「어댑터 테스트는 그 상수(`NON_LIST_SECTIONS`)로 SQL 문자열을 만들어 대조한다」.
- 선례 `ClickHouseAttractionPopularityAdapterTest.kt:56-58` 은 `ANONYMOUS_VISITOR` 를 수집기와 공유하는 목적(두 모듈 정합)이다. `NON_LIST_SECTIONS` 의 상대는 `events.ts` 의 **주석**이라 Kotlin 쪽 둘째 소비자가 없고, 상수를 참조하는 순간 테스트는 「같은가」만 묻고 「맞는가」는 못 묻는다([[gate-failure-modes]] ④ 「기대값이 대상과 같은 곳에서 온다」, 규율 3 「기대값은 검사가 소유」). `NON_LIST_SECTIONS = emptySet()` 으로 비우면 기대 문자열도 같이 비어 **초록**이고, 회귀 주입 ④(SR-9.3 「제외 조건 제거」)는 절을 통째로 지울 때만 빨간불이다.
- 수정안: 테스트가 리터럴 `'MAP_LINK'`·`'FAVORITE'` 를 들고 `countIf(action = 'CLICK' AND …)` 와 `uniqStateIf(… AND …)` **양쪽 조건 안**에 있음을 본다(`oneLine` 뒤 부분 문자열 둘). 상호 참조는 `NON_LIST_SECTIONS shouldBe setOf("MAP_LINK", "FAVORITE")` 한 줄로 따로 고정한다. `impressions` 의 `countIf(action = 'IMPRESSION')` 에 제외가 **없음**(SR-8.1 노출 유지)도 단언 — 기존 `:69` 행이 그 자리다. 주입 ④ 를 「상수 비우기」와 「절 제거」 두 형태로 적는다.

### N-5 — AC 커버리지 잔여 (REVISE · 낮)

- SR-3.1 수정키 클릭: `PlaceCard` `onClick`(`PlacePage.tsx:1348-1352`)은 수정키면 early return — track 은 그 **앞**에 와야 한다. `fireEvent.click(card, { metaKey: true })` 반환 `true`(기본 동작 유지) + CLICK `payload.newTab: true`. 목록에 없다.
- SR-3.1 「자동완성으로 열린 패널은 CLICK 을 보내지 않는다」: `suggestPlaces` mock → 항목 클릭(`pickSuggestion` `:837-852`, `setSelectedId` `:848`) → CLICK 미호출, SEARCH 는 `trigger:'suggestion'` 1건. 부정 케이스가 목록에 없다.
- SR-3.1 목록 핀(`:603`)·SR-3.2 오버레이 핀(`:727`): `window.google.maps` 가 필요해 vitest 밖이고(`hasMapKey` false 면 자리표시만 `:1252`), SR-9.4 CDP 목록(검색·필터·카드 선택·지도 링크)에도 없다 — **어느 수준에도 없다.** SR-9.4 에 핀 클릭 둘(`ATTRACTION_LIST`/`source:map`, `MAP_OVERLAY`)을 더한다.
- SR-2.1 검색어 없음 → `entityId:'*'`: landing 케이스에 단언으로 붙인다.
- SR-1.3 SESSION_START 의 `screenRef`: 마운트 시점 값('' 또는 URL 의 시도)인지 자동 시도 선택(`:449-469`) 뒤 값('11')인지 스펙이 정하지 않아 「세션 시작 1회」 테스트의 단언값을 못 정한다. 한 줄로 고정한다.

### N-6 — `saved` 두 방향은 mock 에서만 둘 다 보인다 (REVISE · 낮)

- 중복 키(SR-6.3)에 `saved` 가 없다. 같은 view 에서 **둘째 FAVORITE CLICK 은 `saved` 값과 무관하게** 떨어진다. SR-5.4(`spec.md:50`)는 「해제 뒤 다시 찜 → 둘째 `saved:true`」만 적었는데, 처음부터 찜된 상태(`/keys` 하이드레이션)에서 「해제 → 찜」이면 유일한 `saved:true` 가 떨어져 그 view 의 찜 완료가 0 이 된다.
- `test-quality.md:6·21` 「saved true/false」는 훅 단위 `track` mock 이라 트래커가 둘째를 버리는 것을 못 본다 — B-1 과 같은 모양이다.
- 수정안: N-2 파일에 「해제(`saved:false`) → 찜(`saved:true`)은 `pendingForTest()` 에 한 건」을 두어 받아들인 유실을 문서가 아니라 테스트가 말하게 한다. SR-5.4 문장은 「같은 view 의 둘째 FAVORITE CLICK 은 `saved` 와 무관하게 가지 않는다」로.

### N-7 — `requirements.md` 의 개정 전 결정이 테스트 기대값을 가른다 (REVISE · 낮)

- `:13` SESSION_START `sectionId:'ATTRACTION_LIST'` vs SR-1.3 「섹션은 비운다」 · `:15` `screenRef: keyword || 지역코드` vs SR-2.1/SR-3.1 지역 코드 · `:19` `SectionId` 에 `MAP_OVERLAY` 없음 vs SR-6.1 · `:51` 「같은 (entityType, entityId, action) 은 한 번만」 vs SR-6.3 · `:25` `keyword`(N-1).
- 테스트를 어느 문서에서 쓰느냐에 따라 단언이 달라진다. `requirements.md` 를 개정하거나 맨 위에 「`spec.md` 가 이긴다」 한 줄을 둔다.

### N-8 — 실행 함정 메모 (정보)

- IMPRESSION: `PlacePage.test.tsx:235` 「Date 만 고정 — react-query 타이머는 그대로」. `DWELL_MS`(`useImpression.ts:15`)를 넘기려면 결과 도착(`findByText`) **뒤에** `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })` 를 켜고 `adsTestKit.advance()`(`:67-71`)로 1초 넘긴다. 대역은 `installIntersectionObserver()`(`:114-152`) 그대로. 데스크톱에서는 센티널 IO(`PlacePage.tsx:369-383`)가 안 붙어 간섭이 없다.
- 검색 실패 미발화(SR-2.5): `useQuery` 가 `retry: 3`·지수 지연(`PlacePage.tsx:319-320`)으로 클라이언트 기본 `retry: false`(`PlacePage.test.tsx:63`)를 덮는다 — 실패 테스트는 fake timers 로 1+2+4초를 넘겨야 `isError` 가 된다. 기존 파일에 실패 경로 테스트가 없어 처음 쓰는 사람이 걸린다.

### 최종

1라운드 BLOCK(B-1)은 스펙 결정(SR-3.4·SR-6.3·SR-7.3·SR-10, Q11)과 검증 계획(실제 트래커 통합·tracker 단위·주입 ⑥)이 함께 고쳐져 해소됐다. R-1~R-7 도 전부 반영됐다. 남은 것은 반영된 문장이 테스트로 옮겨질 때 걸리는 일곱 가지다 — 그중 N-1(세 문서가 `keyword`/`term` 으로 갈려 Goal 2 가 초록인 채 깨질 수 있음)·N-2(통합 케이스가 놓일 파일의 호이스트된 mock)·N-3(MockMvc UA 부재로 컨트롤러 테스트가 0회 검사가 됨)·N-4(어댑터 기대값이 프로덕션 상수에서 옴)는 구현 전에 문장을 고쳐야 한다. 사람 판단이 필요한 결정은 없다.

2라운드 판정: **REVISE** (새 발견 7건 + 실행 메모 1건, 1라운드 미해소 0건) — 3라운드에서 전부 해소

---

## 1라운드 (2026-10-08) — 원문

- 차원: test-strategy · 리뷰 일자: 2026-10-08 · 대상 트리: `wt-impl`(origin/main `8a61f0b`)
- 경로는 레포 루트 기준. 스펙 앵커는 `spec.md` 의 SR 번호.

### Seed Discovery

| 단계 | 읽은 것 |
|---|---|
| 스펙 | `spec.md`, `planning/requirements.md`, `planning/test-quality.md`, `planning/initialization.md`, `planning/shaping-state.yml`, `context/open-questions.yml` (`tasks*`·`status*` 없음) |
| 표준 | `docs/standards/test-rules.md`(Kotest BehaviorSpec + MockK), `docs/standards/fe-visual-verification.md` §4.5(계측 측정은 사람 UA + 보낸 수·쌓인 수 대조), 전역 규칙 「회귀를 주입해 빨간불을 본 뒤에만 켰다고 말한다」 |
| 코드 | `portal-fe/src/analytics/{tracker,identity,useImpression,events}.ts`, `portal-fe/src/components/favorite/{useFavorites.ts,FavoriteButton.tsx}`, `portal-fe/src/pages/place/{PlacePage,AttractionPage}.tsx`, `portal-fe/src/pages/search/UnifiedSearchPage.tsx`, `analytics/.../EventCollectController.kt`, `EventCollectDtos.kt`, `ClickHouseAttractionPopularityAdapter.kt`, `AnalyticsStreamTopology.kt`, `clickhouse/analytics/V005__events_two_axis.sql` |
| 기존 테스트 | `tracker.test.ts`, `PlacePage.test.tsx`, `RegionPage.test.tsx`, `AttractionPage.test.tsx`, `FavoriteButton.test.tsx`, `CollectEventItemTest.kt`, `ClickHouseAttractionPopularityAdapterTest.kt`, 보조로 `components/ads/__tests__/adsTestKit.ts`(IntersectionObserver 대역), `search/.../AttractionSearchControllerTest.kt`(컨트롤러 테스트 패턴), `analytics/app/src/test` 목록(컨트롤러 테스트 없음) |
| KB | `kb-search.sh` 는 이 리뷰어에 Bash 가 없어 실행하지 못했다. 대신 `.claude/hns-hooks.env:10` 의 `HNS_KB_PATH` 볼트 `wiki/` 를 직접 grep. 인용: [[gate-failure-modes]] (볼트, updated 2026-09-11) · [[anonymous-identity-headers]] (볼트, 2026-09-20) · [[frontend-visual-verification]] (볼트, 2026-09-10) · `wiki/index.md:326` 통합 검색 계측 기록(2026-09-20, 「계측은 보냈다가 아니라 저장된 행 수로 판정」) |
| 프로토콜 | `references/review-protocol.md` 는 플러그인 캐시(`hns/0.16.1`)에 없다 — 부모가 준 4단계를 그대로 수행 |

### 체크리스트 판정

| # | 항목 | 판정 | 근거 요약 |
|---|---|---|---|
| 1 | AC 마다 테스트가 있나 | 미흡 | SR-3.2(카드 노출) · SR-2.2(geo 반올림) · SR-2.5(`*`) · SR-2.3(`initial`·복수 `changed`) · SR-4.2(기본 동작 유지) · SR-5.1(BLOG_POST→POST) · SR-5.3(비로그인 미발화) · SR-7.1(visitor 헤더 우선) · SR-7.3(크롤러 유지) 이 `test-quality.md` 표에 없다 → R-2, R-5, R-6 |
| 2 | 레이어 배정 | 미흡 | SR-7 세션 폴백은 컨트롤러 코드(`EventCollectController.kt:48-49`)인데 계획은 DTO 단위 `CollectEventItem.toEvent` 행에 묶었다(`test-quality.md:8`). analytics 에 컨트롤러 테스트가 하나도 없다 → R-3 |
| 3 | Mock 경계 | **위반** | `track` mock 이 tracker 의 중복 제거를 가려 MAP_LINK·FAVORITE CLICK 유실을 초록불로 통과시킨다 → **B-1**. `FavoriteButton` 을 `() => null` 로 가려 SR-5.2 배선 3곳이 검증 밖 → R-1 |
| 4 | 테스트 데이터 전략 | 미흡 | 세션 시작 플래그(`sessionStorage` + 모듈 변수)의 테스트 간 초기화 전략이 없다 → R-4. 기존 픽스처(`PlacePage.test.tsx:19-50` `facets/item/respond`, `RegionPage.test.tsx:23` `seoul`)는 재사용 가능 |
| 5 | 부정·경계 케이스 | 미흡 | 1번과 같은 목록 + 저장소 실패 폴백(SR-1.3) + 「영원히 pending」 일 때 미발화 → R-4, R-6 |
| 6 | 네이밍 컨벤션 | 통과 | vitest 는 한글 문장 `it(...)`/`describe('PlacePage …')`, Kotest 는 한글 given/when/then — 계획이 인용한 패턴(`spec.md:68`)과 같다 |

---

### B-1 (BLOCK) — `track` mock 검증은 tracker 가 MAP_LINK·FAVORITE CLICK 을 버리는 것을 보지 못한다

**스펙 결정**
- SR-3.1: 카드·핀 클릭 → `CLICK` / `ATTRACTION` / 관광지 id / `PLACE_HUB` / 섹션 `ATTRACTION_LIST`
- SR-4.1: 지도 링크 → `CLICK` / `ATTRACTION` / 관광지 id / `PLACE_HUB`·`ATTRACTION_DETAIL` / 섹션 `MAP_LINK`
- SR-5.1: 찜 완료 → `CLICK` / `ATTRACTION` / `targetKey` / 섹션 `FAVORITE`
- SR-3.3: 「같은 `viewId` 안 같은 관광지의 같은 action 은 기존 중복 제거 규칙대로 한 번만 간다」
- SR-7.2: 서버 eventId = `viewId:entityType:entityId:action`
- SR-9.1: 「vitest 가 SR-1~SR-5 의 발화·미발화를 `track` mock 으로 확인한다」
- `requirements.md:37`: 기준선 질의는 `uniqExact(tuple(view_id, entity_type, entity_id, action))`

**코드**
- `portal-fe/src/analytics/tracker.ts:23-25` — 중복 키는 `viewId|entityType|entityId|action`. **sectionId 가 없다.**
- `tracker.ts:29-31` — 키가 `seen` 에 있으면 `return`. `seen` 은 flush 로 비워지지 않고 `resetTrackerForTest` (`:109-116`) 에서만 비운다 — SPA 수명 내내 남는다.
- `analytics/.../EventCollectDtos.kt:56-59` — 서버 eventId 도 같은 튜플(스펙대로 entityType 을 더해도 sectionId 는 없음).
- 허브 선택 패널은 카드 클릭(`PlacePage.tsx:1201` `onSelect={() => setSelectedId(a.id)}`) 또는 핀 클릭(`:603`, `:727`)으로 열리고, 그 패널 안에 지도 링크(`:1317-1324`)와 찜 별(`:1304`)이 있다. 자동완성(`:848`)으로 여는 경로만 예외다.
- 상세는 `viewId` 가 관광지당 하나(`AttractionPage.tsx:221`)이고 지도 링크(`:507-514`)와 찜(SR-5.2)이 같은 관광지 id 다.

**결과** — 같은 `viewId` 안에서 세 섹션의 CLICK 이 **한 키**로 접힌다.
1. 허브: 카드 CLICK(ATTRACTION_LIST) 뒤의 패널 지도 링크 CLICK(MAP_LINK) 과 찜 CLICK(FAVORITE) 은 tracker 가 버린다. 지도 링크는 패널에서만 눌리므로 허브의 SR-4 는 대부분 경로에서 **0건**이 된다.
2. 반대 순서: 카드 모서리 찜(`:1368`)을 먼저 누르면 FAVORITE CLICK 이 키를 선점하고, 이어진 카드 클릭(목록 선택)이 버려진다 → SR-8 이 FAVORITE 행을 빼면 그 관광지의 목록 클릭은 **아예 안 쌓인 것**이 된다. 인기 집계 오염 방지가 역으로 집계 누락이 된다.
3. 상세: 지도 링크와 찜 중 먼저 누른 하나만 간다.
4. FE 가 보내더라도 서버 eventId(SR-7.2)와 기준선 질의(`requirements.md:37`)가 같은 튜플이라 거기서 또 접힌다.

**테스트 계획이 이것을 못 잡는 이유**
- `test-quality.md:5-7` 의 허브·찜·상세 테스트는 전부 `vi.mock('../../../analytics/tracker', { track: vi.fn() })` (`spec.md:68` 이 가리키는 `RegionPage.test.tsx:13-16` 패턴). mock 은 `seen` 을 갖지 않으므로 MAP_LINK·FAVORITE 호출이 「발화」로 보인다.
- `tracker.test.ts` 의 중복 제거 테스트는 같은 action 반복(`:57-65`)과 IMPRESSION↔CLICK(`:75-81`)뿐이다. **같은 대상·같은 action·다른 섹션**은 없다.
- 즉 vitest 전부 초록인 채로 여섯 행동 중 둘(지도 링크·찜)이 원장에 안 쌓인다. [[gate-failure-modes]] ④(기대값이 대상과 같은 곳에서 온다)와 전역 규칙 「검사가 스스로 만든 근거는 근거가 아니다」에 정확히 해당한다.

**사람 판단이 필요한 지점** — 어느 쪽을 고칠지는 스펙 결정이다.
- (a) FE 키(`tracker.ts:23-25`)와 서버 eventId(`EventCollectDtos.kt:59`)에 `sectionId` 를 더하고, 기준선 질의 튜플(`requirements.md:37`)도 `section_id` 를 넣는다. 범위 안 파일만 바뀐다. **권고.**
- (b) 지도 링크·찜에 다른 action 을 쓴다 — `Out of Scope`(`spec.md:72`)·Q1·Q2 와 충돌.
- (c) 유실을 받아들인다 — 그러면 SR-4·SR-5 의 허브 AC 가 거짓이 된다.

**(a) 를 택할 때 추가할 테스트(회귀 주입 포함)**
- `tracker.test.ts` (mock 없이): 「같은 대상의 CLICK 이라도 섹션이 다르면 둘 다 보낸다」 — `track('CLICK', {...sectionId:'ATTRACTION_LIST'}, 'v1')` → `track('CLICK', {...sectionId:'MAP_LINK'}, 'v1')` → `flush()` → `events.length === 2`. 키 변경을 되돌리면 빨간불.
- `CollectEventItemTest.kt`: eventId 에 sectionId 가 들어간다(`"v1:ATTRACTION:1:MAP_LINK:CLICK"` 꼴) + viewId 없으면 UUID.
- `PlacePage` 통합 한 건은 **실제 tracker** 로(`vi.mock` 없이 `resetTrackerForTest` + `pendingForTest()`): 카드 클릭 → 패널 지도 링크 클릭 → `pendingForTest()` 에 `CLICK` 두 건(섹션 각각). 이 테스트만이 「화면 → tracker 큐」 전 구간을 본다.

---

### R-1 — `FavoriteButton` 을 `null` 로 가려 SR-5.2 배선 3곳이 검증 밖이다

- `PlacePage.test.tsx:14`, `AttractionPage.test.tsx:15`: `vi.mock('.../FavoriteButton', () => ({ default: () => null }))`.
- SR-5.2 「prop 을 넘기는 호출처는 허브 카드(`PlacePage.tsx:1368`)·허브 선택 패널(`:1304`)·관광지 상세 셋」 — 이 mock 아래서는 세 곳 중 어느 하나를 빠뜨려도 초록이다. `test-quality.md:6` 은 `FavoriteButton` 단독 발화만 본다.
- 수정안: 페이지 테스트의 mock 을 props 를 드러내는 대역으로 바꾼다 — `default: (p) => <button data-favorite-tracking={JSON.stringify(p.tracking ?? null)} />` — 그리고 세 자리에서 `screenType`/`screenRef`/`viewId` 가 채워졌는지, `viewId` 가 같은 화면의 SEARCH 와 같은 값인지 확인한다. 회귀 주입: 한 호출처의 `tracking` prop 을 지우면 빨간불.

### R-2 — SR-3.2 카드 노출(IMPRESSION) 테스트가 표에 없다

- SR-9.1 은 「SR-1~SR-5 발화」를 약속하는데 `test-quality.md:5` 에 노출 행이 없다. Q4(`open-questions.yml:19-22`)가 「노출 없이 클릭만 보내면 비율이 깨진다」고 해 놓고 검사가 없다.
- jsdom 엔 `IntersectionObserver` 가 없어(`PlacePage.tsx:367`, `useImpression.ts:51` 조기 반환) 기본 상태로는 발화하지 않는다. 기존 대역 `components/ads/__tests__/adsTestKit.ts:114-136` `installIntersectionObserver()` 를 그대로 쓰고 `vi.useFakeTimers` 로 `DWELL_MS`(`useImpression.ts:15`) 를 넘긴 뒤 `IMPRESSION` / `ATTRACTION_LIST` / `itemIndex` 를 확인한다. 회귀 주입: 카드 루트의 `ref` 연결을 지우면 빨간불.

### R-3 — SR-7 세션 폴백은 컨트롤러 테스트여야 한다

- 폴백 코드는 `EventCollectController.kt:48-49`(visitor 헤더 → `anonymous`, session 헤더 → visitorId). 본문 `sessionId`·`visitorId` 를 읽는 로직도 여기에 들어간다. `CollectEventItem.toEvent`(`EventCollectDtos.kt:56`)는 이미 결정된 `visitorId`/`sessionId` 를 받을 뿐이라 `test-quality.md:8` 의 「폴백」 행은 그 단위에서 검증이 불가능하다.
- `analytics/app/src/test` 에 컨트롤러 테스트가 없다(7개 파일 중 0). 레포 패턴은 `search/.../AttractionSearchControllerTest.kt:17-23` — `MockMvcBuilders.standaloneSetup` + MockK, Kotest BehaviorSpec. `collectEvents.collect` 를 `slot<List<AnalyticsEvent>>()` 로 잡아 `sessionId`/`visitorId` 를 본다.
- 케이스: ① 헤더 둘 다 → 헤더 ② session 헤더 없음 + 본문 `sessionId` → 본문 ③ 둘 다 없음 → visitorId ④ visitor 헤더 + 본문 `visitorId` 다름 → **헤더**(SR-7.1, [[anonymous-identity-headers]] 의 「게이트웨이가 덮어쓰는 헤더만 믿는다」) ⑤ visitor 헤더 없음 + 본문 `visitorId` → 본문 ⑥ 크롤러 UA → 202 `accepted=0` 이고 `collect` 미호출(SR-7.3). 회귀 주입: 본문 `sessionId` 분기를 지우면 ② 가 빨간불.

### R-4 — 세션 시작(SR-1.3) 테스트 격리·픽스처가 없다

- `sessionStorage` 는 한 테스트 파일 안에서 테스트 간에 남고, 「저장소를 못 쓰면 모듈 변수」(SR-1.3)는 모듈 캐시로 남는다. `test-quality.md:5` 「두 번 마운트해도 1회」는 앞 테스트가 플래그를 켜 두면 **순서에 따라** 통과·실패가 갈린다 — [[gate-failure-modes]] ⑥(질문을 하지 않았다).
- 수정안: `beforeEach(() => sessionStorage.clear())` + 모듈 변수용 `resetPlaceSessionForTest()` export(기존 관례 `tracker.ts:109` `resetTrackerForTest`, `identity.ts:64` `resetIdentityForTest`). 케이스 둘: 정상 저장소 — 첫 마운트 1회, 언마운트 후 재마운트 0회; 저장소 실패 — `vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota') })` 에서도 한 마운트 1회·재마운트 0회.

### R-5 — SR-2 의 경계 케이스가 표에 없다

| 케이스 | 근거 | 확인할 값 |
|---|---|---|
| 키워드 없음 → `entityId:'*'`·`payload.keyword:'*'` | SR-2.5, `AnalyticsStreamTopology.kt:131` `?: "unknown"` | 첫 결과 도착 이벤트 |
| `trigger:'initial'` | SR-2.3, `PlacePage.tsx:449-469` — `fetchAdministrativeRegions` 를 `[seoul]`(`RegionPage.test.tsx:23`)로 주면 jsdom 엔 `navigator.geolocation` 이 없어 `:460-463` 이 기본 시도를 고른다 | `trigger:'initial'`, `changed` 에 `sido` |
| 복수 필드 변경 | `pickSuggestion` `PlacePage.tsx:841-847` 이 keyword·category·areaCode·geo 를 한 번에 바꾼다 | `trigger:'suggestion'`, `changed` 에 넷 |
| geo 3자리 반올림 | SR-2.2, `nearMe` `:872-877` — `navigator.geolocation` 을 stub 해 `37.123456` 을 주면 | `geo.lat === 37.123`, `radius` 그대로 |
| 쪽 넘김 | SR-2.3 `page`, 기존 `PlacePage.test.tsx:168-169` 「다음」 버튼 | `trigger:'page'`, 새 `viewId` |
| 0건 | SR-2.1 「0건 포함」 | `total: 0` 으로 발화 |
| 같은 조건 안 같은 viewId | SR-1.1 | SEARCH 의 세 번째 인자와 뒤이은 카드 CLICK 의 세 번째 인자가 같다 |
| 링크 기본 동작 유지 | SR-4.2 | `fireEvent.click(link)` 반환값 `true`(`defaultPrevented` 아님) |

### R-6 — SR-5 의 부정 케이스

- 비로그인 클릭 미발화(SR-5.3): 기존 게스트 테스트 `FavoriteButton.test.tsx:50-71` 에 `expect(track).not.toHaveBeenCalled()` 한 줄.
- 응답 전 미발화: 기존 「영원히 pending」 테스트(`:89-99`)가 그대로 부정 케이스다 — `track` 미호출 확인.
- 롤백 미발화: 기존 「실패하면 롤백」(`:101-112`) 에 미호출 확인.
- 대상 매핑: 기존 테스트는 `GAME` 만 쓴다(`:25`). 항등이 아닌 유일한 매핑 `BLOG_POST → POST`(SR-5.1) 를 한 건 두어야 매핑 표가 검사된다.
- `saved` 는 토글 **전** 상태로 정해진다(`useFavorites.ts:30-31` 이 `keys.has` 로 분기). add → `saved:true`, remove → `saved:false` 두 방향 모두.

### R-7 — 회귀 주입 목록과 배포 뒤 대조가 불완전하다

- SR-9.1 은 주입을 FE 에 한 번만 적었다(`test-quality.md:13` 예시 하나). 전역 규칙은 게이트마다다. 필요한 목록: ① SEARCH `track` 제거 ② 한 호출처 `tracking` prop 제거(R-1) ③ 카드 `useImpression` ref 제거(R-2) ④ 어댑터 SQL 의 `section_id NOT IN (...)` 제거(SR-8.2, `ClickHouseAttractionPopularityAdapter.kt:55-57` 양쪽 `countIf`·`uniqStateIf` 각각) ⑤ 본문 `sessionId` 분기 제거(R-3) ⑥ 중복 키의 `sectionId` 제거(B-1).
- SR-8 어댑터 테스트는 문자열 대조뿐이고 컨테이너가 없다(`ClickHouseAttractionPopularityAdapterTest.kt:16-17` 이 스스로 적음). 문법 오류는 못 잡으므로 SR-9.3 에 「재집계 `SELECT` 부분을 ClickHouse 에서 한 번 실행해 행이 나온다」를 더한다. `section_id` 컬럼은 `V005__events_two_axis.sql:26` 에 있다.
- SR-9.3 은 「본문과 202 accepted 를 기록하고 행을 센다」까지다. `fe-visual-verification.md:197-205` 와 볼트 `index.md:326` 의 규칙은 **보낸 건수 = accepted = 저장 행 수** 대조다 — 세 수를 한 표에 적는다. 찜은 로그인 계정이 없으면 미확인으로 남긴다고 했으니(`requirements.md:30`) 완료 보고에 그 칸을 「미확인」으로 명시한다.

---

### 1라운드 최종

B-1 은 스펙 결정(SR-3.1·SR-4.1·SR-5.1 이 같은 CLICK 튜플, SR-3.3 이 기존 중복 제거 의존, SR-9.1 이 mock 검증)과 코드(`tracker.ts:23-31` 키에 sectionId 없음, `EventCollectDtos.kt:59` 동일)가 어긋나 **여섯 행동 중 둘이 유실되는데 계획된 테스트가 전부 초록**인 상태다. 키 설계를 어느 쪽으로 고칠지는 사람이 정해야 한다. R-1~R-7 은 그 결정과 무관하게 반영 가능하다.

1라운드 판정: BLOCK (2라운드에서 해소)

---

VERDICT: REVISE
