# Engineer Review — test-strategy (2라운드)

대상: 개정된 `spec.md`(SR-1~SR-7). 이번에 본 것은 네 가지다. SR-7 이 1라운드 F1~F9 를 해소했는지, 각 테스트가 대상의 산출물을 보는지, 회귀 주입이 게이트를 실제로 빨갛게 만드는지, SR-6 테스트 설계가 맞는지.

## Seed Discovery
- 문서: 스펙, `context/engineer-review-test-strategy.md`(1라운드), `context/review-verdict-round1.md`, `docs/standards/test-rules.md`, `docs/research/2026-10-08-vector-leg-filter/report.md:54`
- 대조한 코드:
  - 서버: `CategoryLexiconAdapter.kt`, `CategoryLexiconPort.kt`, `QueryIntent.kt:81,171-190`, `SearchAttractionService.kt:79-133,168-169,226`, `AttractionAttributeParser.kt:113-123`, `raw-fixtures.tsv:96-108`
  - 서버 테스트: `SearchAttractionServiceTest.kt:153-160,226-228`, `AttractionSearchDocumentTest.kt:61`, `AttractionApiReindexTaskletTest.kt:305,329`
  - FE: `App.tsx:111-113,202,206-214,263-264,319`, `PlacePage.tsx:301,1056`, `PlacePage.test.tsx:7-13,74-83,101-227`, `PlacePage.tracking.test.tsx:101-144`, `placeApi.test.ts`(있음). `UnifiedSearchPage` 테스트 파일은 없어서 새로 만들어야 한다.

## 1라운드 지적 해소 여부

| 1라운드 | 해소 | 근거 |
|---|---|---|
| F1 멱등 거짓 | 대부분 해소 | SR-1.3·SR-2 가 「경로마다 한 번」으로 바뀌었고, 카드·서버 `<PARASITE>` 케이스가 SR-7.1·7.2 에 들어갔다. 다만 1라운드 수정안 셋째 항목(패널 `&lt;PARASITE&gt;`)은 빠졌다 → R5 |
| F2 통합이 목을 잰다 | 해소 | SR-7.2 가 overview 를 그대로 쓰는지, null 이면 address 로 내려가는지만 본다 |
| F3 파서 픽스처 | 해소 | SR-4.2 가 `:105` 기대값 변경과 `size 145` 유지를 적었다. 다만 회귀 주입 항목이 없다 → R4 |
| F4 exact 이음매 | 테스트는 해소 | `placeApi` 단위 테스트, 컨트롤러 바인딩, `correctedKeyword == null`, 검색어 변경 시 해제가 모두 들어갔다. 회귀 주입은 없다 → R4 |
| F5 trigger 미정 | 대부분 해소 | `relax` 가 정해졌다. 다만 테스트는 「해제 클릭 → relax」 하나뿐이다. `changed` 축, 「모두 해제」, 「원래 검색어로 검색」 링크는 없다 → R7 |
| F6 0건 경계 | 대부분 해소 | 조건 0개·1개, 행사+속성, 기본 분류·기본 행사 상태가 들어갔다. 지역·반경 분기는 없다 → R7 |
| F7 의도된 빨강 | 해소 | `PlacePage.test.tsx:112,221,222` 를 원문과 대조했다. 세 줄 모두 새 문구·규칙에서 깨진다 |
| F8 Routes 없는 마운트 | 의도는 반영, 경로는 틀림 | R6 |
| F9 petPartial | 해소 | SR-3.2 에 칩 id 두 개가 적혔다 |

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | 모든 AC 에 테스트가 있는가 | 부분 충족. SR-6.3 「한 번도 못 받음 → 코드표 전체」에 테스트가 없다(R1). SR-1.2 「findById 는 원문」을 지키는 테스트가 없다(R5) |
| 2 | 계층 배정이 맞는가 | 결함. SR-6 집계 어댑터를 재는 계층이 없다(R2) |
| 3 | 목 경계가 맞는가 | 결함. SR-6 은 포트 목만으로 판정해서, 집계 요청 모양이 목 경계 밖에 있다(R2). FE 는 `searchAttractions` 목 인자와 `placeApi` 단위 테스트로 두 이음매를 다 잡는다(SR-7.1) |
| 4 | 테스트 데이터 전략 | 결함. SR-6 픽스처에 언어 축이 없다(R3). 0건 「조건 3개」 픽스처의 구성이 정해지지 않았다(R7) |
| 5 | 음성·경계 케이스 | 부분 충족(R1·R5·R7·R8) |
| 6 | 네이밍 | 통과. Kotest BehaviorSpec 이고(`test-rules.md:6`), application 테스트는 포트를 MockK 로 둔다(`:12`). vitest 는 기존 파일의 한글 서술형 관례를 따른다 |

