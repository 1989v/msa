<!-- source: portal-fe/src/pages/place/PlacePage.tsx, portal-fe/src/pages/place/placeAttributes.ts, portal-fe/src/seo/copy.mjs, portal-fe/src/pages/search/UnifiedSearchPage.tsx, search/app/src/main/kotlin/com/kgd/search/application/attraction/service/SearchAttractionService.kt, search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionSeoText.kt, search/app/src/main/kotlin/com/kgd/search/presentation/search/controller/AttractionSearchController.kt, portal-fe/src/api/placeApi.ts, search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionAttributeParser.kt -->
# Specification: place 원문 정제 + 상태 규칙 (S2-1 · S2-4)

> 2026-10-08. 근거: 계획서 S2-1·S2-4 행, 1단계 증거 `evidence/stage1/s1-6-*.md`. 세션 결정(사용자 「내가 안 해도 되는 건 먼저 적용」): ① 정규화는 표시 시점, 원천은 덮지 않는다(data-sources §0 ②) — 서버 정규화 함수를 search:domain 으로 옮겨 **정규화 뒤 자른다** ② 영문 칩은 원천 구조 기준 정적 규칙(`only`) + 고른 칩은 규칙과 무관하게 항상 그린다 ③ 「오늘 정기휴무 아님」은 로직 그대로, 문구로 명절 제외를 밝힌다 ④ 파서의 영문 `n/a` 는 NO 가 아니라 UNKNOWN ⑤ 0건 화면에 이유·조건 해제, 오타 교정 안내는 0건에도, 원래 검색어로 재검색 ⑥ 통합 검색 요약은 서버 목록 요약을 그대로 쓴다(값 하나에 정규화는 한 번). ⑦ 해제·원래 검색어 링크의 계측 trigger 는 새 값 `relax` — 검색 제출·필터 적용 건수에서 빼고 결과 view 에는 넣는다(심판이 사용자 판단으로 올린 항목, 세션 기본값으로 정함 — 바꾸면 SR-5.1 의 집계 표 행만 바뀐다).

> 개정 2026-10-08 — 1라운드 심판(33건 유지, `context/review-verdict-round1.md`): 정규화를 경로마다 한 번(서버 목록 요약·FE 선택 패널만), 0건 해제를 실제 질의 기준 순수 함수로, `relax` trigger, `exactFor`, 파서 픽스처 기대값 변경, 목록 overview 계약, 배포 순서·롤백, 템플스테이 0건(쿼리 언더스탠딩이 색인에 없는 분류로 좁힘)을 SR-6 로 추가. 새 ADR 불요(스키마·통신 변경 없음; 파서 VERSION 1→2 와 재색인은 배치 운영 절차). 2라운드 심판(`context/review-verdict-round2.md`, 21 유지·1 강등·1 기각) 반영. 사전이 색인 집계에도 의존하게 되므로 ADR-0090 `:158` 「사전은 원천 코드표에서 만든다」에 개정 한 줄(「코드표 ∩ 그 언어 색인에 문서가 있는 코드」)을 같은 커밋에 더한다(심판이 올린 사용자 판단 항목 — 세션 기본값). 지역 해제는 반경을 유지하고, 계측 행 이름은 「0건 해제」로 한다(같은 근거의 기본값).

## Goal
영문 허브·패널·통합 검색에서 HTML 엔티티·태그가 원문 그대로 보이는 일을 없애고(표본 30페이지 노출 0), 허브의 상태 표현이 「모름을 불가로」·「조건을 조용히 바꾸기」를 하지 않게 한다.

## User Stories
- 영문 방문자로서, 관광지 소개를 `&rsquo;`·`<br />` 없이 읽고 싶다.
- 방문자로서, 결과가 0건이면 왜 그런지와 어떤 조건을 풀면 되는지 알고 싶다. 검색어가 자동 교정됐으면 결과가 없어도 알고, 원래 검색어로 다시 찾을 수 있어야 한다.
- 방문자로서, 언어를 바꿔도 고른 조건을 화면에서 볼 수 있고 풀 수 있어야 한다.

## Specific Requirements

