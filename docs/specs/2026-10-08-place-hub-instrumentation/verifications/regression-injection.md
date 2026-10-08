# 회귀 주입 — 게이트가 물리는지 (2026-10-08 15:0x~15:1x KST)

방법: 주입 적용 → 지정 테스트 실행(실패 기대) → `git checkout -- <파일>` → `git diff --quiet` 로 되돌림 확인. 스크립트 `scratchpad/inject.py`, 원시 결과 `inject-result.json`·`inject.log`(레포 밖). 전부 메인 세션이 직접 실행.

| # | 주입 | 파일 | 명령 | exit | 빨간불 | 되돌림 |
|---|---|---|---|---|---|---|
| ① | SEARCH track 제거 — 1차는 `void (…)` 치환이 esbuild 구문 오류를 내 무효(파싱 실패는 증거가 아님). 2차: `(() => undefined)(…)` 무동작 호출로 재실행 → **Tests 19 failed** (SEARCH 계측 전 케이스) → 되돌림 → 39 passed | `PlacePage.tsx` | `vitest src/pages/place/__tests__/PlacePage.test.tsx` | 1 (2차) | ✔ Failed Tests 19 — landing/initial · submit · suggestion · nearMe · region · category · attribute … (SEARCH 케이스 전부) | ✔ |
| ② | 패널 FavoriteButton tracking prop 제거 | `PlacePage.tsx` | `vitest src/pages/place/__tests__/PlacePage.test.tsx` | 1 | ✔ FAIL  PlacePage.test.tsx > 찜 배선 > 카드·패널의 찜 버튼은 그 view 의 viewId 와 지역 코드를 받는다 | ✔ |
| ③ | 카드 useImpression ref 제거 | `PlacePage.tsx` | `vitest src/pages/place/__tests__/PlacePage.test.tsx` | 1 | ✔ FAIL  PlacePage.test.tsx > IMPRESSION — 카드 노출 > 카드마다 ATTRACTION_LIST·itemIndex 로 한 번, 패널을 열어도 MAP_LINK·FAVORITE 노출은 없다 | ✔ |
| ④a | 어댑터 countIf 의 NOT IN 절 제거 | `ClickHouseAttractionPopularityAdapter.kt` | `gradle --tests *ClickHouseAttractionPopularityAdapterTest --offline -q` | 1 | ✔ BUILD FAILED in 5s | ✔ |
| ④b | 어댑터 uniqStateIf 의 NOT IN 절 제거 | `ClickHouseAttractionPopularityAdapter.kt` | `gradle --tests *ClickHouseAttractionPopularityAdapterTest --offline -q` | 1 | ✔ BUILD FAILED in 5s | ✔ |
| ⑤ | POST_SELECTION_SECTIONS = emptySet() | `AggregateAttractionPopularityUseCase.kt` | `gradle --tests *ClickHouseAttractionPopularityAdapterTest --offline -q` | 1 | ✔ BUILD FAILED in 5s | ✔ |
| ⑥ | 본문 sessionId 분기 제거 | `EventCollectController.kt` | `gradle --tests *EventCollectControllerTest --offline -q` | 1 | ✔ BUILD FAILED in 5s | ✔ |
| ⑦ | keyOf 의 sectionId 제거 | `tracker.ts` | `vitest src/analytics/__tests__/tracker.test.ts src/pages/place/__tests__/PlacePage.tracking.test.tsx` | 1 | ✔ FAIL  src/analytics/__tests__/tracker.test.ts > tracker — 노출·클릭 전송 > 같은 대상이라도 섹션이 다르면 각각 남는다 — 카드 선택·지도 열기·찜은 다른 행동이다<br>FAIL  PlacePage.tracking.test.tsx > PlacePage 계측 — 실제 트래커 > ① 같은 관광지의 카드 선택·지도 열기·찜은 섹션이 달라 셋 다 대기열에 남고, viewId 는 SEARCH 와 같다<br>FAIL  PlacePage.tracking.test.tsx > PlacePage 계측 — 실제 트래커 > ② 화면을 떠나면 beacon 본문에 세 CLICK 과 식별자가 실리고 대기열은 빈다<br>FAIL  PlacePage.tracking.test.tsx > PlacePage 계측 — 실제 트래커 > ③ 처음부터 찜된 채 「해제 → 찜」은 같은 view 라 FAVORITE 한 건(saved:false)만 남는다 | ✔ |
| ⑧ | payload 에 keyword 키 추가 | `PlacePage.tsx` | `vitest src/pages/place/__tests__/PlacePage.test.tsx` | 1 | ✔ FAIL  PlacePage.test.tsx > SEARCH — 검색 제출·필터 적용 > 첫 진입 — landing(시도 없음) 뒤 자동 시도 선택의 initial: screenRef 11 · entityId * · 좌표·keyword 키 없음<br>FAIL  PlacePage.test.tsx > SEARCH — 검색 제출·필터 적용 > suggestion — 자동완성 선택은 SEARCH 한 건이고 CLICK 이 아니다. 반경만 남고 좌표는 없다<br>FAIL  PlacePage.test.tsx > SEARCH — 검색 제출·필터 적용 > nearMe — 반경 5km 만 싣고 기기 좌표는 싣지 않는다 | ✔ |
| ⑨ | runKeywordSearch 의 ref 심기 제거 | `PlacePage.tsx` | `vitest src/pages/place/__tests__/PlacePage.test.tsx` | 1 | ✔ FAIL  PlacePage.test.tsx > SEARCH — 검색 제출·필터 적용 > submit — 검색어 확정 | ✔ |
| ⑩ | 패널 지도 링크에 노출 동봉(TrackedLink 상당) | `PlacePage.tsx` | `vitest src/pages/place/__tests__/PlacePage.test.tsx` | 1 | ✔ FAIL  PlacePage.test.tsx > IMPRESSION — 카드 노출 > 카드마다 ATTRACTION_LIST·itemIndex 로 한 번, 패널을 열어도 MAP_LINK·FAVORITE 노출은 없다 | ✔ |
| ⑪ | PlacedItem.sectionId 선택화 | `events.ts` | `npx tsc -b` | 2 | ✔ src/analytics/__tests__/tracker.test.ts(140,5): error TS2578: Unused '@ts-expect-error' directive. | ✔ |
| ⑫ | screenRef 합성에서 시도 접두 제거 | `PlacePage.tsx` | `vitest src/pages/place/__tests__/PlacePage.test.tsx` | 1 | ✔ FAIL  PlacePage.test.tsx > SEARCH — 검색 제출·필터 적용 > region — 시군구 선택은 screenRef 가 시도+시군구(11110) 다 | ✔ |

되돌린 뒤 초록 재확인:
```
$ npx vitest run src/pages/place/__tests__/PlacePage.test.tsx src/analytics/__tests__/tracker.test.ts src/pages/…
  exit=0  Tests  57 passed (57)
$ npx tsc -b
  exit=0  
$ ./gradlew :analytics:app:test --tests *ClickHouseAttractionPopularityAdapterTest --tests *EventCollectControll…
  exit=0  
$ (① 재실행 뒤) npx vitest run src/pages/place/__tests__/PlacePage.test.tsx
  Tests  39 passed (39)  AFTER_EXIT=0
```

판정: 12건(④ 두 형태 포함 13회) 전부 빨간불 → 되돌림 → 초록. 각 게이트는 자기 대상의 회귀에 물린다. ⑦ 은 통합 테스트 ①②③ 세 케이스가 동시에 빨개져 「세 CLICK 이 한 키로 접힘」을 직접 보였고, ⑪ 은 `tsc -b` 의 `TS2578 Unused '@ts-expect-error'` 로 타입 게이트가 선다.
