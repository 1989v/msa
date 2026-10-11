# 회귀 주입 — 방문 근거 하한·이름 (TG1)

워킹트리가 아니라 임시 사본(스크래치패드 `regress-tg1/`, `node_modules`·`build`·`.git` 을 뺀 rsync 사본 + `node_modules` 심링크)에서 했다.
주입은 하나씩 넣고 검사를 돌린 뒤 원본으로 되돌렸다(`cmp` 로 원본과 같은지 확인). 모든 주입은 **컴파일·타입체크를 통과하는 회귀**다 —
구문 오류로 난 빨간불은 증거가 아니라서다.

판정 근거: 하한 검사는 리터럴 경계(찜 2·3, 클릭 4·5)와 **Kotlin 파일에서 뽑은 값**이고, 이름 검사는 서버 렌더 소스의 문자열 리터럴이다.
테스트 안에 하한을 상수 이름으로 적은 곳은 없다.

| # | 주입 (사본) | 컴파일 | 빨개진 테스트 |
|---|---|---|---|
| R1 | `visitSignals.ts` `SAVED_MIN = 3` → `2` | `npx tsc -b` exit 0 | `visitSignals.test.ts` 「하한 — 리터럴 경계 > 하한 값」 · 「찜 2 → 줄 없음, 3 → 줄 있음」, `visitSignalsGate.test.ts` 「찜 하한: visitSignals SAVED_MIN == AttractionSaveSignal.SAVED_MIN」 (3 failed / 23) |
| R2 | `visitSignals.ts` `FREQUENTLY_CLICKED_MIN = 5` → `4` | `npx tsc -b` exit 0 | 「하한 값」 · 「placeAttributes 는 같은 값을 다시 내보낸다(사본 아님)」 · 「클릭 4 → 줄 없음, 5 → 줄 있음」 · 「클릭 하한: visitSignals FREQUENTLY_CLICKED_MIN == AttractionClickSignal.MIN_SAMPLE」 (4 failed / 23) |
| R3 | search/domain `AttractionSaveSignal.SAVED_MIN = 3` → `2` | `:search:domain:test` 가 컴파일 후 실행 | `AttractionSaveSignalTest` 「하한은 3명이다」 · 「2명 이하·값 없음은 근거가 아니다」 (3 중 2 failed), `visitSignalsGate.test.ts` 「찜 하한 …」 (1 failed / 10) |
| R4 | `RegionPage.tsx` 에 `[...xs].sort((a, b) => (b.congestion ?? 0) - (a.congestion ?? 0))` 함수 한 개 | `npx tsc -b --force` exit 0 | `visitSignalsGate.test.ts` 「portal-fe/src/pages/place/RegionPage.tsx 에 congestion 정렬·순위가 없다」 (1 failed / 10) |
| R5 | `AttractionPageRenderer.kt` 에 `private const val REGRESSION_POPULAR = "인기 관광지"` | `:search:app:compileKotlin` BUILD SUCCESSFUL | 「서버 렌더 문구 > 「인기」「많이 본」「핫플」이 없다」 |
| R6 | 같은 파일에 `private const val REGRESSION_SITE = "이 사이트 방문자 클릭"` (R5 와 한 번에 컴파일) | 〃 | 「서버 렌더 문구 > 이 사이트 근거 문구에 「방문자 · visitor」가 없다」 (R5·R6 2 failed / 10, 각자 다른 테스트) |

명령(사본 루트에서):

```bash
(cd portal-fe && npx tsc -b && npx vitest run src/pages/place/__tests__/visitSignals.test.ts src/pages/place/__tests__/visitSignalsGate.test.ts)
./gradlew :search:domain:test --tests '*AttractionSaveSignal*'
./gradlew :search:app:compileKotlin
```

못 잡는 것(알고 둔다): `placeAttributes.ts` 가 다시 내보내기 대신 **같은 값 5** 의 사본 상수를 두면 초록이다 — 값이 어긋나는 순간(R2)부터 잡힌다.
서버 렌더 금지어 검사는 문자열 리터럴만 보므로, 문구를 다른 파일에서 가져와 조립하면 그 파일은 보지 않는다(지금 렌더러 문구는 전부 이 파일 리터럴이다).

남은 회귀 주입(TG6.7): batch 가 넘기는 `min` 2 · 「직선거리」 문구 빼기 · 헤더 검사 한 줄 삭제 — 해당 코드가 생기는 TG3·TG5·TG6 에서.
