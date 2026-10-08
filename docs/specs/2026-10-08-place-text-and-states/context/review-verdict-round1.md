# review-verdict-round1: place 원문 정제와 상태 규칙 (spec-review 1라운드)

요청받은 `context/review-verdict-round1.md` 파일은 쓰지 않았습니다. 이 판정자는 읽기 전용이라(헌법 1) 쓸 수 없습니다. 아래 전문을 부모 세션이 그대로 저장하면 됩니다.

## 집계
- 입력 발견 33건(architecture 4 · domain 6 · implementation 6 · security 2 · test-strategy 9 · usecase 6)은 전부 **유지(keep)**입니다. 강등·기각 0건, BLOCK 0건(REVISE 17 · MINOR 16)입니다.
- 강등이나 기각할 반증을 찾지 못했습니다. 반대로 핵심 주장은 직접 확인했습니다.
  - `copy.mjs:849-850`, `AttractionSeoText.kt:48-49` 는 실제로 태그를 지운 뒤 엔티티를 디코드합니다.
  - `s1-6-hub-ui-check.md:16` 에 `K-movie &lt;PARASITE&gt;` 표본이 있습니다.
  - `PlacePage.tsx:335,340-350,353` 은 실제 질의가 상태와 다르게 조건을 처리합니다.
  - `:231-244` 에는 해제 버튼에 맞는 trigger 값이 없습니다.
  - `raw-fixtures.tsv:105` 은 `parking en NO N/A (Please use…)` 이고, `AttractionAttributeParserTest.kt:19` 은 `size shouldBe 145` 입니다.
  - `AttractionApiReindexTaskletTest.kt:305,329` 는 `attributeParserVersion shouldBe 1` 입니다.
  - 실제 클래스 이름은 `AttractionSearchController.kt:26` 입니다.
  - `placeAttributes.ts:44-45` 에 `petAllowed`·`petPartial` 이 있습니다.
  - `SearchAttractionUseCase` KDoc 은 "목록 응답은 200자 요약 — 전문은 단건 조회로" 입니다.
  - 공개 API 는 `prerender-seo.mjs:1731` 의 llms.txt 에 적혀 있습니다.
  - `search/glossary.md` §3-2 에는 교정·exact 항목이 없습니다.

## 묶음 표

