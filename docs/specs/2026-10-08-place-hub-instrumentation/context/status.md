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
