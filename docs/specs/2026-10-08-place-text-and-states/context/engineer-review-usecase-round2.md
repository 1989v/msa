# Engineer Review — usecase (2라운드)

- 대상: `docs/specs/2026-10-08-place-text-and-states/spec.md`(개정본), 1라운드 `context/engineer-review-usecase.md`, 심판 `context/review-verdict-round1.md`
- 대조 코드: 워크트리 `wt-impl` 의 `portal-fe/src/pages/place/PlacePage.tsx`, `search/app/.../client/CategoryLexiconAdapter.kt`, `search/domain/.../query/model/QueryIntent.kt`, `docs/specs/2026-10-08-place-hub-instrumentation/spec.md`, `docs/research/2026-10-08-vector-leg-filter/report.md`
- 헤더 결정 ①~⑦은 재론하지 않는다. 그 결정을 구현하는 흐름의 결함만 본다.

## 1라운드 반영 확인

| 묶음 | 반영 | 근거 |
|---|---|---|
| G3 해제 버튼 = 실제 질의 기준 순수 함수 | 반영. 축별 포함 조건이 `query` 메모와 맞다(속성 `:353`, 행사 상태 `:345-350`, `areaCode` `:335`, 기본 분류 `:340`) | spec.md:39-47 |
| G4 `relax` trigger · 집계 표 | 반영. 집계 표 갱신은 "같은 커밋에서"로 구현 단계에 넘겼다 | spec.md:4(⑦), :49 |
| G9 `exactFor` | 반영. `exact: exactFor != null && exactFor === keyword` | spec.md:51 |
| G11 `petPartial` | 반영 | spec.md:29 |
| G12 컨트롤러 이름 | 반영. `AttractionSearchController.kt:44-72` 는 실제 `@GetMapping`(`:44`) 범위와 맞다 | spec.md:51, `AttractionSearchController.kt:26,44` |

## 결정 ⑦ 과 계측 스펙 SR-10 의 정합

모순은 없다.
- 「검색 제출」·「필터 적용」은 허용 목록(`IN (...)`)이라 `relax` 가 저절로 빠진다(`place-hub-instrumentation/spec.md:78-79`).
- 「결과 view」는 `trigger != 'landing'` 이라 `relax` 가 저절로 들어간다(`:80`).
- 그래서 「건수에서 빼는 것」 행(`:84`)에 `relax` 를 적는 일은 문서 보강이다. 쿼리 정의는 바뀌지 않는다.

남는 것은 새로 더하는 「0건 복구」 행의 정의와 `pickingRegion` 경로다(R2-3).

## 체크리스트

| # | 항목 | 판정 |
|---|---|---|
| 1 | Actor-goal | 통과. SR-6 은 「템플스테이를 친 방문자가 0건을 받지 않는다」로 User Story 2 에 붙는다 |
| 2 | Main/Alt/Exception 흐름 | **미흡**. R2-1(지역 해제가 반경까지 푼다), R2-6 |
| 3 | Pre/Postcondition | **미흡**. R2-1·R2-4 |
| 4 | AC 추적 | **미흡**. R2-3·R2-4 |
| 5 | Edge case 확장 | **미흡**. R2-2(언어별 색인 집합) |
| 6 | 테스트 전략 매핑 | 부분 통과. R2-1·R2-2 케이스가 SR-7 에 없다 |

## Findings

### R2-1 [주요] 지역 해제를 `selectRegion` 으로 하면 반경까지 풀리고 trigger 가 `relax` 로 남지 않는다 (체크 2·3·6)
- 스펙: 「해제는 기존 `selectRegion`(`:548-573`)으로 한 단계 위로 올린다」, 「버튼마다 그 조건 하나만 풀고」, 「`'relax'` 를 `triggerRef` 에 심고」(spec.md:44,47,49).
- 코드: `selectRegion` 이 하는 일은 셋이다.
  - `trigger` 인자 타입이 `'initial' | 'region'` 이다(`PlacePage.tsx:551`).
  - 그 값을 `triggerRef` 에 직접 넣는다(`:556`).
  - `changedRef` 를 `['sidoCode', 'sigunguCode']` 로 덮고(`:557`) `setGeo(null)` 을 부른다(`:561`).