## 산출물을 보는가 (자기 근거 검사)
- 0건 해제는 `searchAttractions` 목 인자, 곧 화면이 API 경계로 내보내는 값을 본다. `placeApi.test.ts` 가 그 값이 URL 로 직렬화되는 것까지 잇는다. 통과.
- `relax` 는 `track` 페이로드를 본다(`PlacePage.tracking.test.tsx:101` 관례). 통과.
- 버전 단언을 `AttractionAttributeParser.VERSION` 으로 바꾸면(SR-4.2) 그 두 단언은 상수 자신과 비교하게 된다. 다만 SR-7.2 의 리터럴 `VERSION == 2` 가 버전을 올렸는지를 따로 잡으므로 허용한다.
- 언어 전환 테스트가 `<Routes>` 를 테스트 안에 다시 적으면 그것은 사본이다 → R6.

## Findings

### R1 (REVISE) SR-6 의 세 상태 중 둘만 테스트한다. 「빈 집합」은 규칙조차 없다
- 스펙: SR-6.3(spec.md:58)은 세 상태를 정한다.
  - 집계 성공 → 코드표와 교집합
  - 실패 → 들고 있던 사전 유지
  - 한 번도 못 받음 → 코드표 전체(오늘 동작)

  SR-6.5(spec.md:60)는 앞의 둘만 테스트한다.
- 빠진 셋째 상태는 위험이 가장 크다. 구현이 「못 받은 집합 = 빈 집합」으로 교집합을 내면 사전이 비고, 분류 의도어 전체가 조용히 꺼진다. 이 일은 배포 직후에 일어난다. 사전 갱신이 배포 직후 첫 시도에서 실패하는 일은 실측된 적이 있다(`CategoryLexiconAdapter.kt:45-48`).
- 집계는 성공했는데 빈 집합이 오는 경우(재색인 중 별칭 전환 등)는 스펙에 규칙이 없다. 기존 어댑터는 빈 코드표면 사전을 바꾸지 않는다(`CategoryLexiconAdapter.kt:57-59`). 교집합이 같은 규칙을 따르는지 정해지지 않았다.
- 수정안:
  - SR-6.5 에 「집계를 한 번도 못 받음 → 코드표 전체 사전」 케이스를 더한다.
  - SR-6.3 에 「집계가 비면 실패로 본다(사전 유지)」를 적고 같은 케이스를 둔다.
  - 판정은 사전 내부가 아니라 `QueryIntent.analyze("템플스테이", lexicon).hasFilter` 처럼 질의 이해의 산출물로 한다. 그러면 증상(0건을 만드는 필터)을 그대로 잰다.

### R2 (REVISE) 집계 요청이 목 경계 밖에 있다
- 스펙: SR-6.3 「색인 조회는 기존 attractions 검색 어댑터 쪽」, SR-6.5 는 교집합만 테스트한다.
- 문제: application 테스트는 포트를 목으로 둔다(`test-rules.md:12`). 그래서 어댑터가 집계를 어떻게 요청하는지는 아무 테스트도 보지 않는다.
  - terms 집계는 버킷 수를 정하지 않으면 상위 10개만 돌려준다. 이렇게 짜도 목 기반 테스트는 모두 초록이다. 운영에서는 수백 코드 가운데 10개만 남아 의도어가 거의 전부 꺼진다.
  - 사전 단어는 깊이별 필드(`lclsSystm1~3`, `QueryIntent.kt:81,187`)에 걸리므로 세 필드를 모두 집계해야 한다.
