# Verification Report: 2026-10-08-place-hub-instrumentation
**Date:** 2026-10-08 (15:1x~15:2x KST)  **Status:** PASS

검증자는 구현 히스토리 없이 워크트리 `scratchpad/wt-impl`(branch `place-stage2`, origin/main `8a61f0b` 위 커밋 7개)만 읽고 실행했다. 코드는 고치지 않았고, 회귀 주입 재현 두 건은 모두 `git checkout` 으로 되돌려 `git diff --quiet` 가 0 이다.

## Summary

tasks.md 의 체크 27개 전부 코드에서 근거를 찾았고 UNVERIFIED 는 없다. 범위 지정 명령(vitest 10파일 208건 · `tsc -b` · Kotest 3클래스 17건 · eslint 수정 11파일)이 전부 exit 0 이다. 회귀 주입 문서 13행은 전부 「빨간불 → 되돌림 → 초록」이고, 가장 중요한 ⑦(keyOf 의 sectionId 제거)·⑪(`PlacedItem.sectionId` 선택화)은 직접 재현해 문서와 같은 실패 이름·같은 오류 줄을 얻었다. `common` 모듈 변경은 0 이다.

## Tasks

| TG | 항목 | 근거 (file:symbol) | 판정 |
|---|---|---|---|
| 1.2 | `SectionId` 에 `MAP_LINK`·`FAVORITE`(인기 집계 제외 주석)·`MAP_OVERLAY`(핀 주석) | `portal-fe/src/analytics/events.ts:41-48` | ✔ |
| 1.2 | `EventAction` 에 `SESSION_START` | `events.ts:13` | ✔ |
| 1.2 | `TrackedItem = PlacedItem \| PageItem`(`sectionId?: never` 등), `TrackedEvent` 별칭 | `events.ts:51-87` | ✔ |
| 1.3 | `keyOf` = `viewId\|entityType\|entityId\|sectionId ?? ''\|action`, 주석 갱신 | `tracker.ts:20-28` | ✔ (주입 ⑦ 재현) |
| 1.1 | tracker 테스트 4건 + `@ts-expect-error` 한 줄 | `analytics/__tests__/tracker.test.ts:117-143` (지시문 140행) | ✔ (주입 ⑪ 재현) |
| 2.2 | `useFavorites(type, tracking?)` — `mutationFn` 이 `{ saved }` 반환(캐시 재독 없음), `onSuccess` 에서 `ATTRACTION` 만 `CLICK/FAVORITE`, `onMutate`·`onError`·`onSettled` 불변 | `components/favorite/useFavorites.ts:38-45, 58-72` | ✔ |
| 2.3 | `FavoriteButton` 선택 prop `tracking` → 훅에 전달 | `FavoriteButton.tsx:60-69` | ✔ |
| 2.1 | FavoriteButton 테스트 7건(추가·해제·롤백·게스트·prop 없음·IMPRESSION 0·pending) | `__tests__/FavoriteButton.test.tsx:174-261` | ✔ |
| 3.2 | `viewId = useMemo(newViewId, [query])` + ref, `screenRef = sido + (sigungu ?? '')` + ref, `useEffect(installFlushOnLeave, [])`, `SESSION_START` 1회(`PAGE`/`place-hub`, `screenRef: ''`, sectionId 없음, sessionStorage 플래그 + 모듈 변수 폴백), `resetPlaceSessionForTest` export | `pages/place/PlacePage.tsx:249-273, 379-395` | ✔ |
| 3.3 | trigger ref 심기 — `submit`(1021) · `suggestion`(1004, 좌표 early return 1003 뒤) · `area`(1034) · `nearMe`(1043) · `selectRegion(next, trigger)` 5곳(`initial` 591 / `region` 705·1198·1332·1362) · 구 축 `<select>` `region`+`['areaCode']`(1250) · 분류 칩 `category` 2곳(1207·1222, changed 복수) · `attribute`(471) · `eventStatus`(1279) · `page` 4곳(500 센티널·1402 이전·1416 다음·1433 더 보기) · `lang`(1053, 같은 값 가드 뒤) | `PlacePage.tsx` 위 행 | ✔ |
| 3.3 | 결과 도착 effect — `isError` 면 미발화, view 당 1회, `trigger ?? (첫 질의 'landing' : 'other')`, payload 에 `term`·`radiusKm` 만 있고 `keyword`·`lat`·`lng` 키 없음 | `PlacePage.tsx:403-442` (`keyword:`·`lat:`·`lng:` grep 은 API `query` 메모 332·341·342 에만) | ✔ |
| 3.4 | 카드 CLICK 이 수정키 early return **앞**(`newTab` payload), 목록 핀 `ATTRACTION_LIST`/`source: map`, 오버레이 핀 `MAP_OVERLAY`/`source: map`/itemIndex 없음(둘 다 `viewIdRef`·`screenRefRef`), 패널 지도 링크 `MAP_LINK`/`google_maps_search` 를 `onClick` 의 `track` 만으로(TrackedLink 아님) | `PlacePage.tsx:737-750, 876-889, 1537-1558, 1601-1620` | ✔ |
| 3.4 | `tracking` prop 카드·패널 | `PlacePage.tsx:1519-1524, 1639-1645` | ✔ |
| 3.5 | 카드 루트 `<a ref={useImpression(...ATTRACTION_LIST, itemIndex)}>` | `PlacePage.tsx:1584-1600` | ✔ |
| 3.6 | 상세 지도 링크 `MAP_LINK`(`ATTRACTION_DETAIL`, `screenRef: id`) + `FavoriteButton tracking` | `pages/place/AttractionPage.tsx:386-391, 512-532` | ✔ |
| 3.1 | PlacePage 테스트 — `track` mock + `tracking` 노출 대역, afterEach `other` 금지 게이트, 세션 3·SEARCH 15·CLICK 3·IMPRESSION 1·찜 배선 1 | `__tests__/PlacePage.test.tsx:15-17, 406-414, 416-690` | ✔ |
| 3.1 | AttractionPage 테스트 2건(MAP_LINK · 찜 대역 viewId 일치) | `__tests__/AttractionPage.test.tsx:1053-1083` | ✔ |
| 4.1 | 통합 테스트 4건 — tracker·FavoriteButton·useImpression 대역 없음(`vi.mock` 은 placeApi·wishlistApi 뿐), `pendingForTest()` 와 beacon Blob 본문이 판정 근거, afterEach `other` 게이트 | `__tests__/PlacePage.tracking.test.tsx:9-21, 136-145, 159-254` | ✔ |
| 5.2 | `CollectEventsRequest.sessionId`(`@field:Size(max = 128)`, nullable) · eventId `view:entityType:entityId:sectionId.orEmpty():action` · KDoc | `analytics/.../presentation/event/dto/EventCollectDtos.kt:29-30, 59-67` | ✔ |
| 5.3 | 세션 순서 헤더 → 본문 `sessionId` → visitorId; `userId` 는 `null` 고정; `X-User-Id`·`USER_HEADER` 읽기 없음(main grep 은 KDoc 한 줄뿐) | `.../controller/EventCollectController.kt:35-36, 51-57, 62-65` | ✔ |
| 5.4 | `POST_SELECTION_SECTIONS = setOf("MAP_LINK","FAVORITE")` 를 use case companion 에 + KDoc(목록 선택만, 노출 그대로, events.ts 상호 참조) | `.../application/popularity/usecase/AggregateAttractionPopularityUseCase.kt:26-31` | ✔ |
| 5.4 | 어댑터 `INSERT_DAY` `private val`, `EXCLUDED_SECTIONS = …joinToString { "'$it'" }`, `countIf(CLICK AND section_id NOT IN (…))` · `uniqStateIf(… NOT IN (…) AND visitor_id != 'anonymous')` 두 술어, `impressions` 는 `countIf(action = 'IMPRESSION')` 그대로 | `.../infrastructure/popularity/ClickHouseAttractionPopularityAdapter.kt:42-44, 59-70` | ✔ |
| 5.1 | `CollectEventItemTest` 2건(섹션 포함 id · PAGE 빈 칸) | `.../presentation/event/CollectEventItemTest.kt:55-72` | ✔ |
| 5.1 | `EventCollectControllerTest` 6건 — standalone + `GlobalExceptionHandler` advice, 사람 UA, `slot<List<AnalyticsEvent>>`, 헤더>본문 순서까지 고정 | `.../presentation/event/EventCollectControllerTest.kt` | ✔ |
| 5.1 | 어댑터 테스트 — 리터럴 `NOT IN ('MAP_LINK', 'FAVORITE')` 두 술어, `action = 'IMPRESSION' AND` 부재, 상수 `shouldBe setOf(...)` 별도 | `.../infrastructure/popularity/ClickHouseAttractionPopularityAdapterTest.kt:55-88` | ✔ |
| 5 AC | `common` 변경 0 | `git diff --stat origin/main..HEAD -- common` → 빈 출력 | ✔ |
| 6.1 | ADR-0095 4곳(`screen_ref` 행 · §3 키에 `section_id` · §6 `clicks`/`unique_clickers` 뜻 · FE 노출 감지 키) | `docs/adr/ADR-0095-impression-click-pipeline.md` diff 4 hunk | ✔ |
| 6.2 | 회귀 주입 13행 전부 빨간불·되돌림 ✔ | `verifications/regression-injection.md` + 아래 재현 | ✔ |
| 6.3/6.4 | 통합 명령 결과 줄 | 아래 Test Suite | ✔ |