| 묶음 | 포함 발견 | 판정 | 등급 | 채택한 수정안 |
|---|---|---|---|---|
| G1 정규화를 두세 번 걸고, 멱등 요구가 거짓 | A-1, D-1, impl R1, sec R1, test F1, usecase F1, test F2 | keep | REVISE | 값 하나에 정규화는 한 번, 원문을 받는 곳에서만. 서버 목록 요약 + FE 선택 패널 `:1533` 에서만 한다. SR-1.3 은 코드를 바꾸지 않고 테스트만 둔다. 멱등 테스트는 `<PARASITE>` 가 남는지 보는 테스트로 바꾼다 |
| G2 통합 검색 FE 정규화가 다른 타입 summary 까지 걸림 | D-2, impl R2, usecase F2 | keep | REVISE | G1 로 해결된다. `UnifiedSearchPage.tsx` 는 바꾸지 않는다 |
| G3 해제 버튼을 상태 변수에서 만들면 실제 질의와 어긋남 | A-2, D-4, impl R4(①②), usecase F4, test F6 | keep | REVISE | `query` 와 같은 입력으로 계산하는 순수 함수 하나로 만든다. 지역은 가장 아래 단계 하나씩 풀고 `selectRegion` 을 재사용한다. 검색어 해제는 `keywordInput`·`exact` 도 함께 비운다 (A-2 와 D-4 가 상충해 D-4 의 한 단계씩 해제를 골랐다) |
| G4 해제·원래 검색어 링크의 계측 trigger 가 정해지지 않음 | impl R4(③), test F5, usecase F3 | keep | REVISE | `SearchTrigger` 에 `'relax'` 를 새로 둔다. `submit` 은 쓰지 않는다(usecase F3 근거) |
| G5 파서 픽스처 모순과 의도적으로 빨강이 될 기존 단언 | impl R3, test F3, test F7, usecase F5 | keep | REVISE | 행을 추가하지 않고 `:105` 기대값을 UNKNOWN 으로 바꾼다. 버전 단언과 FE 단언 갱신 목록을 스펙에 적는다 |
| G6 목록 overview 의 뜻 변경이 계약에 안 적힘 | D-3, sec R2 | keep | REVISE | KDoc 과 스펙에 "평문, 이스케이프 안 됨, HTML 로 내보내는 쪽이 escape" 를 적는다. `escapeHtml` 은 `'` 를 이스케이프하지 않는다고 KDoc 에 명시한다 |
| G7 배포 순서·롤백 절차 없음 | impl R5(a,b) | keep | REVISE | 배포 순서와 배치 롤백 절차를 스펙에 넣는다 |
| G8 `exact` 를 FE·컨트롤러에 잇는 부분이 변경·테스트 목록에 없음 | impl R6(b), usecase F6(d), test F4 | keep | REVISE | `placeApi.ts` 변경과 바인딩 테스트, 음성 케이스를 추가한다 |
| G9 `exact` 상태 모델 | A-4 | keep | MINOR | `exactFor === keyword` 방식 |
| G10 패키지 위치 | A-3 | keep | MINOR | 패키지를 `domain.attraction.model` 로. 이름 변경은 취향 판단이라 채택하지 않는다 |
| G11 반려동물 일부 구역(`petPartial`) 누락 | impl R6(c), test F9, usecase F6(a) | keep | MINOR | SR-3.2 에 둘 다 적는다 |
| G12 컨트롤러 이름 오기 | impl R6(a), usecase F6(c) | keep | MINOR | `AttractionSearchController` |
| G13 "개요 없음" 판정이 두 벌 | D-6, impl R5(c) | keep | MINOR | 범위 밖(후속)으로 적는다 |
| G14 "원문" 이중 의미, 용어집 미등재 | D-5 | keep | MINOR | "원래 검색어" 로 바꾸고 glossary 에 두 행을 더한다 |
| G15 언어 전환 테스트가 `<Routes>` 없이 마운트 | test F8 | keep | MINOR | 실제 라우트 전환을 재현한다 |
| G16 S2-4 "null→불가 오해 0" 배포 후 확인 없음 | usecase F6(b) | keep | MINOR | 재색인 뒤 건수 표를 둔다 |