### SR-1 정규화 단일 원본과 서버 사본
1. `search/app/.../infrastructure/render/AttractionSeoText.kt` 를 `search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionSeoText.kt`(패키지 `com.kgd.search.domain.attraction.model`)로 옮기고 `object` 를 public 으로. 동작 불변. 사용처(`AttractionPageRenderer.kt:20-23`, `AttractionJsonLdParityTest.kt:90,92`) import 만 고친다. 패리티 테스트는 그대로 초록이어야 한다. `escapeHtml` 은 `'` 를 이스케이프하지 않는다 — KDoc 에 「큰따옴표 속성값·요소 본문 전용」을 적는다.
2. `SearchAttractionService` 의 목록 요약(`:226`, 상수 `:74`)은 `AttractionSeoText.sourceText(overview)` 를 먼저 적용한 뒤 200자에서 자르고 `…` 를 붙인다. 정규화 결과가 비면 `null`. `findById`(summarize=false)는 원문 그대로(상세는 표시 시점 정규화가 이미 있다). `SearchAttractionUseCase.kt:83` KDoc 을 「목록 응답은 TourAPI 원문을 `sourceText` 로 평문화한 뒤 200자로 자른 요약. 이스케이프되지 않은 평문이라 HTML 로 내보내는 쪽이 escape 한다. 정규화 뒤 비면 null. 원문 전문은 단건 조회로」로 바꾼다. 같은 응답을 주변 검색·프리렌더(`prerender-seo.mjs:1068`)·공개 API(llms.txt, `:1731`)가 쓴다.
3. 통합 검색 `SearchUnifiedService.kt:73` 은 코드를 바꾸지 않는다. 관광지 summary 는 SR-1.2 가 정규화한 목록 overview 를 그대로 쓰고, 다시 정규화하지 않는다(`sourceText` 는 태그 제거 → 엔티티 디코드 순서라 두 번 걸면 `&lt;PARASITE&gt;` → `<PARASITE>` → 빈 문자열이 된다). 관광지 외 타입의 summary 는 손대지 않는다.

### SR-2 화면 표시 시점 정규화
1. 선택 패널 `PlacePage.tsx:1533` 의 overview(단건 조회 원문)만 `overviewText`(placeView.ts, `copy.mjs` `sourceText` 재노출)를 거친다. 결과가 빈 문자열이면 그 요소를 그리지 않는다. 허브 카드 `:1656` 은 서버가 정규화한 목록 overview 를 그대로 그리고(null 이면 그리지 않음), FE 에서 다시 정규화하지 않는다.
2. 통합 검색 `UnifiedSearchPage.tsx:228-230` 은 바꾸지 않는다. 관광지 summary 는 서버가 이미 정규화했고, 다른 타입(blog·concept 등) summary 에 TourAPI 정규화를 걸면 `List<String>` 같은 본문이 지워진다. 원칙: **값 하나에 정규화는 한 번, 원문을 받는 곳에서만.**

### SR-3 칩 규칙
1. `placeAttributes.ts:40` 문구: ko 「오늘 정기휴무일 아님(명절 제외)」, en 「Not a regular closing day today (holidays excluded)」. 판정 로직(`ClosedToday.kt`) 불변.
2. 영문에서 원천 값이 없는 칩은 `only: 'ko'` — 반려동물 동반·반려동물 일부 구역(`petAllowed`·`petPartial`, `petAcmpyType` 영문 채움 0), 신용카드, 유모차 대여(영문 introKeys 에 키 없음), 기존 무장애 3종. 근거를 표 위 주석에 `attr-raw-values.json` 경로와 함께 적는다. 결과 영문 칩은 정기휴무·주차·입장 무료·웰니스 4종.
3. **고른 칩은 규칙과 무관하게 항상 그린다**: 현재 언어의 칩 목록에 없더라도 `attributes` 에 들어 있는 칩은 목록 끝에 active 로 그려 해제할 수 있게 한다(언어 전환 뒤 국문 전용 칩을 고른 상태 포함).
4. 영문 4종 규칙은 데이터로 검증한다: SR-7.5.