UNVERIFIED: 없음.

## Test Suite

```
$ cd portal-fe && npx vitest run src/analytics src/components/favorite src/pages/place
 ✓ src/components/favorite/__tests__/FavoriteButton.test.tsx (13 tests)
 ✓ src/analytics/__tests__/tracker.test.ts (14 tests)        # 10파일 가운데 변경 관련 5개
 ✓ src/pages/place/__tests__/PlacePage.tracking.test.tsx (4 tests)
 ✓ src/pages/place/__tests__/AttractionPage.test.tsx (53 tests)
 ✓ src/pages/place/__tests__/PlacePage.test.tsx (39 tests)
 Test Files  10 passed (10)
      Tests  208 passed (208)
$ npx tsc -b
TSC_EXIT=0
$ ./gradlew :analytics:app:test --tests '*CollectEventItemTest' --tests '*EventCollectControllerTest' --tests '*ClickHouseAttractionPopularityAdapterTest' --offline -q --rerun-tasks
GRADLE_EXIT=0
ClickHouseAttractionPopularityAdapterTest: tests="6" skipped="0" failures="0" errors="0"
CollectEventItemTest: tests="5" skipped="0" failures="0" errors="0"
EventCollectControllerTest: tests="6" skipped="0" failures="0" errors="0"
$ npx eslint <수정 11파일: events.ts tracker.ts tracker.test.ts useFavorites.ts FavoriteButton.tsx FavoriteButton.test.tsx PlacePage.tsx AttractionPage.tsx PlacePage.test.tsx AttractionPage.test.tsx PlacePage.tracking.test.tsx>
ESLINT_EXIT=0
```

