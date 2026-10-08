# Engineer Review — usecase (1라운드)

- 대상: `docs/specs/2026-10-08-place-text-and-states/spec.md` (+ planning/initialization.md, context/open-questions.yml)
- 근거: 계획서 `docs/plans/2026-10-08-place-growth-work-plan.md:74,78`(S2-1·S2-4), 증거 `evidence/stage1/s1-6-*.md`, 작업 트리 origin/main a05ab2765
- 세션 결정 ①~⑥은 재론하지 않았다. 그 결정을 구현하는 흐름·조건·테스트의 결함만 본다.

## 인용 대조

스펙이 든 file:line 은 전부 실제 코드와 맞다. 확인한 것: `PlacePage.tsx:1533,1656,1375-1379,1297-1318,293-307,1204-1213,1249-1253,470-480`, `placeAttributes.ts:39-55`, `placeView.ts:203,206`, `copy.mjs:844-860`, `AttractionSeoText.kt:43-57`, `AttractionPageRenderer.kt:20-23`, `AttractionJsonLdParityTest.kt:90,92`, `SearchAttractionService.kt:74,83-87,125,169,226`, `SearchUnifiedService.kt:61,73`, `AttractionSearchController.kt:46-72`, `SearchAttractionUseCase.kt:9,84,186-188`, `AttractionAttributeParser.kt:26,113,120,147-158`, `AttractionApiReindexTasklet.kt:221`, `UnifiedSearchPage.tsx:230`.
틀린 이름은 하나다. SR-5.3 의 `SearchAttractionController` 는 실제로 `AttractionSearchController` 다(`search/app/.../presentation/search/controller/AttractionSearchController.kt`). Existing Code 절은 맞는 이름을 쓰고 있다.

## 체크리스트

| # | 항목 | 판정 |
|---|---|---|
| 1 | Actor-goal | 통과. User Stories 3개가 SR 에 대응한다 |
| 2 | Main/Alt/Exception 흐름 | **미흡**. F1·F3·F4 |
| 3 | Pre/Postcondition | **미흡**. F4(해제 뒤 화면 상태 미정) |
| 4 | AC 추적 | 부분 통과. F6 |
| 5 | Edge case 확장 | **미흡**. F1·F2·F4 |
| 6 | 테스트 전략 매핑 | **미흡**. F1·F5 |

## Findings

### F1 [주요] `sourceText` 는 멱등이 아니다 — 서버와 FE 에서 두 번 걸면 원문 글자가 사라진다 (체크 2·5·6)
- 스펙: SR-1.2 는 목록 요약을 서버에서 정규화하고, SR-2.1 은 카드에 `overviewText` 를 다시 건다. SR-2.2 는 "함수는 멱등이어야 한다: `sourceText(sourceText(x)) === sourceText(x)` 를 테스트로 고정"이라고 쓴다.
- 코드: `copy.mjs:849` 와 `AttractionSeoText.kt:48` 은 **태그를 지운 뒤 엔티티를 푼다**. 그래서 첫 번째 호출이 `&lt;…&gt;` 를 `<…>` 로 풀고, 두 번째 호출의 `<[^>]*>` 가 그 부분을 태그로 보고 지운다.
  - 증거 표본이 바로 이 경우다. `s1-6-hub-ui-check.md:16` `K-movie &lt;PARASITE&gt; - A town…` → 1회 `K-movie <PARASITE> - …` → 2회 `K-movie  - …`(작품명이 사라짐).
  - `3 &lt; 5 and 6 &gt; 4` 처럼 부등호가 있는 문장도 2회째에 `< 5 and 6 >` 가 지워진다. `&amp;lt;` 는 호출할 때마다 결과가 달라진다.
  - 기존 테스트 `placeView.test.ts:246` `overviewText('&lt;가&gt; &amp; 나') → '<가> & 나'` 결과를 한 번 더 넣으면 `' & 나'` 가 된다.
- 결과: 허브 카드(서버 정규화 → FE 정규화)와 통합 검색 결과(서버 SR-1.3 → FE SR-2.2)가 엔티티를 없애는 대신 내용을 지운다. SR-2.2 에 적힌 대로 멱등 테스트를 쓰면 이 입력에서 빨강이 나거나, 반례를 피한 입력만 골라 의미 없는 초록이 난다.
- 수정안: 정규화는 **필드마다 한 번만** 하도록 고정한다. ① 목록 요약(`summarize=true`)과 통합 summary 는 서버가 정규화하고 FE 는 그대로 그린다. FE 정규화는 `findById` 원문을 받는 선택 패널(`PlacePage.tsx:604-606` → `:1533`)에만 건다. ② SR-2.2 의 "멱등" 문장과 테스트를 지운다. 대신 `K-movie &lt;PARASITE&gt;<br />…` 픽스처를 API 응답부터 카드 DOM 까지 통과시켜 `<PARASITE>` 가 남는지를 vitest 와 Kotest 양쪽에서 확인한다. ③ SR-6.3 회귀 주입에 "카드에 FE 정규화를 다시 건다 → `<PARASITE>` 소실로 빨강"을 넣는다.
  (서버 사본을 고쳐 멱등으로 만드는 길도 있지만, 그러면 `AttractionJsonLdParityTest` 기준인 copy.mjs 까지 바뀌어 범위가 넓어진다.)

