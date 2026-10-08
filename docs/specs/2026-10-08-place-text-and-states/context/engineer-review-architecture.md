# Engineer Review — architecture (1라운드)

- 대상: `docs/specs/2026-10-08-place-text-and-states/spec.md` (S2-1 · S2-4)
- 작업 트리: `wt-impl` (origin/main a05ab2765)
- 범위: 레이어·의존 방향·모듈 경계·정보 은닉·심(seam). 세션 결정 ①~⑥은 재론하지 않고 그 안의 결함만 본다.

## 판정: REVISE (이슈 4 — 중 2, 하 2)

## 인용 대조

스펙이 인용한 file:line 은 모두 실제 코드와 맞다.

- `SearchAttractionService.kt:74`(상수) · `:83-87`(교정) · `:125`(summarize=true) · `:169`(findById summarize=false) · `:226`(자르기)
- `SearchUnifiedService.kt:61` · `:73`
- `AttractionSearchController.kt:44-72`
- `SearchAttractionUseCase.kt:9` · `:84` · `:187-188`
- `AttractionAttributeParser.kt:26` · `:113` · `:120` · `:149` · `:158`
- `AttractionApiReindexTasklet.kt:221`(VERSION 로그는 `:355`)
- `AttractionPageRenderer.kt:20-23` · `AttractionJsonLdParityTest.kt:90,92`
- `PlacePage.tsx:1533` · `:1656` · `:1375-1380` · `:293-307` · `:1204-1213` · `:1249-1253` · `:470-480`
- `placeAttributes.ts:39-55` · `UnifiedSearchPage.tsx:230` · `copy.mjs:844-859` · `placeView.ts:203,206`

## 통과한 항목

- **레이어·의존 방향**: `SearchAttractionService` 는 application 계층(`application/attraction/service`)이라 `infrastructure/render/AttractionSeoText` 를 import 할 수 없다(`docs/conventions/package-structure.md:84-88`, 게이트 `verifyLayerDependencies`). 이 함수는 정규식만 쓰는 순수 함수라 search:domain 으로 옮기는 것이 맞는 방향이다. search:domain 의존(`search/domain/build.gradle.kts:4-6`)도 늘어나지 않는다.
- **포트·심**: 새 인터페이스나 포트가 없다. `exact` 는 컨트롤러 → `UseCase.Query` → 서비스 분기로 흐르고, 기존 `correctedKeyword`(`SearchAttractionUseCase.kt:187-188`)와 같은 경로를 쓴다. `SearchUnifiedService.kt:62` 는 Query 를 이름 붙은 인자로 만들기 때문에, 기본값 false 인 필드를 더해도 깨지지 않는다.
- **파서**: 변경이 domain 안에서 끝난다. 재색인 배치가 `VERSION` 을 로그로 남기므로(`AttractionApiReindexTasklet.kt:355`) 배포 뒤 확인(SR-6.4)이 실제 산출물을 본다.
- **순환 의존·트랜잭션**: 해당 없음(읽기 경로뿐이다).

## 발견

### A-1 (중) 정규화를 두 번 거치게 설계됐는데, `sourceText` 는 두 번 거쳐도 결과가 같지 않다 — 실제 원문이 깨진다