vitest 는 PlacePage 「패널 지도 링크」 케이스에서 jsdom 의 `Not implemented: navigation` stderr 를 낸다 — `target="_blank"` 링크의 기본 동작이 막히지 않았다는 뜻이라 테스트 의도와 일치하며 실패가 아니다.

## Failed Tests

None.

## 회귀 주입 재현 (⑦·⑪ 직접, 나머지 11행은 문서 대조)

```
# ⑦ tracker.ts keyOf 에서 `|${e.sectionId ?? ''}` 제거
$ npx vitest run src/analytics/__tests__/tracker.test.ts src/pages/place/__tests__/PlacePage.tracking.test.tsx
FAIL  tracker.test.ts > 같은 대상이라도 섹션이 다르면 각각 남는다 — 카드 선택·지도 열기·찜은 다른 행동이다
FAIL  PlacePage.tracking.test.tsx > ① 같은 관광지의 카드 선택·지도 열기·찜은 섹션이 달라 셋 다 대기열에 남고, viewId 는 SEARCH 와 같다
FAIL  PlacePage.tracking.test.tsx > ② 화면을 떠나면 beacon 본문에 세 CLICK 과 식별자가 실리고 대기열은 빈다
FAIL  PlacePage.tracking.test.tsx > ③ 처음부터 찜된 채 「해제 → 찜」은 같은 view 라 FAVORITE 한 건(saved:false)만 남는다
 Test Files  2 failed (2)   Tests  4 failed | 14 passed (18)   INJECT7_VITEST_EXIT=1
$ git checkout -- portal-fe/src/analytics/tracker.ts && git diff --quiet -- portal-fe/src/analytics/tracker.ts
RESTORED_DIFF_QUIET_EXIT=0

# ⑪ events.ts `sectionId: SectionId;` → `sectionId?: SectionId;`
$ npx tsc -b
src/analytics/__tests__/tracker.test.ts(140,5): error TS2578: Unused '@ts-expect-error' directive.
INJECT11_TSC_EXIT=2
$ git checkout -- portal-fe/src/analytics/events.ts && git diff --quiet -- portal-fe/src/analytics/events.ts
RESTORED_DIFF_QUIET_EXIT=0
$ npx tsc -b
TSC_AFTER_EXIT=0
```

두 건 모두 `regression-injection.md` 의 실패 이름·오류 줄과 글자까지 같다. 나머지 11행(①②③④a④b⑤⑥⑧⑨⑩⑫)은 표의 「빨간불 ✔ · 되돌림 ✔」과 실패 테스트 이름이 현재 테스트 파일의 `it(...)` 제목과 일치함을 대조했다.

