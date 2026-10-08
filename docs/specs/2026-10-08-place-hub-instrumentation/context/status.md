# 검증 상태

## TG1 FE 이벤트 타입·트래커 — PASS (2026-10-08 11:4x KST, 메인 재실행)
```
$ cd portal-fe && npx vitest run src/analytics/__tests__/tracker.test.ts
 ✓ src/analytics/__tests__/tracker.test.ts (14 tests) 6ms
      Tests  14 passed (14)
$ npx tsc -b
TSC_EXIT=0
```
- diff: events.ts +33/-4 · tracker.ts +5/-2 · tracker.test.ts +28. `keyOf` 하나뿐(:26). 구현자가 테스트 먼저 빨간불(1 failed | 13 passed)과 타입 게이트 빨간불(TS2345 sectionId missing)을 본 뒤 초록.

## TG5 수집 서버·인기 집계 — PASS (2026-10-08 14:4x KST, 메인 재실행)
```
$ ./gradlew :analytics:app:test --tests '*CollectEventItemTest' --tests '*EventCollectControllerTest' --tests '*ClickHouseAttractionPopularityAdapterTest' --offline -q
GRADLE_EXIT=0
ClickHouseAttractionPopularityAdapterTest tests= 6 failures= 0 errors= 0
CollectEventItemTest tests= 5 failures= 0 errors= 0
EventCollectControllerTest tests= 6 failures= 0 errors= 0
$ git diff --stat -- common   → (빈 줄)
```
- diff: analytics 6파일 +74/-14 + 신규 컨트롤러 테스트. `X-User-Id` 읽기·`USER_HEADER` 삭제 확인(grep 0). SQL 두 술어에 `section_id NOT IN ($EXCLUDED_SECTIONS)`. 구현자가 테스트 먼저 빨간불(11 tests 4 failed · 어댑터 6 tests 3 failed)을 본 뒤 초록.
- 구현자 추가: 컨트롤러 케이스 ①에 본문 `sessionId` 를 같이 실어 「헤더가 본문보다 앞선다」까지 고정 — SR-7.1 순서와 일치, 유지.

## TG2 찜 훅·버튼 계측 — PASS (2026-10-08 14:5x KST, 메인 재실행)
```
$ cd portal-fe && npx vitest run src/components/favorite/__tests__/FavoriteButton.test.tsx
 ✓ src/components/favorite/__tests__/FavoriteButton.test.tsx (13 tests) 175ms
      Tests  13 passed (13)
$ npx tsc -b
TSC_EXIT=0
```
- diff: useFavorites.ts +36/-3 · FavoriteButton.tsx +8/-2 · 테스트 +150/-3. 비-place 호출처 diff 없음. 구현자가 테스트 먼저 빨간불(4 failed | 9 passed)을 본 뒤 초록.

## TG3 허브·상세 화면 계측 — PASS (2026-10-08 15:3x KST, 메인 재실행)
```
$ cd portal-fe && npx vitest run src/pages/place/__tests__/PlacePage.test.tsx src/pages/place/__tests__/AttractionPage.test.tsx
 ✓ src/pages/place/__tests__/AttractionPage.test.tsx (53 tests)
 ✓ src/pages/place/__tests__/PlacePage.test.tsx (39 tests)
      Tests  92 passed (92)
$ npx tsc -b                                   TSC_EXIT=0
$ npx eslint <수정 4파일>                       ESLINT4_EXIT=0
$ npx eslint src/pages/place/AttractionAir.tsx src/pages/place/AttractionWeather.tsx → 기존 오류(react-refresh/only-export-components), 두 파일은 git status 에 없음(미수정)
```
- diff: PlacePage.tsx +319 · AttractionPage.tsx +25 · 테스트 +352/+39. `function PlaceCard` 1개. payload 에 `keyword`·`lat`·`lng` 키 없음(grep). 구현자가 테스트 먼저 빨간불(25 failed | 67 passed)과 ⑨ 주입(runKeywordSearch ref 제거 → submit 케이스 + `other` 게이트 빨강)을 본 뒤 초록.
- 보이스카우트 보고(미수정): `AttractionAir.tsx:13`·`AttractionWeather.tsx:40,129` 의 `react-refresh/only-export-components` lint 오류 3건 — 이 태스크와 무관, 별도 결정.

## TG4 실제 트래커 통합 테스트 — PASS (2026-10-08 15:5x KST, 메인 재실행)
```
$ cd portal-fe && npx vitest run src/pages/place/__tests__/PlacePage.tracking.test.tsx
 ✓ src/pages/place/__tests__/PlacePage.tracking.test.tsx (4 tests) 267ms
      Tests  4 passed (4)
$ npx tsc -b                                                   TSC_EXIT=0
$ npx eslint src/pages/place/__tests__/PlacePage.tracking.test.tsx   ESLINT_EXIT=0
$ grep -c "vi.mock('../../../analytics" / "FavoriteButton'" → 0 / 0  (실제 트래커·실제 FavoriteButton 경로)
```
- 프로덕션 코드 변경 0. 구현자가 ⑦ 주입(keyOf 의 sectionId 제거 → ①②③ 빨강: 3건이 1건으로 접힘)을 본 뒤 되돌려 초록.

## TG6 문서·회귀 주입·통합 검증 — PASS (2026-10-08 16:1x KST, 메인 직접)
```
회귀 주입 13회(①~⑫, ④ 두 형태): 전부 빨간불 → git checkout → diff 비어 있음 (verifications/regression-injection.md)
$ cd portal-fe && npx vitest run src/analytics src/components/favorite src/pages/place
 Test Files  10 passed (10)      Tests  208 passed (208)      VITEST_EXIT=0
$ npx tsc -b                                                   TSC_EXIT=0
$ ./gradlew :analytics:app:test --tests '*CollectEventItemTest' --tests '*EventCollectControllerTest' --tests '*ClickHouseAttractionPopularityAdapterTest' --offline -q
 GRADLE_EXIT=0 · Adapter 6/0 · CollectEventItem 5/0 · Controller 6/0
$ git status --short → M auth(미커밋 포인터, 담지 않음) · M ADR-0095 · ?? evidence/stage2 · ?? verifications
```
- ADR-0095 개정 4곳(`:63` screen_ref · §3 키에 section_id · §6 clicks/unique_clickers 뜻 · FE 노출 감지 키).