### SR-4 파서: 모름을 불가로 바꾸지 않는다
1. `AttractionAttributeParser.kt:113` `PARKING_NO` 에서 `n/a` 를 뺀다 — 「해당 없음/정보 없음」을 가르지 못하는 표기라 UNKNOWN. 국문 「없음」(`CHECK_NO`)은 「없다」는 진술이라 NO 유지(주석의 가정 문구를 「영문 N/A 는 UNKNOWN 으로 읽는다」 결정과 함께 정리).
2. `VERSION` 1 → 2. fixture `raw-fixtures.tsv:105`(`parking en NO N/A (Please use nearby parking facilities)`)의 기대값을 `UNKNOWN` 으로 바꾼다. 행을 추가하지 않는다(`AttractionAttributeParserTest.kt:19` 의 `size 145` 유지). `AttractionApiReindexTaskletTest.kt:305,329` 의 `attributeParserVersion shouldBe 1` 은 `AttractionAttributeParser.VERSION` 으로 바꾼다. `AttractionSearchDocumentTest.kt:45,61` 은 저장된 문서 JSON(리터럴 `"attributeParserVersion":1`)을 읽어 복원하는 테스트라 1 을 그대로 둔다. `./gradlew :search:batch:test --tests '*AttractionApiReindexTaskletTest'` 로 `search/app/src/test/resources/attraction/reindex-capture.json` 을 다시 써서(현재 `"attributeParserVersion" : 1` 15곳) 같은 커밋에 넣는다. CI(`ci.yml:108-109`)가 `git diff --exit-code` 로 막는다. 캡처 안의 다른 값(`attrParking` 등)이 함께 바뀌면 그 diff 도 같이 커밋한다.
3. 운영 반영은 search:batch 이미지 배포 + 재색인(다음 정기 재색인 또는 수동 1회) — 배포 뒤 확인에 적는다. 롤백: 이전 search:batch 이미지로 되돌린 뒤 재색인 1회. 문서의 `attributeParserVersion` 이 1로 돌아왔는지 확인한다.

### SR-5 0건·교정 상태
1. 허브 0건(`PlacePage.tsx:1375-1377`, `!isError`)에 이유 문장과 해제 버튼을 보인다. 버튼은 상태 변수가 아니라 **실제 질의에 실린 사용자 조건**에서 만든다 — `query`(`:330-358`)와 같은 입력으로 계산하는 순수 함수 하나가 다음만 낸다.
   - 검색어(`keyword`).
   - 분류: 사용자가 고른 `category` 만. 기본 분류(`:340`)는 제외한다.
   - 행사 상태: `category === EVENT_CATEGORY` 이고 `listEventStatus` 가 있을 때만. 기본 `NOT_ENDED` 와 검색어가 있을 때 붙는 자동 `NOT_ENDED`(`:345-350`)는 제외한다.
   - 속성: 행사 분류가 아닐 때만, `attributes` 칩마다(`:353`).
   - 지역: 가장 아래 단계 하나. `sigunguCode` → 없으면 `sidoCode` → 없으면 `areaCode`(`sidoCode` 가 없을 때만 질의에 실린다, `:335`). 해제는 `selectRegion` 을 부르지 않는다 — 그 함수는 `setGeo(null)` 로 반경까지 풀고 `triggerRef` 를 `region` 으로 덮는다(`:551-561`). 해제 함수가 직접 한 단계 위로 올린다: 시군구 해제 `setSigunguCode(null)`, 시도 해제 `setSidoCode(null)`·`setSigunguCode(null)`·`setAreaCode(null)`, `areaCode` 해제 `setAreaCode(null)`. `geo` 는 건드리지 않고 지도도 옮기지 않는다.
   - 반경(`geo`).

   버튼마다 그 조건 하나만 풀고 `setPage(0)`. 검색어 해제는 `keyword`·`keywordInput`·`exactFor` 를 함께 비운다. 해제 결과로 `pickingRegion`(`:542`)이 참이 되면 지역 고르기 화면으로 바뀌는 것이 정상 동작이다. 조건 0개면 버튼 없이 이유 문장만 보인다. 2개 이상이면 「모두 해제」 버튼 하나를 더한다. 「모두 해제」는 순수 함수가 낸 조건 각각을 개별 버튼과 같은 규칙으로 한 번씩 푼다. 지역은 한 단계만 푼다(시군구가 있었으면 시도가 남는다). 검색어가 있었으면 `keyword`·`keywordInput`·`exactFor` 도 비우고, 마지막에 `setPage(0)` 한다.

   계측: 해제 버튼·「모두 해제」·「원래 검색어로 검색」은 `SearchTrigger`(`:231-244`)에 새로 더한 `'relax'` 를 `triggerRef` 에 심고, `changedRef` 에는 실제로 바꾼 상태 필드 이름을 넣는다(기존 핸들러와 같은 어휘, `:472,557,1208`): 검색어 `['keyword','page']`, 분류 `['category','page']`, 행사 상태 `['listEventStatus','page']`, 속성 `['attributes','page']`, 시군구 `['sigunguCode','page']`, 시도 `['sidoCode','sigunguCode','areaCode','page']`, `areaCode` `['areaCode','page']`, 반경 `['geo','page']`, 원래 검색어로 검색 `['exact','page']`, 「모두 해제」는 푼 필드의 합집합. `submit` 은 쓰지 않는다.

   같은 커밋에서 `place-hub-instrumentation/spec.md` SR-10 표를 고친다. ① 「건수에서 빼는 것」 행의 목록에 `relax` 를 더한다(검색 제출·필터 적용은 허용 목록 `IN (...)` 이라 쿼리는 그대로이고, 결과 view 에는 들어간다). ② 「0건 해제」 행을 더한다: `uniqExact(view_id)` where `action='SEARCH' AND JSONExtractString(payload,'trigger')='relax'` — 해제 버튼·「모두 해제」·「원래 검색어로 검색」으로 생긴 view 전부(0건이 아닌 화면에서 누른 원래 검색어 링크, 해제 뒤 다시 0건인 view, 지역 고르기 화면으로 넘어간 view 포함). 복구율은 이번에 정의하지 않는다. ③ 「결과 view」 정의 칸에 「지역 고르기 화면(`pickingRegion`)으로 넘어간 view 도 SEARCH 가 나가 여기 들어간다(카드는 없다)」를 더한다.