### F2 [주요] 통합 검색 FE 정규화가 관광지 외 타입에도 걸린다 (체크 5)
- 스펙: SR-1.3 은 "관광지 외 타입의 summary 는 손대지 않는다"고 쓰는데, SR-2.2 는 `UnifiedSearchPage.tsx:230` 의 `hit.summary` 전부에 같은 함수를 건다.
- 코드: 이 줄은 타입을 가리지 않고 모든 hit 를 그린다(`UnifiedSearchPage.tsx:227-232`). 개념·블로그 summary 에 `List<String>`·`a < b` 같은 텍스트가 있으면 태그 규칙(`copy.mjs:849`)에 걸려 지워진다.
- 수정안: F1 ①을 따르면 FE 쪽은 할 일이 없다. FE 에서 꼭 걸어야 한다면 `hit.type === ATTRACTION` 일 때만 걸고, 개념 summary `Map<K, V>` 가 그대로 남는지를 테스트에 넣는다.

### F3 [주요] 0건 해제 버튼의 계측 trigger 가 정해지지 않았다 — `other` 0 게이트와 기준선 집계가 깨진다 (체크 2)
- 스펙: SR-5.1 은 "검색어 해제는 `submit`, 그 외 해당 trigger"라고만 쓴다.
- 코드·문서:
  - `SearchTrigger`(`PlacePage.tsx:231-244`)에는 반경(`geo`) 해제, 「모두 해제」, 「원래 검색어로 검색」(SR-5.3)에 맞는 값이 없다.
  - ref 를 비워 두면 `other` 가 된다(`PlacePage.tsx:411`). 계측 스펙은 이를 "0 이어야 한다"는 게이트로 둔다(`docs/specs/2026-10-08-place-hub-instrumentation/spec.md:85`).
  - 검색어 해제를 `submit` 으로 보내면 "검색 제출" 지표(`…/place-hub-instrumentation/spec.md:78`, `trigger IN ('submit',…)`)에 해제가 섞여 숫자가 부풀려진다.
- 수정안: 버튼별 (trigger, changed) 표를 스펙에 넣는다. 예: 검색어 → `('clear', ['keyword','page'])`, 분류 → `('category', …)`, 행사 상태 → `('eventStatus', …)`, 속성 → `('attribute', …)`, 지역 → `('region', …)`, 반경 → `('clear', ['geo'])`, 모두 해제 → `('clear', […])`, 원문 재검색 → `('submit', ['exact'])`. 새 값(`clear` 등)을 넣으면 `SearchTrigger` 타입과 계측 스펙 SR-10 집계 집합(어디에 넣고 어디서 뺄지)을 함께 고친다고 적는다. SR-6.1 에 "해제 클릭 → SEARCH payload.trigger ≠ 'other'" 단언을 추가한다.

### F4 [주요] 「걸린 조건」을 원시 상태로 세면 적용되지 않은 조건이 버튼으로 나온다. 해제 뒤 상태도 정해지지 않았다 (체크 3·5)
- 스펙: SR-5.1 은 조건을 `keyword`·`category`·`listEventStatus`·`attributes`·`sidoCode/sigunguCode/areaCode`·`geo` 상태 그대로 나열한다.
- 코드: 실제 질의에 들어가는 값은 상태와 다르다.
  - 행사 분류이면 `attributes` 는 상태에 남지만 질의에서 빠진다(`PlacePage.tsx:351-353`). 기존 테스트도 이 동작을 고정하고 있다(`PlacePage.test.tsx:154-173`).
  - `listEventStatus` 는 행사 분류일 때만 쓰인다(`:345-347`). 분류를 「전체」로 되돌려도 지워지지 않는다(`:1204-1211`).
  - `areaCode` 는 `sidoCode` 가 있으면 무시된다(`:335`).
  - 상태 그대로 세면 행사 0건 화면에 걸려 있지도 않은 「주차 가능」 해제 버튼이 나오고, 그 버튼을 눌러도 결과가 바뀌지 않는다.