- 스펙 근거: SR-1.2(`spec.md:18`)는 서버가 목록 overview 를 정규화한다고 정했다. 그런데 SR-2.1(`spec.md:22`)은 허브 카드 `:1656` 에서 같은 값에 `overviewText` 를 한 번 더 걸게 했다. SR-2.2(`spec.md:23`)도 「서버가 정규화해도 FE 가 이중으로 걸어 안전 — 함수는 멱등이어야 한다」고 적었다. SR-1.3(`spec.md:19`)은 `execute()` 가 이미 정규화한 overview 를 `SearchUnifiedService.kt:73` 에서 다시 정규화하게 읽힌다.
- 코드 근거: `copy.mjs:849-850` 와 `AttractionSeoText.kt:48-49` 는 **태그를 먼저 지우고 그다음 엔티티를 디코드한다**. 그래서 디코드 결과에 `<…>` 가 생기면, 두 번째 호출이 그것을 태그로 보고 지운다. 기존 테스트 `placeView.test.ts:246` 은 `'&lt;가&gt; &amp; 나'` → `'<가> & 나'` 를 고정하고 있다. 이 출력을 다시 넣으면 `' & 나'` 가 된다. `&amp;rsquo;` 도 한 번이면 `&rsquo;`, 두 번이면 `’` 다.
- 실데이터: 1단계 증거 `s1-6-hub-ui-check.md:16` 의 영문 카드 원문 `K-movie &lt;PARASITE&gt;` 는 서버를 거치면 `K-movie <PARASITE>` 가 되고, FE 를 한 번 더 거치면 `K-movie ` 로 **작품명이 사라진다**.
- 범위가 넓어지는 곳: `UnifiedSearchPage.tsx:230` 은 모든 타입의 `hit.summary` 를 그린다. SR-2.2 를 그대로 구현하면 개념 사전·블로그 요약의 `List<String>` 같은 본문도 잘린다. SR-1.3 이 「관광지 외 타입은 손대지 않는다」고 한 것과도 어긋난다.
- SR-2.2 의 멱등 테스트는 위 입력을 넣으면 실패한다. 통과시키려면 `<`·`&amp;` 가 없는 입력만 고르게 되므로, 검사가 대상이 아니라 자기가 고른 입력을 재게 된다.
- 수정안 (결정 ① 안에서):
  1. 응답 필드의 뜻을 하나로 고정한다. `SearchAttractionUseCase.kt:83-84` 의 KDoc 에 「목록(`execute`) overview = 정규화된 평문 요약, 단건(`findById`) overview = 원천 원문」을 적고, 통합 검색 `summary` 도 평문이라고 적는다.
  2. FE 는 **원문을 받는 자리에서만** 정규화한다. 선택 패널 `:1533` 은 `fetchAttraction`(`PlacePage.tsx:604-608`, `findById` 의 원문)을 받으므로 `overviewText` 를 건다. 허브 카드 `:1656` 와 통합 검색 `:230` 은 서버가 정규화한 값을 그대로 텍스트로 그린다. React 가 이스케이프하므로 `<PARASITE>` 가 글자로 보이고 안전하다.
  3. SR-1.3 은 코드를 바꾸지 않는다. `execute()` 결과를 그대로 쓰므로 정규화된 값이 이미 들어온다. 테스트만 둔다. 정규화 결과가 빈 값이면 null 이 되어 `?: it.address` 로 넘어가는 동작은 그대로 맞다.
  4. SR-2.2 의 멱등 요구와 SR-6.1 의 「`sourceText` 멱등」을 지우고, 대신 다음 두 테스트를 둔다. 서버 Kotest 에서는 `&lt;PARASITE&gt;` 원문의 목록 요약이 `<PARASITE>` 를 보존하는지 본다. vitest 에서는 카드에 `<PARASITE>` 가 든 응답을 줬을 때 화면 텍스트에 `<PARASITE>` 가 남는지 본다.
  5. SR-6.3 의 회귀 주입 「카드 정규화 제거 → vitest 빨강」은 「서버 정규화 순서를 되돌림 → Kotest 빨강」과 「패널 정규화 제거 → vitest 빨강」으로 바꾼다.

### A-2 (중) 0건 화면의 「걸린 조건」을 화면 상태에서 다시 나열하면, 실제 질의와 어긋나는 버튼이 생긴다

- 스펙 근거: SR-5.1(`spec.md:37`)은 조건을 상태 변수 목록(`keyword`·`category`·`listEventStatus`·`attributes`·`sidoCode/sigunguCode/areaCode`·`geo`)으로 정의한다.
- 코드 근거: 실제 질의는 `PlacePage.tsx:330-358` 의 `query` 메모가 정하고, 상태와 다르다.
  - `:335`: `sidoCode` 가 있으면 `areaCode` 를 보내지 않는다.
  - `:353`: 행사 분류에서는 `attributes` 를 질의에서 뺀다.
  - `:340`: `category` 가 null 이면 기본 분류 목록을 보낸다. 사용자가 건 조건이 아니다.
  - `:347`: `listEventStatus` 가 null 이면 `NOT_ENDED` 를 보낸다. 이것도 사용자가 건 조건이 아니다.
  질의에 들어가지 않은 조건에 해제 버튼을 그리면, 눌러도 `queryKey`(`:361`)가 같아 새 질의가 나가지 않는다. 그러면 방금 세팅한 `triggerRef`·`changedRef` 가 소비되지 않고 남는다(`:408-414`). 남은 값은 **다음 검색의 trigger 로 잘못 기록된다**.