2. 오류(`isError`)는 지금처럼 `L.failed` — 해제 버튼을 보이지 않는다(조건 탓이 아니다).
3. 교정 안내(`place-corrected`, `:1378`)를 결과 0건일 때도 보인다. 안내에 「원래 검색어로 검색」 링크 — 서버에 원래 검색어 검색 파라미터 `exact=true`(`AttractionSearchController.kt:44-72`·UseCase.Query 에 추가, true 면 `correct()` 를 건너뛴다)를 둔다. FE 는 `placeApi.ts` 의 `AttractionQuery` 에 `exact?: boolean` 을 더하고 `searchAttractions`(`:405-428`)가 `exact=true` 를 싣는다. FE 상태는 불리언이 아니라 누른 순간의 검색어 `exactFor: string | null` 로 두고, 질의에는 `exact: exactFor != null && exactFor === keyword` 로 싣는다(검색어가 바뀌면 저절로 풀린다). 응답 `correctedKeyword` 는 exact 면 null.
4. 문구는 ko/en 둘 다, 정보 전달 문체(`docs/conventions/blog-writing.md` 의 금지 규칙 준용: 물음표·1인칭 금지).
5. `search/glossary.md` §3-2 에 「오타 교정(`correctedKeyword`)」·「원래 검색어 검색(`exact`)」·「분류 사전」 세 행을 더한다. 분류 사전 정의: 「place 분류 코드표(`lclsSystmCode2`)의 이름 → 코드 사전(`CategoryLexiconUseCase`). 쿼리 언더스탠딩이 패싯 필터를 만들 때 쓴다. 그 언어의 attractions 문서가 1건 이상인 코드만 담고 10분마다 갱신한다」. 피할 말 칸: 「「질의 사전」(쿼리 벡터 캐시의 옛 이름)과 다르다」.