- 해제 뒤 화면이 정해지지 않았다:
  - 검색어를 지울 때 입력창(`keywordInput`)도 비우는지 정해지지 않았다. 비우지 않으면 다음 제출(`runKeywordSearch`, `:1019-1026`)에서 지운 검색어가 다시 걸린다. SR-5.3 의 `exact` 도 함께 풀리는지 적혀 있지 않다.
  - 지역을 풀면 검색어·반경이 없을 때 목록 대신 지역 고르기 화면으로 바뀐다(`pickingRegion`, `:542`·`:1357`). 첫 진입 자동 선택은 다시 돌지 않는다(`autoPickedRef`, `:582-587`). 지역은 시도·시군구를 버튼 하나로 푸는지 둘로 나누는지도 정해지지 않아, SR-6.1 의 "조건 3개 → 버튼 3"이 어떤 조합인지 결정되지 않는다.
- 수정안:
  - 조건은 `query` 메모(`:330-358`)에 실제로 들어간 값에서 만든다고 적는다(속성은 `category !== EVENT_CATEGORY` 일 때만, 행사 상태는 행사일 때만, `areaCode` 는 `!sidoCode` 일 때만).
  - 지역은 "시군구가 있으면 시군구만 풀고(시도로 올라감), 없으면 시도를 푼다"처럼 단위를 하나로 정한다.
  - 사후조건으로 "검색어 해제 = `keywordInput`·`keyword`·`exact` 를 함께 비움", "검색어·반경 없이 시도를 풀면 지역 고르기 화면"을 적는다.
  - SR-6.1 에 "행사 분류 + 속성 선택 + 0건 → 속성 해제 버튼 없음" 케이스를 넣는다.

### F5 [보통] 파서 변경으로 깨지는 기존 테스트·픽스처가 스펙에 없다 (체크 6)
- `raw-fixtures.tsv:105` `parking	en	NO	N/A (Please use nearby parking facilities)` 는 지금 NO 를 기대한다. SR-4.1 을 적용하면 이 행이 빨강이 된다. 그런데 SR-4.2 는 이 행을 고치는 게 아니라 새 행을 "추가"하라고 한다. 이 행은 운영 표본(`attr-raw-values.json:1618`)에서 영문 주차 N/A 로 관측된 **유일한** 값이다. 그러니 기대값을 UNKNOWN 으로 바꾸는 것이 곧 결정 ④를 적용하는 일이다.
- `AttractionAttributeParserTest.kt:19` `fixtures.size shouldBe 145`: 행을 더하면 깨진다.
- `AttractionApiReindexTaskletTest.kt:305,329` `source["attributeParserVersion"] shouldBe 1`: VERSION 2 에서 깨진다(`AttractionSearchDocumentTest.kt:61` 은 입력 리터럴이라 영향이 없다).
- `PlacePage.test.tsx:112` 의 `/^오늘 정기휴무 아님/`(SR-3.1 문구가 「정기휴무일 아님(명절 제외)」으로 바뀜)와 `:222` 영문 `Pets in some areas`(SR-3.2 에서 국문 전용으로 바뀜)도 깨진다.
- 수정안: SR-4.2 를 "`raw-fixtures.tsv:105` 기대값 NO→UNKNOWN(추가 아님)"으로 고친다. SR-6.2 에 위 세 테스트를 고친다고 적고, VERSION 비교는 리터럴 대신 `AttractionAttributeParser.VERSION` 을 쓰게 한다. SR-6.1 에 `PlacePage.test.tsx:112,221-226` 을 갱신한다고 적는다.

### F6 [경미] 추적성·명세 모호 (체크 4)
- SR-3.2 는 「반려동물 동반」 하나만 적었다. 하지만 "영문 4종"이 되려면 `petPartial` 도 국문 전용이어야 한다(`placeAttributes.ts:44-45`). 두 칩 id 를 모두 적는다.
- 계획서 S2-4 완료 조건 "0건·null·정기휴무 오해 사례 0"(`plan:78`) 중 null→불가 쪽을 재는 배포 후 확인이 SR-6.4 에 없다. 재색인 뒤 `lang=en` 문서 중 원문 `parking` 이 `N/A` 로 시작하면서 `attrParking=NO` 인 문서 수 = 0 을 한 줄 추가한다.
- SR-5.3 의 컨트롤러 이름을 `AttractionSearchController` 로 고친다. `exact` 를 FE 질의 타입(`portal-fe/src/api/placeApi.ts` `AttractionQuery`)에 추가한다는 것도 적는다.

## 판정

REVISE — 이슈 6건(주요 4, 보통 1, 경미 1). 결정 ①~⑥과 충돌하는 것은 없다. F1 은 결정 ①·⑥을 구현할 때 정규화를 두 번 거는 경로를 막으면 해결되고, 나머지는 스펙 문장과 테스트 목록을 보강하면 된다.

VERDICT: REVISE
