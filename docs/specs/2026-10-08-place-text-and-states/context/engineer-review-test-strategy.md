# Engineer Review — test-strategy (1라운드)

대상: `spec.md` (SR-1~SR-6), 작업 트리 origin/main a05ab2765. 세션 결정 ①~⑥은 재론하지 않고, 그 안에서 검증 계획의 결함만 본다.

## Seed Discovery
- 스펙·`planning/initialization.md`·`context/open-questions.yml`, 계획서 S2-1·S2-4 행(`docs/plans/2026-10-08-place-growth-work-plan.md:74,78`), 증거 `s1-6-en-text-defects.md`·`s1-6-hub-ui-check.md`
- 코드 대조: `SearchAttractionService.kt`, `SearchUnifiedService.kt`, `AttractionSeoText.kt`, `AttractionAttributeParser.kt`, `raw-fixtures.tsv`, `AttractionAttributeParserTest.kt`, `SearchAttractionServiceTest.kt`, `SearchUnifiedServiceTest.kt`, `AttractionSearchController.kt`, `PlacePage.tsx`, `placeAttributes.ts`, `placeView.ts`, `copy.mjs`, `UnifiedSearchPage.tsx`, `placeApi.ts`, `PlacePage.test.tsx`, `App.tsx`
- 인용 file:line 확인 결과: `SearchAttractionService.kt:74,83-87,125,169,226`, `SearchUnifiedService.kt:61,73`, `AttractionSeoText.kt:43-57`, `AttractionAttributeParser.kt:26,113,147-158`, `AttractionApiReindexTasklet.kt:221`, `PlacePage.tsx:293-307,470-480,1204-1213,1249-1253,1375-1379,1533,1656`, `placeAttributes.ts:39-55`, `placeView.ts:203,206`, `copy.mjs:844-860`, `UnifiedSearchPage.tsx:230`은 모두 실제 코드와 맞다. 칩 렌더는 `PlacePage.tsx:1298-1319`라 스펙의 `:1297-1318`과 한 줄 어긋나지만 무해하다.

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | 모든 AC 에 테스트 | 부분 — SR-5.3 「검색어가 바뀌면 exact 해제」, SR-5.1 계측 ref·조건 0/1개, exact 응답 `correctedKeyword=null` 에 대응하는 테스트가 없다 (F4·F5·F6) |
| 2 | 계층 배정 | 결함 — 통합 summary 정규화를 목(mock) 경계 너머에서 잰다 (F2). exact 배선의 두 이음매(FE 직렬화·컨트롤러 바인딩)를 재는 계층이 없다 (F4) |
| 3 | 목 경계 | 결함 — `searchAttractions` 목 인자로 exact 를 판정하면 `placeApi` 가 파라미터를 떨어뜨려도 초록이다 (F4) |
| 4 | 테스트 데이터 | 결함 — 멱등성 픽스처가 실측 표본에서 깨진다 (F1). 파서 픽스처 기존 행과 충돌한다 (F3) |
| 5 | 음성·경계 케이스 | 부분 (F5·F6·F8) |
| 6 | 네이밍 | 통과 — Kotest BehaviorSpec given/when/then·vitest 한글 서술형, 기존 파일 관례와 같다 |

## Findings

### F1 (높음) 「`sourceText` 는 멱등」이 거짓이다. 이중 정규화가 실측 표본의 본문을 지운다
- 스펙: SR-2.2 (spec.md:23) — "함수는 멱등이어야 한다: `sourceText(sourceText(x)) === sourceText(x)` 를 테스트로 고정". SR-1.1 (spec.md:17)은 "동작 불변"이라 함수를 고칠 수도 없다.
- 코드: `copy.mjs:849-850` / `AttractionSeoText.kt:48-49` 순서가 **태그 제거 → 엔티티 디코드**다. 그래서 첫 통과에서 디코드된 `&lt;X&gt;` 가 둘째 통과에서 태그로 지워진다.
- 실측 표본: `s1-6-hub-ui-check.md:16` `K-movie &lt;PARASITE&gt; - A town…` 를 따라가 본다.
  - 1회 통과: `K-movie <PARASITE> - …`
  - 2회 통과: `K-movie  - …` (영화 제목이 사라진다)