### SR-6 쿼리 언더스탠딩이 색인에 없는 분류로 좁혀 0건을 만들지 않는다
1. 증상: 「템플스테이」·「temple stay」가 0건이다. 쿼리 언더스탠딩이 분류 코드(`lclsSystm3=EX040100`)로 필터를 걸지만 그 코드의 문서가 색인에 없다(`docs/research/2026-10-08-vector-leg-filter/report.md` 부수 발견). 운영 색인 실측(2026-10-08, 색인 `attractions_20261007213012`): `lclsSystm3=EX040100` 문서 0건. 분류 필터 없이 제목·개요 `and` 일치만 걸면 「템플스테이」 75건(ko 74·en 1), 「temple stay」 en 18건, 「templestay」 en 15건 — 필터만 빠지면 결과가 나온다. 착수 전 확인(구현 단계에서 하고 이 절에 기록한다): place 코드표에서 이름에 `temple`·`stay`·`템플` 이 든 행(코드·깊이·이름)을 적는다. 그다음 `EX040100` 행을 뺀 코드표로 만든 ko·en 사전에 `QueryIntent.analyze("템플스테이")`·`analyze("temple stay")` 를 넣고, 결과의 facets·residual 을 적는다. facets 가 남으면 그 필터와 잔여 검색어로 `lang=en` 건수를 함께 적는다. 0 이면 구현을 멈추고 사용자에게 보고한다.
2. 원인: 분류 사전(`CategoryLexiconAdapter.kt:74-86`)이 place 코드표 전체로 만들어진다. 코드표에는 있으나 색인 문서가 0인 코드도 사전 단어가 되어, 쿼리 언더스탠딩(`QueryIntent.analyze`)이 그 코드로 필터를 건다.
3. 규칙: 사전은 **그 언어의 색인 문서가 1건 이상인 코드만** 담는다.
   - 집합: attractions 색인에서 `lang` 별로 `lclsSystm1`·`lclsSystm2`·`lclsSystm3` 세 필드 값을 terms 집계로 받는다. 버킷 크기는 그 갱신에서 받은 코드표 행 수 이상으로 잡는다(상수·설정 아님). 어느 버킷이든 응답의 `sum_other_doc_count > 0` 이면 잘린 것이므로 어댑터가 예외를 던진다.
   - 교집합 순서: 언어 `L` 의 사전을 만들 때 코드표 **행**(두 언어 행 모두)을 `code ∈ 집합[L]` 로 먼저 거른다. 그 뒤 기존 순서(다른 언어 행 먼저, `L` 행 나중)로 `QueryIntent.Lexicon.of` 를 부른다. 다 만든 사전을 나중에 거르지 않는다 — `Lexicon.of` 는 이름이 겹치면 깊은 코드가 이기므로(`QueryIntent.kt:190`), 나중에 거르면 얕은 코드로 돌아가야 할 이름까지 지운다.
   - 실패 처리: 코드표를 못 받으면 지금처럼 들고 있던 사전을 쓴다(처음이면 빈 사전). 코드표는 받았는데 `L` 의 집합을 못 받았거나(예외·잘림), 받은 집합이 비었으면 `L` 사전은 들고 있던 것을 쓴다. 한 번도 만든 적이 없으면 코드표 전체로 만든다(오늘 동작). 문서 수 하한은 상수·설정으로 두지 않는다.
   - 구조(`docs/conventions/package-structure.md` 규칙 6·8): 포트 `CategoryLexiconPort` 를 `application/attraction/port/CategoryCodePort.kt` 로 바꾼다(`fun codes(): List<CategoryCode>`, 같은 파일에 `data class CategoryCode(val lang: String, val code: String, val depth: Int, val name: String)`). `CategoryLexiconAdapter` 는 place 조회만 하는 구현이 되고 이름을 `CategoryCodeAdapter` 로 바꾼다. `AttractionSearchPort` 에 `fun indexedCategoryCodes(bucketSize: Int): Map<String, Set<String>>`(lang → 코드)를 더하고 `AttractionSearchAdapter` 가 구현한다(집계 선례 `:210-238`). 캐시(`AtomicReference`), `@Scheduled(initialDelay = 5_000, fixedDelay = 10 * 60 * 1000)` 갱신, 교집합, 실패 처리는 `application/attraction/usecase/CategoryLexiconUseCase`(인터페이스, `fun lexicon(lang: String?): QueryIntent.Lexicon`)와 구현 `application/attraction/service/CategoryLexiconService` 가 갖는다. `SearchAttractionService`·`SearchUnifiedService` 는 포트 대신 이 UseCase 를 주입한다(선례 `SearchAttractionService.kt:34` 의 UseCase 주입, `InventoryReconciliationService.kt:18` 의 application `@Scheduled`).
   - 바꿀 곳: `CategoryLexiconPort.kt:9` KDoc 「못 받으면 빈 사전을 준다」를 위 실패 처리로 옮겨 적는다. `SearchApplication.kt:23` 주석의 갱신 주체를 `CategoryLexiconService` 로. 테스트 대역 4곳 `SearchAttractionServiceTest.kt:52`, `SearchUnifiedServiceTest.kt:38`, `UnifiedAttractionRequests.kt:32`, `AttractionReindexCaptureTest.kt:183`.
   - 통합 검색도 같은 사전을 쓰므로(`SearchUnifiedService.kt:29`) 통합 검색의 관광지 분류 필터도 함께 좁아진다. SR-1.3 의 「코드를 바꾸지 않는다」는 summary(`:73`)에 대한 것이고, UseCase 주입 변경은 그 예외다.