## 판정 (발견 하나에 객체 하나)
```json
[
 {"id":"A-1 서버 정규화 값에 FE·SR-1.3 이중 정규화","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/seo/copy.mjs","line":849,"quote":"text = text.replace(/<[^>]*>/g, '');"},{"file":"docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-6-hub-ui-check.md","line":16,"quote":"K-movie &lt;PARASITE&gt; - A town full of nostalgia<br />"}],"reason":"태그 제거 뒤 엔티티를 디코드하는 순서가 원문으로 확인돼 반증이 없다."},
 {"id":"A-2 0건 해제 버튼을 상태에서 만들면 질의와 어긋남","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":353,"quote":"...(category === EVENT_CATEGORY ? {} : attributeQuery(attributes)),"}],"reason":"질의가 상태와 다르게 조건을 싣는 것이 확인됐다."},
 {"id":"A-3 domain.text 패키지·SeoText 이름","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/conventions/package-structure.md","line":21,"quote":"│           └── {entity}/"}],"reason":"규약상 domain 아래는 엔티티 패키지다. 이름 변경 제안은 스타일이라 반영 대상에서 뺀다."},
 {"id":"A-4 exact 불리언 → exactFor","verdict":"keep","severity":"MINOR","evidence":[{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":1023,"quote":"setKeyword(keywordInput.trim());"}],"reason":"검색어가 바뀌는 경로가 여럿이라 해제 누락 위험에 대한 반증이 없다."},
 {"id":"D-1 sourceText 멱등 불성립","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/app/.../AttractionSeoText.kt","line":48,"quote":"text = text.replace(TAG, \"\")"}],"reason":"G1 과 같은 문제이고 원문으로 확인됐다."},
 {"id":"D-2 통합 검색 FE 정규화가 다른 BC summary 로 누출","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/search/UnifiedSearchPage.tsx","line":228,"quote":"{hit.summary && <span className=\"usearch-hit-summary\">{hit.summary}</span>}"}],"reason":"모든 타입의 hit 를 같은 줄에서 그린다."},
 {"id":"D-3 목록 overview 의미 변경, KDoc 미갱신","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/app/.../SearchAttractionUseCase.kt","line":83,"quote":"/** 목록 응답은 200자 요약 — 전문은 단건 조회로 */"}],"reason":"계약 문구가 그대로 남는다."},
 {"id":"D-4 걸린 조건 ≠ 실제 질의","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":335,"quote":"areaCode: sidoCode ? undefined : (areaCode ?? undefined),"},{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":542,"quote":"const pickingRegion = hasRegionAxis && !sidoCode && !keyword && !geo;"}],"reason":"인용한 줄이 원문과 일치한다."},
 {"id":"D-5 원문 이중 의미·glossary 미등재","verdict":"keep","severity":"MINOR","evidence":[{"file":"search/glossary.md","line":95,"quote":"## 3-2. 하이브리드 검색 용어 (ADR-0090 · ADR-0065 · ADR-0095)"}],"reason":"§3-2 에 교정·exact 항목이 없다."},
 {"id":"D-6 개요 없음 판정 두 벌","verdict":"keep","severity":"MINOR","evidence":[{"file":"portal-fe/scripts/prerender-seo.mjs","line":996,"quote":"if (!overview) return { id: a.id, hasOverview: false };"},{"file":"search/.../AttractionPageRenderer.kt","line":63,"quote":"noindex = doc.overview.isNullOrEmpty() ||"}],"reason":"두 판정의 기준이 다른 것이 확인됐다."},
 {"id":"impl R1 이중 정규화","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/.../SearchUnifiedService.kt","line":73,"quote":"summary = it.overview ?: it.address,"}],"reason":"G1 과 같은 문제다."},
 {"id":"impl R2 통합 FE 정규화 타입 누출","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/.../SearchUnifiedService.kt","line":118,"quote":"QueryIntent.Types.ATTRACTION, QueryIntent.Types.BLOG_POST, QueryIntent.Types.GAME, QueryIntent.Types.CONCEPT,"}],"reason":"G2 와 같은 문제다."},
 {"id":"impl R3 raw-fixtures:105 모순","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/domain/src/test/resources/attributes/raw-fixtures.tsv","line":105,"quote":"parking\ten\tNO\tN/A (Please use nearby parking facilities)"}],"reason":"원문으로 확인됐다."},
 {"id":"impl R4 해제 버튼 3문제","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":409,"quote":"const trigger: SearchTrigger = triggerRef.current ?? (hasSearchedRef.current ? 'other' : 'landing');"}],"reason":"G3·G4 와 같은 문제이고 원문으로 확인됐다."},
 {"id":"impl R5 배포 순서·롤백·판정 어긋남","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-08-place-text-and-states/spec.md","line":36,"quote":"운영 반영은 search:batch 이미지 배포 + 재색인"}],"reason":"롤백과 순서가 스펙에 없다."},
 {"id":"impl R6 이름·placeApi·petPartial","verdict":"keep","severity":"MINOR","evidence":[{"file":"search/.../AttractionSearchController.kt","line":26,"quote":"class AttractionSearchController("}],"reason":"세 항목 모두 원문으로 확인됐다."},
 {"id":"sec R1 정규화 중복","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/seo/copy.mjs","line":823,"quote":"'&lt;': '<', '&gt;': '>'"}],"reason":"G1 과 같은 문제다."},
 {"id":"sec R2 공개 API 계약 미기재·escapeHtml 따옴표","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/scripts/prerender-seo.mjs","line":1731,"quote":"`- 검색: ${API_ORIGIN}/api/search/attractions?lang=ko&keyword={검색어}`,"},{"file":"search/.../AttractionSeoText.kt","line":71,"quote":".replace(\"\\\"\", \"&quot;\")"}],"reason":"공개된 API 이고 `'` 를 이스케이프하지 않는 것이 확인됐다."},
 {"id":"test F1 멱등 거짓","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/seo/copy.mjs","line":850,"quote":"text = text.replace(/&[a-zA-Z]+;/g, ...)"}],"reason":"G1 과 같은 문제다."},
 {"id":"test F2 통합 summary 테스트가 목을 잰다","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/.../SearchUnifiedService.kt","line":61,"quote":"val result = searchAttraction.execute("}],"reason":"입력이 이미 정규화된 값이라는 지적을 반증할 근거가 없다."},
 {"id":"test F3 픽스처 행 추가 → 기대값 변경","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/domain/.../AttractionAttributeParserTest.kt","line":19,"quote":"fixtures.size shouldBe 145"}],"reason":"원문으로 확인됐다."},
 {"id":"test F4 exact 배선 이음매 테스트 밖","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/api/placeApi.ts","line":405,"quote":"const params = new URLSearchParams({ lang: query.lang });"}],"reason":"필드를 하나씩 싣는 구조라 누락 위험에 대한 반증이 없다."},
 {"id":"test F5 trigger 미정","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-08-place-hub-instrumentation/spec.md","line":85,"quote":"trigger='other' — 0 이어야 한다"}],"reason":"G4 와 같은 문제다."},
 {"id":"test F6 0건 경계 케이스","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":340,"quote":"category: category ?? (keyword ? [...SIGHT_CATEGORIES, EVENT_CATEGORY] : SIGHT_CATEGORIES).join(','),"}],"reason":"G3 과 같은 문제다."},
 {"id":"test F7 의도된 빨강 미기재","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/__tests__/PlacePage.test.tsx","line":221,"quote":"getByRole('button', { name: /^Not closed today/ })"}],"reason":"문구가 바뀌면 이 단언이 깨진다."},
 {"id":"test F8 Routes 없이 언어 전환","verdict":"keep","severity":"MINOR","evidence":[{"file":"portal-fe/src/pages/place/__tests__/PlacePage.test.tsx","line":78,"quote":"<MemoryRouter initialEntries={[path]}>"}],"reason":"`<Routes>` 없이 PlacePage 만 마운트하는 것이 확인됐다."},
 {"id":"test F9 petPartial 누락","verdict":"keep","severity":"MINOR","evidence":[{"file":"portal-fe/src/pages/place/placeAttributes.ts","line":45,"quote":"{ id: 'petPartial', ko: '반려동물 일부 구역', en: 'Pets in some areas' },"}],"reason":"G11 과 같은 문제다."},
 {"id":"usecase F1 멱등 아님","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/seo/copy.mjs","line":849,"quote":"text = text.replace(/<[^>]*>/g, '');"}],"reason":"G1 과 같은 문제다."},
 {"id":"usecase F2 통합 FE 전 타입","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/search/UnifiedSearchPage.tsx","line":228,"quote":"{hit.summary && ..."}],"reason":"G2 와 같은 문제다."},
 {"id":"usecase F3 trigger 미정·submit 부풀림","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":232,"quote":"| 'submit'"}],"reason":"G4 와 같은 문제다."},
 {"id":"usecase F4 원시 상태·해제 뒤 상태 미정","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":1023,"quote":"setKeyword(keywordInput.trim());"}],"reason":"G3 과 같은 문제다."},
 {"id":"usecase F5 깨지는 기존 테스트","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/batch/.../AttractionApiReindexTaskletTest.kt","line":305,"quote":"source[\"attributeParserVersion\"] shouldBe 1"}],"reason":"G5 와 같은 문제이고 인용이 원문과 일치한다."},
 {"id":"usecase F6 petPartial·배포후확인·이름·AttractionQuery","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/specs/2026-10-08-place-text-and-states/spec.md","line":44,"quote":"(SearchAttractionController·UseCase.Query 에 추가"}],"reason":"G11·G12·G8·G16 에 해당한다."}
]
```

## spec.md 편집 목록 (그대로 반영)

1. **헤더 결정 ⑤**
   - 바꿀 문장: 「원문 재검색」
   - 새 문장: 「원래 검색어로 재검색」
2. **SR-1.1**
   - 바꿀 문장: 「`search/domain/src/main/kotlin/com/kgd/search/domain/text/AttractionSeoText.kt`(패키지 `com.kgd.search.domain.text`)」
   - 새 문장: 「`search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionSeoText.kt`(패키지 `com.kgd.search.domain.attraction.model`)」
   - 문단 끝에 추가: 「`escapeHtml` 은 `'` 를 이스케이프하지 않는다 — KDoc 에 "큰따옴표 속성값·요소 본문 전용" 을 적는다.」