- 내 주변·이 지역 검색은 시도를 지우지 않는다(`:1041-1047`, `:1028-1039`). 그래서 시도와 반경이 함께 질의에 실린 0건이 정상 경로에서 생긴다. 이때 지역 버튼을 누르면 반경 조건도 같이 사라지고, 계측에는 `region` 이 찍힌다. `relax` 로 심어도 `selectRegion` 이 덮어쓴다.
- 수정안: SR-5.1 에 두 가지를 정한다.
  - `selectRegion` 의 trigger 인자에 `'relax'` 를 더하고 `changedRef` 를 그대로 둔다.
  - 지역 해제에서 반경을 유지할지 함께 풀지 정한다. 유지하려면 `selectRegion` 의 `setGeo(null)` 을 인자로 끄거나, 해제 전용으로 `setSidoCode`/`setSigunguCode` 를 부르고 지도 이동만 공유한다.
  - SR-7.1 0건 케이스에 「시도+반경 0건에서 지역 해제 → 질의에 반경 유지(또는 정한 동작), trigger `relax`」를 한 줄 더한다.

### R2-2 [주요] SR-6 색인 집합을 언어별로 나누지 않으면 영문에서 같은 0건이 남는다 (체크 5·6)
- 스펙: 「attractions 색인의 `lclsSystm1~3` 값 집합을 집계로 받아 코드표와 교집합한다」(spec.md:58). 언어 구분이 없다.
- 코드: 사전은 언어마다 따로 만든다(`CategoryLexiconAdapter.kt:80-85`). 질의는 요청 언어 사전으로 분석한다(`:39-40`). 그런데 사전은 한영 이름을 한 사전에 함께 넣는다(`:66-73`). 그래서 영문 질의도 국문 이름으로 만든 분류 코드에 걸린다.
- 결과: 국문 문서에만 있는 코드는 전체 언어 합집합으로 보면 「문서 1건 이상」을 통과한다. 그 코드가 영문 사전에 남아 영문 질의가 0건이 된다. 증상 보고서도 「temple stay」(영문)를 함께 들고 있다(`report.md:54`). 영문 문서는 국문보다 적어서(SR-3.2 의 영문 채움 0 근거와 같은 성질) 이 경우가 드물지 않다.
- 수정안:
  - SR-6.3 을 「언어별로 집계한 코드 집합과, 그 언어 사전을 교집합한다」로 고친다.
  - SR-6.5 테스트에 「국문 문서에만 있는 코드는 ko 사전에 남고 en 사전에서 빠진다」를 더한다.

### R2-3 [보통] 「0건 복구」 행의 정의가 이름과 다른 것을 센다 (체크 4)
- 스펙: 「0건 복구」 = `trigger='relax'` 의 `uniqExact(view_id)`(spec.md:49).
- 문제는 세 가지다.
  - 「원래 검색어로 검색」도 `relax` 다(spec.md:49). 그런데 교정 안내는 결과가 1건 이상일 때도 보인다(지금 `PlacePage.tsx:1378`, SR-5.3 은 0건까지 넓힌다). 그래서 0건이 아닌 화면에서 누른 것도 센다.
  - 해제 뒤 결과가 또 0건이어도 센다. payload `total` 이 있어 거를 수 있다(`PlacePage.tsx:436`).
  - 해제로 `pickingRegion` 이 참이 되어도(spec.md:47) SEARCH 는 간다. `useQuery` 에 `enabled` 가 없고(`:360-373`) 화면은 카드 대신 지역 고르기다(`:1357-1372`). 이 view 는 「결과 view」(`place-hub-instrumentation/spec.md:80` 「카드가 그려진 view 전부」)와 「0건 복구」에 모두 들어간다.
- 수정안: 행 이름을 「0건 해제 시도」로 바꾼다. 또는 복구를 `trigger='relax' AND JSONExtractInt(payload,'total') > 0` 으로 정의하고, 지역 고르기로 넘어간 view 의 처리(분모 포함 여부)를 한 문장으로 적는다. 결과 view 의 「카드가 그려진」 문구와 어긋나는 점도 같은 커밋에서 주석으로 남긴다.