- 경로: 허브 카드는 목록 API(summarize=true, `SearchAttractionService.kt:125`)를 받는다. SR-1.2 가 서버에서 한 번, SR-2.1 이 FE 에서 한 번 더 정규화한다. 통합 검색은 SR-1.2 + SR-1.3 + SR-2.2 로 최대 세 번이다. 선택 패널은 `fetchAttraction` → `findById`(원문, `PlacePage.tsx:604-608`, `SearchAttractionService.kt:169`)라 한 번이다.
- 결과: 멱등 테스트를 이 표본으로 짜면 빨강이 되어 구현이 막힌다. 무난한 표본으로 짜면 초록인 채 운영에서 내용이 사라진다.
- 수정안:
  - 경로마다 **정확히 한 번** 정규화한다. 목록 요약·통합 summary 는 서버만 하고, 카드(`:1656`)·통합(`UnifiedSearchPage.tsx:230`)은 받은 값을 그대로 그린다. 패널(`:1533`, 원문)만 FE `overviewText` 를 거친다.
  - 멱등 테스트를 지운다. 대신 `&lt;PARASITE&gt;` 픽스처로 다음을 고정한다.
    - Kotest: 요약이 `<PARASITE>` 를 담는다.
    - vitest: 서버 정규화가 끝난 `<PARASITE>` 를 받은 카드·통합 결과가 그 글자를 그대로 보인다.
    - vitest: 원문 `&lt;PARASITE&gt;` 를 받은 패널이 `<PARASITE>` 를 보인다.
  - SR-6.3 회귀 주입 항목도 고친다. 「카드에 FE 정규화를 다시 넣음 → vitest 빨강」, 「서버 요약 정규화 제거 → Kotest 빨강」으로 바꾼다.

### F2 통합 summary 테스트가 실제 입력이 아닌 값을 잰다
- 스펙: SR-1.3 (spec.md:19)·SR-6.2 "통합 summary 정규화".
- 코드: `SearchUnifiedServiceTest.kt:36` 은 `SearchAttractionUseCase` 를 mockk 로 둔다. 실제 입력은 이미 `SearchAttractionService.kt:226` 에서 정규화·절단된 값이다. 그래서 통합 계층에서 원문을 넣어 정규화를 확인하는 테스트는 존재하지 않는 경로를 잰다. 동시에 F1 의 이중 정규화를 정당화한다.
- 수정안: SR-1.3 을 「통합은 관광지 서비스 결과를 그대로 쓴다」로 바꾼다. Kotest 로는 다음 둘만 고정한다.
  - 정규화가 빈 결과라 `overview=null` 이면 `summary` 가 `address` 로 내려간다 (`SearchUnifiedService.kt:73` 의 `?:`).
  - 관광지 외 타입 summary 는 그대로 통과한다.
  - 정규화 자체는 `SearchAttractionServiceTest` 한 곳에서 잰다.

### F3 파서 픽스처: 「행 추가」가 아니라 기존 행 기대값 변경이다
- 스펙: SR-4.2 (spec.md:33) — "`raw-fixtures.tsv` 에 `N/A` 주차 행을 UNKNOWN 기대값으로 추가".
- 코드: `raw-fixtures.tsv:105` `parking	en	NO	N/A (Please use nearby parking facilities)` 가 이미 NO 를 기대한다. `n/a` 를 빼면 이 행이 빨강이 된다. 행을 하나 더하면 `AttractionAttributeParserTest.kt:19` `fixtures.size shouldBe 145` 도 빨강이 된다.
- 수정안: 105행 기대값을 UNKNOWN 으로 바꾸는 것을 명시한다. 행을 추가한다면 145 → 146 도 함께 적는다. 회귀로 「`n/a` 를 `PARKING_NO` 에 되돌림 → 105행 빨강」을 SR-6.3 에 더한다.
- 덧붙임: restDate 의 `N/A (Open all year round)` (`raw-fixtures.tsv:45-51`, `EN_ALWAYS_OPEN` `AttractionAttributeParser.kt:47`)가 ALWAYS_OPEN 그대로인지는 기존 표 검사가 이미 잡는다. 변경 범위가 `PARKING_NO` 만이라는 근거로 한 줄 적어 둔다.

### F4 `exact` 배선의 두 이음매가 테스트 밖이다
- 스펙: SR-5.3 (spec.md:39), SR-6.1 "클릭하면 `exact=true` 질의", SR-6.2 "`exact=true` 면 `correct` 미호출".
- 코드:
  - `placeApi.ts:405-417` 은 필드를 하나씩 `params.set` 한다. `exact` 를 빠뜨리면 서버에 가지 않는다.
  - `PlacePage.test.tsx:7-13` 이 `searchAttractions` 를 목으로 둬서 vitest 는 목 인자만 본다.
  - `AttractionSearchController.kt:44-72` 바인딩은 Kotest 서비스 테스트가 지나간다.
  - FE 목 인자·서비스 분기가 둘 다 초록이어도 운영에서 exact 가 무동작일 수 있다.
- 수정안: 두 케이스를 추가하고, SR-6.3 에 「컨트롤러에서 exact 미전달 → 빨강」을 넣는다.
  - `placeApi.test.ts`: `exact: true` → URL 에 `exact=true`, 없으면 키 없음.
  - `AttractionSearchControllerTest`: `?exact=true` → `Query.exact == true`.