3. **SR-1.2 끝에 추가**: 「`SearchAttractionUseCase.kt:83` KDoc 을 "목록 응답은 TourAPI 원문을 `sourceText` 로 평문화한 뒤 200자로 자른 요약. 이스케이프되지 않은 평문이라 HTML 로 내보내는 쪽이 escape 한다. 정규화 뒤 비면 null. 원문 전문은 단건 조회로" 로 바꾼다. 같은 응답을 주변 검색·프리렌더(`prerender-seo.mjs:1068`)·공개 API(llms.txt, `:1731`)가 쓴다.」
4. **SR-1.3 전체 교체**: 「통합 검색 `SearchUnifiedService.kt:73` 은 코드를 바꾸지 않는다. 관광지 summary 는 SR-1.2 가 정규화한 목록 overview 를 그대로 쓰고, 다시 정규화하지 않는다(`sourceText` 는 태그 제거 → 엔티티 디코드 순서라 두 번 걸면 `&lt;PARASITE&gt;` → `<PARASITE>` → 빈 문자열이 된다). 관광지 외 타입의 summary 는 손대지 않는다.」
5. **SR-2.1 전체 교체**: 「선택 패널 `PlacePage.tsx:1533` 의 overview(단건 조회 원문)만 `overviewText`(placeView.ts, `copy.mjs` `sourceText` 재노출)를 거친다. 결과가 빈 문자열이면 그 요소를 그리지 않는다. 허브 카드 `:1656` 은 서버가 정규화한 목록 overview 를 그대로 그리고(null 이면 그리지 않음), FE 에서 다시 정규화하지 않는다.」
6. **SR-2.2 전체 교체**: 「통합 검색 `UnifiedSearchPage.tsx:228-230` 은 바꾸지 않는다. 관광지 summary 는 서버가 이미 정규화했고, 다른 타입(blog·concept 등) summary 에 TourAPI 정규화를 걸면 `List<String>` 같은 본문이 지워진다. 원칙: **값 하나에 정규화는 한 번, 원문을 받는 곳에서만.**」
7. **SR-3.2**
   - 바꿀 문장: 「반려동물 동반(`petAcmpyType` 영문 채움 0)」
   - 새 문장: 「반려동물 동반·반려동물 일부 구역(`petAllowed`·`petPartial`, `petAcmpyType` 영문 채움 0)」