4. 이것은 조용한 완화가 아니다 — 사용자가 건 조건이 아니라 서버가 추론한 조건이고, 결과를 낼 수 없는 추론만 막는다. 사용자가 고른 `category` 는 SR-5 대로 화면이 해제를 제안한다.
5. 테스트. 판정은 사전 내부가 아니라 쿼리 언더스탠딩의 산출물 `QueryIntent.analyze(질의, useCase.lexicon(lang))` 의 `facets`·`hasFilter` 로 한다.
   - `CategoryLexiconServiceTest`(Kotest BehaviorSpec, 두 포트 MockK): ① 코드표에 있지만 그 언어 집합에 없는 코드의 이름 → 필터 없음. ② ko 집합에만 있는 코드 → ko 사전은 필터 있음, en 사전은 같은 코드의 영문·국문 이름 모두 필터 없음. ③ 같은 이름의 깊은 코드가 집합에 없고 얕은 코드가 있으면 → 그 이름은 얕은 코드의 필드(`lclsSystm1` 또는 `lclsSystm2`)로 필터된다. ④ 집합 조회 예외 → 들고 있던 사전 유지. ⑤ 집합이 빈 맵이거나 그 언어 집합이 비면 → 들고 있던 사전 유지. ⑥ 집합을 한 번도 못 받으면 → 코드표 전체 사전(EX040100 이름에 필터 있음). ⑦ 코드표 조회 실패 → 들고 있던 사전 유지.
   - `AttractionSearchAdapter` 요청 캡처 테스트(`AttractionReindexCaptureTest`·`UnifiedAttractionRequests` 관례): 집계 요청이 `lang` 별로 `lclsSystm1`·`lclsSystm2`·`lclsSystm3` 세 필드를 terms 집계하고, 버킷 크기가 인자 `bucketSize` 이상이며, 응답 `sum_other_doc_count > 0` 이면 예외를 던진다.
   - 배포 뒤: `GET /api/search/attractions?lang=ko&keyword=템플스테이` 와 `lang=en&keyword=temple stay` 가 모두 `total > 0`.