- 수정안: 이 레포의 요청 캡처 관례(`AttractionReindexCaptureTest.kt`, `UnifiedAttractionRequests.kt`)로 어댑터 테스트를 하나 둔다. 「세 필드를 모두 집계한다」, 「버킷 상한이 코드표 크기 이상이거나 composite 로 끝까지 받는다」를 고정한다. 회귀 주입: 버킷 상한 제거 → 빨강.

### R3 (REVISE) SR-6 의 언어 축이 정해지지 않아 테스트 데이터를 짤 수 없다
- 코드:
  - 검색은 요청 언어 문서만 본다(`SearchAttractionService.kt:104`).
  - 사전은 언어별로 들되 두 언어 이름을 섞어 만든다(`CategoryLexiconAdapter.kt:66-85`).
- 스펙은 SR-6.3 에서 「attractions 색인의 `lclsSystm1~3` 값 집합」 하나만 말한다. 집합이 언어를 가리지 않으면, 국문에만 문서가 있는 코드가 영문 사전에 남는다. 그러면 `lang=en` 질의가 다시 0건이 된다.
- 현재 게이트는 배포 뒤 확인(SR-6.5 의 `lang=en&keyword=temple stay`)뿐이다.
- 수정안: 「언어별 집합과 교집합한다」 또는 「언어를 합친 집합」 중 하나로 정한다. 언어별이면 「ko 에만 문서가 있는 코드 → en 사전에서 빠지고 ko 사전에는 남는다」 케이스를 SR-6.5 에 둔다.

### R4 (REVISE) 회귀 주입 목록이 새 게이트의 절반만 다룬다
- 스펙 SR-7.3(spec.md:72)에는 6개가 있다. 각 항목이 해당 테스트를 실제로 빨갛게 만드는지 따라가 봤다.
  - 패널 정규화 제거: 엔티티가 화면에 남는다.
  - 카드 재정규화 추가: `<PARASITE>` 가 사라진다.
  - 서버에서 자르고 나서 정규화: 경계에 걸린 `&rsq`·`<br /` 조각이 남는다. `sourceText` 정규식은 닫히지 않은 조각을 지우지 못한다.
  - 고른 칩 그리기 제거: 영문 화면에서 국문 전용 칩이 사라진다.
  - exact 분기 제거: `correct` 가 호출된다.
  - 교집합 제거: 해당 코드가 사전에 남는다.

  여섯 개 모두 실제로 빨강이 된다.
- 주입 항목이 없는 새 게이트:
  1. 0건 해제 순수 함수: 기본 분류를 조건에 넣으면 「기본 분류 버튼 없음」이 빨강
  2. `relax`: `triggerRef` 를 안 심으면 `other` 가 나와 빨강
  3. `placeApi` 의 `exact` 직렬화 제거 → 빨강
  4. 컨트롤러 `exact` 바인딩 제거 → 빨강(1라운드 F4 수정안)
  5. `PARKING_NO` 에 `n/a` 를 되돌림 → `raw-fixtures.tsv:105` 빨강(1라운드 F3 수정안)
  6. `petPartial` 의 `only: 'ko'` 제거 → 영문 4종 단언 빨강
  7. `UnifiedSearchPage` 에 정규화 추가 → `List<String>` 단언 빨강
  8. SR-6 의 「실패 시 이전 사전 유지」 제거 → 빨강
- 수정안: 위 여덟 줄을 SR-7.3 에 더한다. 각 주입은 컴파일되는 회귀여야 한다.

### R5 (REVISE) 패널 경로의 이중 정규화를 잡는 테스트가 없다
- 스펙: SR-1.2 는 「`findById` 는 원문 그대로」, SR-2.1 은 「패널만 FE 정규화」다. 이 둘이 함께 지켜져야 패널 경로의 정규화가 한 번이다.
- 지금 테스트로는 잡지 못한다.
  - `findById` 테스트는 평문 `"가".repeat(300)` 으로 길이만 본다(`SearchAttractionServiceTest.kt:226-228`). 서버가 `findById` 에도 정규화를 걸어도 초록이다.
  - SR-7.1 의 패널 픽스처는 `&rsquo;`·`<br />` 다. 이중 정규화가 일어나도 결과가 같은 입력이라 차이가 나지 않는다.