### R2-4 [보통] SR-6 이 증상을 고친다는 사전 근거가 없다 — 잔여 검색어가 BM25 에 걸리는지 미확인 (체크 3·4)
- 스펙: 수용 기준은 배포 뒤 `total > 0` 하나다(spec.md:60).
- 코드: 지금은 질의 전체가 사전에 맞아 잔여가 `null` 이다(`QueryIntent.kt:243-246`). 사전에서 코드가 빠지면 「템플스테이」가 키워드로 남는다. 그런데 키워드에 안 걸리는 문서는 하이브리드에서 나올 수 없다(`report.md:48`).
  - 본문·제목에 「템플스테이」가 든 문서 수는 어디에도 재지 않았다.
  - 「temple stay」는 두 어절이라 어절 창이 「temple」만 다른 분류(사찰 등)로 잡을 수 있다(`QueryIntent.kt:248` 이하). 그러면 잔여는 「stay」가 된다.
  - 즉 SR-6 를 구현해도 0건이 그대로일 수 있다. 그때는 배포 뒤 확인에서야 드러난다.
- 수정안: SR-6.1 에 착수 전 측정 한 줄을 넣는다. ko/en 각각 attractions 색인에서 해당 검색어의 매치 건수와, 「temple stay」를 `QueryIntent.analyze` 에 넣었을 때의 결과(facets·residual)를 적는다. 둘 중 하나가 0 이면 SR-6 범위를 다시 정한다.

### R2-5 [경미] `changed` 값이 기존 어휘와 다르다 (체크 4)
- 스펙: 푼 축 이름 `keyword`·`category`·`eventStatus`·`attribute`·`region`·`geo`·`exact`(spec.md:49).
- 코드: 기존 `changed` 는 상태 필드 이름이다. 예: `['attributes','page']`(`PlacePage.tsx:472`), `['sidoCode','sigunguCode']`(`:557`), `['category','listEventStatus','page']`(`:1208`), `['listEventStatus','page']`(`:1280`), `['areaCode']`(`:1251`).
- 계측 스펙도 「여러 필드를 바꾸면 `changed` 에 전부 적고」라고 쓴다(`place-hub-instrumentation/spec.md:32`). 축 이름을 섞으면 `changed` 로 묶는 집계가 두 어휘를 동시에 다뤄야 한다.
- 수정안: 실제로 바꾼 필드 이름(`attributes`·`listEventStatus`·`sidoCode`/`sigunguCode`/`areaCode`·`keyword`·`geo`·`exact` + `page`)으로 맞춘다.

### R2-6 [경미] 「모두 해제」의 사후 상태가 정해지지 않았다 (체크 2)
- 스펙: 「2개 이상이면 「모두 해제」 버튼 하나」(spec.md:47). 개별 버튼은 지역을 한 단계만 올린다. 그런데 모두 해제가 지역을 한 단계만 올리는지, 시도까지 다 푸는지는 적혀 있지 않다.
- 모두 해제를 누르면 검색어·반경이 함께 풀린다. 그래서 지역을 끝까지 풀면 늘 `pickingRegion`(`PlacePage.tsx:542`)이 되고, 결과 목록 대신 지역 고르기 화면이 나온다. 자동 시도 선택도 다시 돌지 않는다(`:582-587`).
- 수정안: 「모두 해제 = 순수 함수가 낸 각 조건을 개별 버튼과 같은 규칙으로 한 번씩 푼다(지역은 한 단계)」처럼 정한다. SR-7.1 의 「조건 3개 → 버튼 3 + 모두 해제」 케이스에 모두 해제 뒤 질의 인자도 단언한다.

## 판정

REVISE — 이슈 6건(주요 2, 보통 2, 경미 2).
- 결정 ①~⑦ 과 충돌하는 것은 없다. ⑦ 은 계측 스펙 SR-10 의 쿼리와 모순되지 않는다.
- R2-1 은 스펙 문장(「한 조건만」·「relax 를 심는다」)과 재사용하라고 지정한 함수의 동작(`PlacePage.tsx:551,556,561`)이 부딪히는 문제다. 구현자가 둘 중 하나를 깨게 된다.
- R2-2 는 SR-6 가 영문 증상을 못 고칠 수 있는 구멍이다.
- 나머지는 문장 보강으로 닫힌다.

VERDICT: REVISE