8. **SR-4.2 전체 교체**: 「`VERSION` 1 → 2. fixture `raw-fixtures.tsv:105`(`parking en NO N/A (Please use nearby parking facilities)`)의 기대값을 `UNKNOWN` 으로 바꾼다. 행을 추가하지 않는다(`AttractionAttributeParserTest.kt:19` 의 `size 145` 유지). `AttractionApiReindexTaskletTest.kt:305,329` 의 `attributeParserVersion shouldBe 1` 은 `AttractionAttributeParser.VERSION` 으로 바꾼다.」
9. **SR-4.3 끝에 추가**: 「롤백: 이전 search:batch 이미지로 되돌린 뒤 재색인 1회. 문서의 `attributeParserVersion` 이 1로 돌아왔는지 확인한다.」
10. **SR-5.1 전체 교체**:
    > 허브 0건(`PlacePage.tsx:1375-1377`, `!isError`)에 이유 문장과 해제 버튼을 보인다. 버튼은 상태 변수가 아니라 **실제 질의에 실린 사용자 조건**에서 만든다 — `query`(`:330-358`)와 같은 입력으로 계산하는 순수 함수 하나가 다음만 낸다.
    > - 검색어(`keyword`).
    > - 분류: 사용자가 고른 `category` 만. 기본 분류(`:340`)는 제외한다.
    > - 행사 상태: `category === EVENT_CATEGORY` 이고 `listEventStatus` 가 있을 때만. 기본 `NOT_ENDED` 와 검색어가 있을 때 붙는 자동 `NOT_ENDED`(`:345-350`)는 제외한다.
    > - 속성: 행사 분류가 아닐 때만, `attributes` 칩마다(`:353`).
    > - 지역: 가장 아래 단계 하나. `sigunguCode` → 없으면 `sidoCode` → 없으면 `areaCode`(`sidoCode` 가 없을 때만 질의에 실린다, `:335`). 해제는 기존 `selectRegion`(`:548-573`)으로 한 단계 위로 올린다.
    > - 반경(`geo`).
    >
    > 버튼마다 그 조건 하나만 풀고 `setPage(0)`. 검색어 해제는 `keyword`·`keywordInput`·`exactFor` 를 함께 비운다. 해제 결과로 `pickingRegion`(`:542`)이 참이 되면 지역 고르기 화면으로 바뀌는 것이 정상 동작이다. 조건 0개면 버튼 없이 이유 문장만, 2개 이상이면 「모두 해제」 버튼 하나.
    >
    > 계측: 해제 버튼·「모두 해제」·「원래 검색어로 검색」은 `SearchTrigger`(`:231-244`)에 새로 더한 `'relax'` 를 `triggerRef` 에 심고, `changedRef` 에 푼 축 이름(`keyword`·`category`·`eventStatus`·`attribute`·`region`·`geo`·`exact`)을 넣는다. `submit` 은 쓰지 않는다. `place-hub-instrumentation/spec.md` 집계 표에 `relax` 의 위치를 같은 커밋에서 적는다.