- 지역 해제의 부수 효과: 검색어도 반경도 없을 때 지역을 풀면 `pickingRegion`(`:542`)이 참이 되고, 목록 대신 지역 고르기 화면(`:1357`, `:1373`)이 나온다. 검색어를 풀 때도 시도가 없으면 같은 일이 생긴다. 스펙에는 이 결과가 적혀 있지 않다.
- 수정안:
  1. 조건 목록을 순수 함수 하나(예: `placeView.ts` 의 `activeConditions(state)`)가 만들게 한다. 기준은 「풀었을 때 `query` 가 실제로 바뀌는 것만 넣는다」이다. `:335`·`:340`·`:347`·`:353` 의 규칙을 이 함수가 따르게 하고, vitest 로 고정한다(행사 분류 + 속성 선택 → 속성 버튼 없음).
  2. 지역 해제는 새 setter 를 줄줄이 부르지 말고 기존 `selectRegion({ sidoCode: null, sigunguCode: null }, 'region')`(`:548-573`)을 재사용한다. 이 함수가 trigger·changed·`areaCode`·`geo`·`selectedId`·지도를 한 번에 맞춘다.
  3. 지역이나 검색어를 풀면 지역 고르기 화면으로 갈 수 있다는 점을 SR-5.1 에 한 줄 적는다.

### A-3 (하) 옮길 위치와 이름이 패키지 규약·용도와 어긋난다

- 스펙 근거: SR-1.1(`spec.md:17`)은 새 패키지 `com.kgd.search.domain.text` 를 만든다.
- 코드·문서 근거:
  - 규약은 `domain/{entity}/model|policy`(`docs/conventions/package-structure.md:19-25`)다. 엔티티 축이 없는 선례(`domain/embedding/VectorCodec.kt`, `domain/eval`)가 있어 위반은 아니다. 다만 이 객체는 이름부터 `Attraction…` 이라 `domain/attraction/model` 이 자연스러운 자리다.
  - 이름의 `Seo` 는 렌더 전용이던 시절의 이름이다. 이제 application 의 목록 요약도 쓴다.
  - `escapeHtml`·`clampDescription` 은 렌더만 쓰는데, 함께 domain 으로 내려간다(`AttractionSeoText.kt:59-71`).
- 수정안 (최소 수정 기준): 객체를 쪼개지 않고 통째로 `com.kgd.search.domain.attraction.model` 로 옮긴다. copy.mjs 와 짝을 이루는 세 함수가 한 파일에 있어야 「copy.mjs 를 고치면 여기도 고친다」(`AttractionSeoText.kt:8`)가 유지된다. 이름은 그대로 두거나 `AttractionSourceText` 로 바꾸되, 어느 쪽이든 스펙에 한 줄로 확정한다.

### A-4 (하) `exact` 해제를 동작(effect)이 아니라 상태 모양으로 보장한다

- 스펙 근거: SR-5.3(`spec.md:39`)은 「검색어가 바뀌면 해제」라고만 적었다.
- 코드 근거: 불리언 상태로 두면 검색어가 바뀌는 경로마다 해제 코드를 넣어야 한다. 그런 경로는 제출·제안 선택·검색어 해제 버튼 등 여러 곳이다. `query` 메모(`:330-358`)는 의존성으로 이 값을 받아 그대로 실을 뿐이다.
- 수정안: 「원래 검색어로 검색」을 누른 순간의 검색어를 상태로 저장한다(`exactFor: string | null`). 질의에는 `exact: exactFor === keyword || undefined` 를 싣는다. 그러면 검색어가 바뀌는 즉시 구조적으로 풀리고, 해제를 빠뜨릴 경로가 없다. 뽑기(`:1146`)는 `query` 를 펼쳐 쓰므로 따로 손댈 필요가 없다.

## Deletion Test

새 모듈(1파일 이상)은 없다. `AttractionSeoText` 는 이동만 한다. 사용처가 렌더 2곳과 서비스 1곳으로 흩어져 있어, 지우면 복잡도가 여러 호출자로 흩어진다. 따라서 존재 이유가 있다.

VERDICT: REVISE