- 빠진 음성 케이스:
  - SR-6.2: exact 일 때 `correctedKeyword == null` 이고 검색 포트가 원문 키워드를 받는다.
  - SR-6.1: exact 를 켠 뒤 검색어를 바꾸면 다음 질의에 `exact` 가 없다(SR-5.3 "검색어가 바뀌면 해제").

### F5 해제 버튼·exact 링크의 계측 trigger 가 정의되지 않았고 테스트도 없다
- 스펙: SR-5.1 (spec.md:37) "그 외 해당 trigger".
- 코드:
  - `SearchTrigger` (`PlacePage.tsx:231-244`)에 「모두 해제」·「원래 검색어」에 맞는 값이 없다.
  - 반경(geo)은 trigger 가 `area`(`:1034`)·`nearMe`(`:1043`) 둘이라 「해당」이 하나로 정해지지 않는다.
  - 계측 묶음은 `other` 가 나오면 실패한다(`PlacePage.test.tsx:412-413`). trigger 를 안 심은 버튼은 운영에서 조용히 `other` 로 집계된다.
- 수정안: 조건별 trigger·changed 값을 표로 확정한다. 표 안에는 모두 해제와 exact 링크를 넣고, 새 값이면 union 에 추가한다고 적는다. SR-6.1 에 「계측 describe 에서 각 해제 버튼·모두 해제·원래 검색어 클릭 → SEARCH payload trigger/changed」 케이스를 더한다.

### F6 0건 조건 집합의 경계 케이스가 계획에 없다
- 스펙: SR-5.1 은 조건 0개(버튼 없음)·1개(모두 해제 없음)를 규정한다. SR-6.1 은 「조건 3개 → 버튼 3 + 모두 해제」와 오류만 시험한다.
- 코드 근거 (화면 상태와 실제 질의가 다른 곳):
  - 행사 분류에서는 고른 속성이 질의에 실리지 않는다(`PlacePage.tsx:353`). 여기서 속성 해제 버튼을 내면 결과를 바꾸지 않는 버튼이 된다.
  - `category == null` 은 기본 관광 분류다(`:340`). 행사 기본 `NOT_ENDED`(`:345-350`)는 사용자가 건 조건이 아니다.
  - 시도를 풀면 `pickingRegion`(`:542`)이 목록을 지역 고르기로 바꾼다.
- 수정안: SR-6.1 에 다음 케이스를 더한다.
  - 조건 0개 → 이유 문장만
  - 조건 1개 → 버튼 1, 모두 해제 없음
  - 행사 분류 + 속성 선택 + 0건 → 속성 버튼 없음
  - 기본 분류·기본 행사 상태는 버튼 없음

### F7 의도된 빨강이 될 기존 단언을 스펙이 열거하지 않는다
- `PlacePage.test.tsx:112` `/^오늘 정기휴무 아님/` 은 새 문구 「오늘 정기휴무일 아님(명절 제외)」과 맞지 않는다.
- `:221` `/^Not closed today/` 는 문구가 바뀌어 빨강이 된다.
- `:222` 영문 `Pets in some areas` 존재 단언은 SR-3.2 와 반대다.
- `:101`·`:213` 의 11칩은 국문 기준이라 유지된다.
- 수정안: 구현자가 「깨진 테스트를 맞춰 고쳤다」와 「의도된 변경」을 구분할 수 있게, 바뀌는 단언을 SR-6 에 적는다.

### F8 (낮음) 언어 전환 테스트 하네스가 실제 라우팅을 거치지 않는다
- `renderPage` (`PlacePage.test.tsx:74-83`)는 `<Routes>` 없이 `PlacePage` 하나를 마운트한다. 그래서 EN 전환 뒤에도 상태가 항상 남는다.
- 실제 앱은 `/`↔`/en`(`App.tsx:214,319`)·`/place`↔`/en/place`(`App.tsx:263-264`)로 다른 Route 를 탄다.
- SR-3.3 테스트는 컴포넌트 로직만 증명한다. 상태가 실제로 이어지는지는 SR-6.4 CDP 확인 항목에 「국문 전용 칩 선택 → EN → 칩 active」 한 줄을 넣거나, 테스트를 App 과 같은 두 Route 로 감싼다.

### F9 (낮음) SR-3.2 칩 목록 문구
- 결과 4종이 되려면 `petAllowed`·`petPartial`(`placeAttributes.ts:44-45`) 둘 다 `only: 'ko'` 여야 한다. 스펙 본문에는 「반려동물 동반」 하나만 적혀 있다. 칩 id 두 개를 명시한다.

## 요약
F1 은 구현 전에 고쳐야 한다. 멱등 테스트가 실측 표본에서 빨강이 되거나, 무난한 표본으로 초록이 된 채 운영에서 본문을 지운다. 다만 세션 결정 ①·⑥ 안에서 「경로마다 한 번 정규화」로 풀 수 있어 사람 판단은 필요 없다. 나머지는 테스트 목록 보강이다.

VERDICT: REVISE