## AC Coverage

| AC | 대응 테스트 |
|---|---|
| SR-1.1 view 단위(`query` 바뀔 때 새 viewId) · 1.2 `installFlushOnLeave` · 1.3 SESSION_START 1회·`screenRef ''`·섹션 없음·저장소 폴백 | PlacePage.test 「세션 시작」 3건, tracking.test ① ②(pagehide beacon), tracker.test PAGE 케이스 |
| SR-2.1~2.3 SEARCH 대상·screenRef(`11`/`11110`)·payload·trigger 13종 중 `area` 제외 전부 | PlacePage.test 「SEARCH」 15건(landing·initial·submit·suggestion·nearMe·region×2·category·attribute·eventStatus·page·lang·0건·재발화 없음·오버레이·실패) + afterEach `other` 게이트 |
| SR-2.4 서버 enum 불변 · 2.5 실패 미발화 | `common` diff 0; PlacePage.test 「재시도 뒤에도 실패한 질의는 보내지 않는다」 |
| SR-3.1 카드·핀 CLICK·수정키 newTab·자동완성 CLICK 없음 · 3.3 카드 노출 · 3.4 불변식 | PlacePage.test 「CLICK」 3건·「IMPRESSION」 1건·suggestion 케이스; tracker.test 섹션 키 2건; 핀 두 종은 `window.google.maps` 가 필요해 SR-9.4(배포 뒤 CDP) 몫 |
| SR-4 지도 열기(허브·상세) · IMPRESSION 미동봉 | PlacePage.test 「패널 지도 링크」·IMPRESSION 부정 단언; AttractionPage.test 2건 |
| SR-5 찜 성공 뒤에만·`saved` 방향·미발화 3건·IMPRESSION 0·호출처 3곳 | FavoriteButton.test 7건; PlacePage.test 「찜 배선」; AttractionPage.test 찜 대역; tracking.test ③ ④ |
| SR-6 타입·상수·중복 키 | tracker.test 4건(+ `@ts-expect-error` 타입 게이트, ⑪ 로 증명) |
| SR-7 세션 폴백·`X-User-Id` 미독·eventId 섹션·크롤러·상한 | EventCollectControllerTest 6건, CollectEventItemTest 2건 |
| SR-8 집계 제외 두 술어·노출 불변·상수 위치 | ClickHouseAttractionPopularityAdapterTest 6건 |
| SR-9.3 회귀 주입 12건 | `regression-injection.md` 13행 + 이 보고의 ⑦·⑪ 재현 |
| SR-9.4 배포 뒤 CDP·ClickHouse 대조 | **없음(배포 전 단계)** — tasks.md 범위 밖, 아래 Follow-ups |
| SR-10 기준선 질의 | 문서 산출물(spec.md §SR-10) — 실행은 SR-9.4 와 함께 |

## Follow-ups

- **워크트리에 커밋 밖 변경 1건**: `docs/changelog/harness-changelog.md` 가 15:12:51 KST 에 수정돼 `M` 으로 떠 있다(워크트리 절차 메모리 행 추가). 이 스펙의 커밋 7개에 들어 있지 않고 내가 건드린 파일도 아니다 — 커밋 시 경로 지정 `git add` 가 이 파일을 어디에 담을지 메인이 정해야 한다. `M auth` 는 안내대로 환경 사정.
- **SR-9.4(배포 뒤)**: 목록 핀 `ATTRACTION_LIST`/`source: map`·오버레이 핀 `MAP_OVERLAY`·`trigger: area` 는 jsdom 밖이라 아직 아무 테스트도 보지 못했다. 배포 뒤 일반 Chrome UA CDP 로 「보낸 건수 = 202 accepted = ClickHouse 행 수」 표와 SR-10 질의 1회 실행이 남아 있다.
- **보이스카우트 보고(미수정, status.md 와 동일)**: `src/pages/place` 디렉토리 전체 eslint 는 손대지 않은 `AttractionAir.tsx:13`·`AttractionWeather.tsx:40,129` 의 `react-refresh/only-export-components` 3건으로 붉다. 이번 수정 11파일은 eslint 0.
- `docs/product/roadmap.md` 는 존재하지 않아 완료 표시 후보 없음.
- 스펙 post-impl Open Questions(Q5~Q13)는 그대로 열려 있다 — 특히 Q7(Streams 키워드 브랜치)·Q8(`common` 주석의 「(viewId, entityId) 1회」 갱신).