### SR-7 검증
1. vitest:
   - 카드·패널: 패널 원문 개요에 `&rsquo;`·`<br />` 가 든 픽스처 → 화면 텍스트에 엔티티·태그 0, 정리 후 빈 개요는 요소 없음. 단건 응답 overview `&lt;PARASITE&gt;` → 패널에 `<PARASITE>` 가 보인다(패널 경로 이중 정규화 감지).
   - 재정규화 회귀 감지: 서버 정규화 값 `K-movie <PARASITE> - …` 를 목록 응답으로 준 픽스처에서 카드 DOM 에 `<PARASITE>` 가 그대로 남는다.
   - 통합 검색: 관광지 외 타입 summary `List<String>` 이 그대로 보인다. 테스트 파일은 새로 만든다: `portal-fe/src/pages/search/__tests__/UnifiedSearchPage.test.tsx`.
   - 칩: 영문 칩 4종 + 국문 11종. 국문 전용 칩을 고른 뒤 `/en` 전환 → 그 칩이 active 로 보이고 클릭하면 해제. 언어 전환 테스트는 `App` 자체로 마운트한다: `window.history.pushState({}, '', '/place')` 뒤 `render(<QueryClientProvider client={…}><App /></QueryClientProvider>)`(`App.tsx:202` 가 `BrowserRouter` 를 갖고, `QueryClientProvider` 는 `main.tsx:33`). 전환 뒤 경로는 `/en/place`(`App.tsx:264`). 테스트 안에 `<Routes>` 를 다시 적지 않는다.
   - 0건: 조건 3개 픽스처 → 버튼 3 + 모두 해제, 클릭하면 그 조건만 풀린 질의(`searchAttractions` mock 인자). 조건 0개 → 버튼 0, 조건 1개 → 모두 해제 없음, 행사 분류에서 속성 버튼 없음, 기본 분류·기본 행사 상태 버튼 없음, 검색어 해제 뒤 입력창이 빈 값, 해제 클릭 뒤 계측 trigger 가 `relax`(`other` 아님). 오류면 버튼 없음. 시군구 선택 + 0건 → 지역 버튼 1개, 누르면 다음 질의에 `sidoCode` 만 있고 `sigunguCode` 없음. 시도 + 반경 0건에서 지역 버튼 → 다음 질의에 `lat`·`lng`·`radiusKm` 가 남고 `sidoCode` 없음, trigger `relax`. `areaCode`·`sidoCode` 상태가 둘 다 있으면 지역 버튼은 시도 하나. 시도만 있고 검색어·반경이 없을 때 시도를 풀면 지역 고르기 화면. 반경 해제 → 다음 질의에 `lat`·`lng` 없음. 조건 3개(검색어·속성 1개·시군구)에서 「모두 해제」 → 다음 질의에 `keyword`·속성 파라미터가 없고 `sidoCode` 만 남음, 입력창 빈 값. 각 해제·「모두 해제」·「원래 검색어로 검색」마다 `trigger='relax'` 이고 `changed` 가 SR-5.1 의 필드 목록과 같다.
   - 교정: 교정 + 0건이면 안내와 「원래 검색어로 검색」 링크, 클릭하면 `exact=true` 질의. 검색어를 바꾸면 질의에서 `exact` 가 빠진다. `searchAttractions` 가 URL 에 `exact=true` 를 싣는지 `placeApi` 단위 테스트로 확인한다.
   - 의도된 빨강: `PlacePage.test.tsx:112`(국문 문구), `:221`(`Not closed today`), `:222`(`Pets in some areas` 가 국문 전용으로 바뀜)의 기대값을 갱신한다.