11. **SR-5.3**
    - 바꿀 문장: 「서버에 원문 검색 파라미터 `exact=true`(SearchAttractionController·UseCase.Query 에 추가, …)를 두고, FE 는 그 상태를 query 에 싣는다(검색어가 바뀌면 해제).」
    - 새 문장: 「서버에 원래 검색어 검색 파라미터 `exact=true`(`AttractionSearchController.kt:44-72`·UseCase.Query 에 추가, true 면 `correct()` 를 건너뛴다)를 둔다. FE 는 `placeApi.ts` 의 `AttractionQuery` 에 `exact?: boolean` 을 더하고 `searchAttractions`(`:405-428`)가 `exact=true` 를 싣는다. FE 상태는 불리언이 아니라 누른 순간의 검색어 `exactFor: string | null` 로 두고, 질의에는 `exact: exactFor != null && exactFor === keyword` 로 싣는다(검색어가 바뀌면 저절로 풀린다).」
12. **SR-5 끝에 추가 (5.5)**: 「`search/glossary.md` §3-2 에 "오타 교정(`correctedKeyword`)" 과 "원래 검색어 검색(`exact`)" 행을 더한다.」
13. **SR-6.1 수정**
    - 「`sourceText` 멱등」 → 「서버 정규화 값 `K-movie <PARASITE> - …` 를 응답으로 준 픽스처에서 카드 DOM 에 `<PARASITE>` 가 그대로 남는다(FE 재정규화 회귀 감지)」
    - 「통합 검색 summary 동일」 → 「통합 검색에서 관광지 외 타입 summary `List<String>` 이 그대로 보인다」
    - 「0건 화면에 걸린 조건별 해제 버튼(조건 3개 픽스처 → 버튼 3 + 모두 해제)」 뒤에 추가: 「조건 0개 → 버튼 0, 조건 1개 → 모두 해제 없음, 행사 분류에서 속성 버튼 없음, 기본 분류·기본 행사 상태 버튼 없음, 검색어 해제 뒤 입력창이 빈 값, 해제 클릭 뒤 계측 trigger 가 `relax`(`other` 아님)」
    - 「클릭하면 `exact=true` 질의」 뒤에 추가: 「검색어를 바꾸면 질의에서 `exact` 가 빠진다. `searchAttractions` 가 URL 에 `exact=true` 를 싣는지 `placeApi` 단위 테스트로 확인한다」
    - 언어 전환 테스트: 「`App.tsx` 의 `/place`·`/place/en` `<Routes>` 를 포함해 마운트한다」
    - 의도된 빨강: 「`PlacePage.test.tsx:112`(국문 문구), `:221`(`Not closed today`), `:222`(`Pets in some areas` 가 국문 전용으로 바뀜)의 기대값을 갱신한다」
