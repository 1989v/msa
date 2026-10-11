# 단위·통합 테스트 기록

## TG2 — 검색 응답 `sigunguName`

빨강(구현 전): `./gradlew :search:app:test --tests '*SearchAttractionServiceTest'` → `compileTestKotlin FAILED` · `Unresolved reference 'sigunguName'`.

```
$ ./gradlew :search:app:test --tests '*SearchAttractionServiceTest' --tests '*AttractionPageRendererTest' --tests '*VisitSummaryParityTest' --rerun
BUILD SUCCESSFUL — SearchAttractionServiceTest tests=77 failures=0 · AttractionPageRendererTest tests=119 failures=0 · VisitSummaryParityTest tests=39 failures=0
$ ./gradlew verifySearchIndexContract
BUILD SUCCESSFUL
$ git diff --exit-code -- search/app/src/test/resources/render/
(차이 없음, exit 0)
```

## TG3 — 인기 집계 제외 섹션

빨강(리터럴만 먼저 바꾼 상태): `6 tests completed, 4 failed`(SQL 단언 셋 + 상수 집합).

```
$ ./gradlew :analytics:app:test --tests '*ClickHouseAttractionPopularityAdapterTest'
BUILD SUCCESSFUL — tests=6 failures=0
$ cd portal-fe && npx tsc -b
exit 0
```

## TG4 — 허브 카드

빨강: `cardFacts.test.ts` 13건 전부 `cardFacts is not a function` · 허브 카드 5건 + 카드 클릭 payload 1건 + 계측 ⑤ 1건 실패(57 중 7).

```
$ cd portal-fe && npx vitest run src/pages/place/__tests__/cardFacts.test.ts src/pages/place/__tests__/PlacePage src/pages/place/__tests__/PlaceLanding.test.tsx && npx tsc -b
Test Files  9 passed (9) · Tests  177 passed (177) · tsc exit 0
```

단언 수(`expect(` 개수 · 테스트 수) 전·후:

| 파일 | 전 | 후 | 바뀐 것 |
|---|---|---|---|
| `cardFacts.test.ts` (새) | — | 45 · 13 | 배지 표 행마다(국·영) · KST 경계 · 미표시 값 · 최대 3·순서 · 무장애 정밀 코드 · 행사 · 지역 라벨 · 거리 · 찜 하한 |
| `PlacePage.test.tsx` | 149 · 46 | 167 · 52 | 「허브 카드」 6건 추가(주소 없음·meta 순서·배지·찜 읽기 문구·todayKst 호출부 2건·영문). 카드 클릭 `toEqual` 의 payload 에 `badges: []` |
| `PlacePage.tracking.test.tsx` | 36 · 4 | 39 · 5 | ⑤ 노출·클릭 `payload.badges` = `cardFacts` 가 낸 code(빈 배열 포함) |
| `PlacePage.interpret` · `langSwitch` · `layout` · `loginReturn` · `relax` · `PlaceLanding` | 58 · 9 · 113 · 68 · 88 · 39 | 같음 | 없음 |

- `cardFacts.test` 의 시스템 시계는 인자 `today`(월요일)와 다른 요일(수요일)에 두었다 — 함수가 시계를 읽으면 틀린다.
- 스펙 R2 의 둘째 변형 `new Date(today).getDay()` 는 `TZ=Asia/Seoul` 에서는 맞는 요일을 낸다(UTC 자정 = KST 09시). 그래서 같은 판정을 `TZ=America/Los_Angeles` 에서도 한 번 더 단언한다(이 변형이 그 단언에서 빨강).
- 호출부(`PlaceCard`)가 `todayKst()` 를 넘기는지는 `PlacePage.test` 의 두 건이 본다 — UTC 일요일 15:30(KST 월) → 「오늘은 정기휴무일」, KST 화요일 → 「월 휴무」. 상수 날짜를 넘기면 둘 중 하나가 빨강이다.

## TG5 — 상세 하단 행동 바 · 절 이동 줄

빨강(구현 전): `AttractionPage.actionBar.test.tsx` 17건 중 13건 실패(바·이동 줄이 없음). 초록 4건은 「없어야 하는」 단언(넓은 화면·IO 없음·허브·링크 둘 미만)이다.

```
$ cd portal-fe && npx vitest run src/pages/place/__tests__/AttractionPage.test.tsx src/pages/place/__tests__/AttractionPage.actionBar.test.tsx src/pages/place/__tests__/visitSummaryGolden.test.ts src/components/share src/components/favorite src/pages/place/__tests__/AttractionAccess.test.tsx src/pages/place/__tests__/cardFacts.test.ts src/pages/place/__tests__/PlacePage && npx tsc -b && npm run build
Test Files  16 passed (16) · Tests  316 passed (316) · tsc exit 0 · build exit 0
$ git diff --exit-code -- <골든 파일 전부(git ls-files | grep golden)>
exit 0
```

- 새 파일은 진짜 `tracker`·`FavoriteButton` 을 쓰고 `wishlistApi` 만 대역이다. 대기열은 `pendingForTest()`.
- matchMedia 대역은 `max-width`·`min-width` 를 폭 변수로 계산한다. IO 대역은 생성 인자(`rootMargin`)와 관찰 대상을 남긴다.
- 단언(17건 · `expect(` 49): ≤640 IO 콜백 전 `hidden` → 행동 줄이 머리띠 밑으로 지나가면 표시 → 돌아오면 `hidden`(아래쪽으로 벗어난 경우는 숨김) · `rootMargin` `-60px 0px 0px 0px` · >640 바·이동 줄 없음 · IO 없음 바 없음 · 허브에 바 없음 · 전화 있으면 넷/없으면 셋 · 길찾기 주소 = 행동 줄 · 공유 칸 `share`「공유」/`copy`「링크 복사」 · 바 별 → 제목 별 `aria-pressed` 동기 · 바 길찾기 `DIRECTIONS`+`source:'action_bar'` · 행동 줄 뒤 바 길찾기는 한 건 · 바 공유 `SHARE`+`channel`·`source` · 행동 줄 전화 `PHONE`(payload 없음) · 바 전화 `PHONE`+`source` · 이동 줄 링크 순서·대상(`div.place-info-tabs` 에 `aria-label`「방문 정보」·`tabindex=-1`) · 클릭 뒤 `activeElement` = 그 절 · 주소 해시 없음 · 두 번째 이동은 대기열에 없음 · 대상 없으면 무동작(계측도 없음) · 링크 둘 미만이면 줄 없음.
- 기존 `AttractionPage.test.tsx` 는 고치지 않았다(그 matchMedia 대역은 `max-width` 를 늘 false 로 돌려 바·이동 줄이 그려지지 않는다).