- 결과: 패널이 서버에서 한 번, FE 에서 한 번 정규화되어 `<PARASITE>` 가 지워져도 모든 테스트가 초록이다.
- 수정안: 1라운드 F1 수정안 셋째 항목을 되살린다.
  - vitest: 단건 응답 `&lt;PARASITE&gt;` → 패널에 `<PARASITE>` 가 보인다.
  - Kotest: `findById` 가 `&lt;PARASITE&gt;` 를 그대로 돌려준다.
  - 회귀 주입: `findById` 에 `summarize` 와 같은 정규화를 걸면 → 빨강.

### R6 (MINOR) 언어 전환 테스트의 경로가 틀렸고, 마운트 방식이 정해지지 않았다
- 스펙 SR-7.1 의 경로 `/place/en` 은 존재하지 않는다. 실제 경로는 `/en/place` 다(`App.tsx:264`, `PlacePage.tsx:1056` `navigate(\`/en${base}\`)`). 스펙대로 하네스를 짜면 전환 뒤 아무 라우트에도 맞지 않는다.
- 상태는 `useState` 에 있다(`PlacePage.tsx:301`). 그래서 상태가 이어지는지는 App 이 두 Route 에 같은 element 를 두는지(`App.tsx:263-264`)에 달렸다.
  - 테스트 안에 `<Routes>` 를 다시 적으면 사본을 재는 것이다. 나중에 App 이 `key` 를 붙이거나 다른 래퍼를 써도 테스트는 초록이다.
- 수정안: 경로를 `/en/place` 로 고친다. 마운트는 `App` 자체로 한다. `App` 안에 `BrowserRouter` 가 있으므로(`App.tsx:202`) `window.history.pushState({}, '', '/place')` 뒤 `render(<App />)` 로 마운트한다.

### R7 (MINOR) 0건 픽스처 구성이 정해지지 않았고 지역·반경·계측 세부가 빠졌다
- SR-5.1(spec.md:44-45)에서 가장 갈래가 많은 지역 해제에 테스트가 없다. 지역 해제는 세 단계와 「`sidoCode` 가 있으면 `areaCode` 는 질의에 없다」(`:335`), 그리고 `pickingRegion` 전환으로 이루어진다. 반경 해제도 테스트가 없다.
- 수정안: 다음 케이스를 SR-7.1 0건 항목에 더한다.
  - 시군구 선택 + 0건 → 지역 버튼 1개. 누르면 다음 질의가 `sidoCode` 만 갖는다.
  - `areaCode`·`sidoCode` 둘 다 있으면 버튼은 시도 하나뿐이다.
  - 시도만 있고 검색어가 없을 때 풀면 지역 고르기 화면이 나온다.
  - `geo` 를 풀면 다음 질의에 `lat`·`lng` 가 없다.
  - 「모두 해제」를 누르면 다음 질의에 사용자 조건이 하나도 없고 입력창이 빈 값이다.
  - 계측: 각 해제·「모두 해제」·「원래 검색어로 검색」 → `trigger='relax'` 이고 `changed` 에 푼 축 이름이 있다(1라운드 F5).

### R8 (MINOR) 서버 요약의 길이 경계
- 정규화한 뒤 자르면 「…」를 붙일지 정하는 기준이 원문 길이에서 정규화 길이로 바뀐다(`SearchAttractionService.kt:226` 의 `it.length > 200`).
- 수정안: 「원문 250자, 정규화 150자 → `…` 없음」 케이스를 하나 둔다. 「서버에서 자르고 나서 정규화」 회귀를 잡는 근거가 경계 조각 하나에서 둘로 는다. 경계 케이스는 조각이 없다는 것만 보지 말고 기대 문자열 전체로 단언한다.

## 요약
F1~F9 는 R5(F1 의 패널 항목)를 빼면 해소됐다. 남은 결함은 주로 새로 들어온 SR-6 에 있다.
- 세 상태 중 하나와 빈 집합 규칙이 없다(R1).
- 집계 요청이 목 경계 밖에 있다(R2).
- 언어 축이 정해지지 않았다(R3).

회귀 주입 목록은 적힌 6개가 모두 실제로 빨강이 되지만, 새 게이트 8개가 빠졌다(R4). 모두 스펙 결정 안에서 고칠 수 있어 사람 판단은 필요 없다.

VERDICT: REVISE