14. **SR-6.2 수정**
    - 「통합 summary 정규화」 → 「`SearchUnifiedService` 는 관광지 overview 를 그대로 summary 로 쓰고, overview 가 null 이면 address 로 내려간다(`:73`)」
    - 추가: 「원문 `&lt;PARASITE&gt;` → 요약에 `<PARASITE>` 가 남는다」
    - 「`exact=true` 면 `correct` 미호출」 → 「… 미호출, `correctedKeyword == null`. `AttractionSearchControllerTest` 에 `exact` 바인딩 케이스를 둔다」
15. **SR-6.4 앞에 추가**: 「배포 순서: search:app(목록 요약) → portal-fe → search:batch(파서 v2) → 재색인. "30카드 노출 0" 확인은 search:app 배포 뒤에만 의미가 있다.」
    - 끝에 추가: 「S2-4 "null→불가 오해 0": 재색인 뒤 영문 주차 원문이 `N/A` 로 시작하는 문서의 `attrParking` 이 전부 UNKNOWN 인지 건수 표.」
16. **SR-6.3**
    - 바꿀 문장: 「카드 정규화 제거 → vitest 빨강」
    - 새 문장: 「패널 정규화 제거 → vitest 빨강. 카드에 FE 재정규화 추가 → `<PARASITE>` 테스트 빨강」
17. **Existing Code**
    - 「`PlacePage.tsx:1297-1318`」 → 「`PlacePage.tsx:1298-1319`」
    - 「`AttractionAttributeParser.kt:26,113,120,147-158`」은 그대로 둔다.
18. **Out of Scope 끝에 추가**: 「"개요 없음" 판정 통일 — 프리렌더 `hasOverview`(`prerender-seo.mjs:996`, SR-1.2 뒤에는 정규화 값 기준)와 서버 noindex(`AttractionPageRenderer.kt:63`, 원문 기준)는 태그·엔티티만 있는 개요에서 갈릴 수 있다. 후속 후보.」

## 재리뷰가 필요한 차원
- **architecture**: 정규화 위치 원칙과 계약 문구를 다시 봐야 합니다(G1·G6·G10).
- **usecase**: 해제 버튼 규칙, `relax` trigger, `exactFor` 를 다시 봐야 합니다(G3·G4·G9).
- **implementation**: 배포 순서, 롤백, `placeApi` 배선을 다시 봐야 합니다(G7·G8).
- **test-strategy**: SR-6 이 전면 개정됩니다.
- domain 은 G14(용어집) 반영만 확인하면 되므로 가볍게 봐도 됩니다. security 는 G6 문구만 확인하면 됩니다.

## 사용자 판단 필요
1. 새 계측 trigger `relax` 를 instrumentation 스펙의 「필터 적용」 건수에 넣을지, 「검색 제출·필터 적용 건수에서 빼는 것」 목록에 넣을지 정해야 합니다. 기준선 지표의 정의가 바뀌는 결정이라 심판이 정하지 않았습니다.

SUMMARY: keep 33 / demote 0 / dismiss 0
NOTES: domain 리뷰의 부수 주장 「`AttractionAttributeParser.kt:120` 은 주석 줄」은 틀렸습니다(실제로는 `PARKING_NO.containsMatchIn(text) -> Availability.NO` 코드 줄). 판정에는 영향이 없습니다. `AttractionSearchDocumentTest.kt:61` 의 `parserVersion shouldBe 1` 도 VERSION 2 에서 깨질 수 있어 구현 때 확인이 필요합니다.