2. Kotest: `SearchAttractionService` 요약 — 엔티티·태그가 200자 경계에 걸친 원문이 정규화 뒤 잘림(잘린 엔티티·태그 조각 0), 빈 정규화 → null, 원문 `&lt;PARASITE&gt;` → 요약에 `<PARASITE>` 가 남는다. `findById` 는 원문 `&lt;PARASITE&gt;` 를 그대로 돌려준다. 요약 길이 경계: 원문 250자, 정규화 결과 150자면 `…` 없이 150자 그대로. 경계 케이스는 조각이 없다는 것만 보지 않고 기대 문자열 전체로 단언한다. `SearchUnifiedService` 는 관광지 overview 를 그대로 summary 로 쓰고, overview 가 null 이면 address 로 내려간다(`:73`). `exact=true` 면 `correct` 미호출·`correctedKeyword == null`, `AttractionSearchControllerTest` 에 `exact` 바인딩 케이스. 파서 `N/A` → UNKNOWN, `VERSION == 2`. 패리티 테스트 초록. SR-6.5 의 케이스 전부.
3. 회귀 주입: 패널 정규화 제거 → vitest 빨강. 카드에 FE 재정규화 추가 → `<PARASITE>` 테스트 빨강. 서버 자르기 순서 되돌림 → Kotest 빨강. 고른 칩 그리기 제거 → 언어 전환 테스트 빨강. `exact` 분기 제거 → Kotest 빨강. SR-6 의 교집합 제거 → 사전 제외 Kotest 빨강. 추가(각각 컴파일되는 변경): 순수 함수가 기본 분류를 조건에 넣음 → 「기본 분류 버튼 없음」 빨강 · 해제 핸들러가 `triggerRef` 를 안 심음 → `relax` 단언 빨강 · `placeApi` 의 `exact` 직렬화 삭제 → placeApi 테스트 빨강 · 컨트롤러 `exact` 바인딩 삭제 → `AttractionSearchControllerTest` 빨강 · `PARKING_NO` 에 `n/a` 복원 → `raw-fixtures.tsv:105` 빨강 · `petPartial` 의 `only: 'ko'` 삭제 → 영문 4종 단언 빨강 · `UnifiedSearchPage` summary 에 `overviewText` 적용 → `List<String>` 단언 빨강 · 「실패 시 이전 사전 유지」 삭제 → SR-6.5 ④ 빨강 · 빈 집합 가드 삭제 → ⑤ 빨강 · 사전을 다 만든 뒤 거르도록 변경 → ③ 빨강 · 집계 버킷 크기 지정 삭제 → 요청 캡처 테스트 빨강 · `findById` 에 정규화 적용 → `findById` Kotest·패널 `<PARASITE>` vitest 빨강 · 지역 해제를 `selectRegion` 호출로 되돌림 → 시도+반경 케이스 빨강.
4. 배포 순서: search:app(목록 요약·exact·SR-6) → portal-fe → search:batch(파서 v2) → 재색인. 「30카드 노출 0」 확인은 search:app 배포 뒤에만 의미가 있다.
5. 배포 뒤: 일반 UA CDP 로 영문 허브 첫 화면 30카드·선택 패널 3개·통합 검색 영문 결과에서 엔티티·`<br` 노출 0(1단계 S1-6 은 3/30). `GET /api/search/attractions?lang=en&facets=true` 로 영문 칩 4종 건수가 0 이 아닌지와 국문 전용으로 돌린 칩의 영문 건수가 0 인지 표로(「11→4」를 결과가 아니라 조건으로 증명). 0건 화면 캡처(조건 해제 버튼). 템플스테이 `total > 0`. 재색인 뒤 파서 VERSION 2 로그와, 영문 주차 원문이 `N/A` 로 시작하는 문서의 `attrParking` 이 전부 UNKNOWN 인지 건수 표(S2-4 「null→불가 오해 0」).

## Existing Code to Leverage
- 정규화: `portal-fe/src/seo/copy.mjs:844-860` `sourceText`, `placeView.ts:203,206`, 서버 사본 `AttractionSeoText.kt:43-57`, 패리티 `AttractionJsonLdParityTest`.
- 칩: `placeAttributes.ts:39-55`(`only`), `PlacePage.tsx:1298-1319`, 테스트 `PlacePage.test.tsx:90-230`.
- 0건·교정: `PlacePage.tsx:1375-1379`, 상태 `:293-307`, 해제류 선례 `:1204-1213,1249-1253,470-480`, 계측 ref 규약 `:1206-1207`.
- 서버: `SearchAttractionService.kt:74,83-87,125,169,226`, `SearchUnifiedService.kt:61,73`, `AttractionSearchController.kt:46-72`, `SearchAttractionUseCase.kt:9,84,186-188`.
- 분류 사전: `CategoryLexiconAdapter.kt:50-86`, `QueryIntent.kt:171-236`, 사용처 `SearchAttractionService.kt:91`·`SearchUnifiedService.kt:29`, 집계 선례 `AttractionSearchAdapter.kt:210-238`, application `@Scheduled` 선례 `InventoryReconciliationService.kt:18`.
- 파서: `AttractionAttributeParser.kt:26,113,120,147-158`, `raw-fixtures.tsv`, 배치 호출 `AttractionApiReindexTasklet.kt:221`.

## Out of Scope
- 원천(place DB) overview 덮어쓰기, 색인 파생 필드 신설. 공휴일 달력(Q2). 속성 정밀도 측정(Q1). 쿼리 언더스탠딩(분류 좁힘)을 화면에 알리기 — 좁힘은 완화가 아니라 S2-4 의 「조용한 완화」에 해당하지 않는다(후속 후보, 0건을 만드는 좁힘만 SR-6 이 다룬다). 상세 페이지 첫 화면(S2-2). 「개요 없음」 판정 통일 — 프리렌더 `hasOverview`(`prerender-seo.mjs:996`, SR-1.2 뒤에는 정규화 값 기준)와 서버 noindex(`AttractionPageRenderer.kt:63`, 원문 기준)는 태그·엔티티만 있는 개요에서 갈릴 수 있다. 후속 후보.
