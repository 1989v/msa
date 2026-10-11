# Review Verdict — 관광지 검색 질의 결함 셋 (2026-10-11)

입력은 엔지니어 리뷰 A(arch·impl·security)와 B(test·domain·usecase)의 발견 전건입니다. 참고 항목도 포함했습니다. 줄 번호는 워크트리 `scratchpad/wt-impl` 기준입니다.

## 직접 확인한 코드 사실 (판정 근거)

- **벡터 레그는 지금도 키워드 일치 안에서만 돈다.** `AttractionSearchAdapter.kt` 의 `buildRequest` 는 `matched = matchedQuery(query, query.keyword, …)` 를 만들어 `vectorLeg(embedding, matched)` 의 kNN `filter` 로 넘깁니다. `matchedQuery` 안에는 `b.must { m -> m.multiMatch { … } }` 가 있습니다.
- **건수 요청이 본 질의보다 먼저 나간다.** `search()` 첫 줄 주석이 「건수 요청을 먼저 띄우고 본 질의를 낸다 — 둘이 병렬로 돈다」입니다. `countFacets` 는 `keyword = query.keyword.takeIf { query.embedding == null }` 로 셉니다.
- **통합 검색이 같은 분석 함수를 쓴다.** `SearchUnifiedService.kt:29` 가 `QueryIntent.analyze(q, …, searchTypes = true)` 를 부르고, `:83` 이 `keyword = understood.residual` 를 다른 타입 검색에 넘깁니다. 잔여가 null 이면 `UnifiedSearchAdapter` 는 `matchAll` + `popularity` 정렬로 바뀝니다.
- **`QueryIntent` 쪽 현재 모양.**
  - `analyze(rawQuery, lexicon, searchTypes)` 에 언어 인자가 없습니다.
  - 불용구는 `if (one !in normalizedStopPhrases)` 로 한 어절만 봅니다.
  - `hasFilter` 는 `facets.isNotEmpty()` 뿐입니다.
- **컨트롤러에 파라미터 상수가 없다.** `AttractionSearchController.kt:61-67` 의 `parking: String?` 등은 Kotlin 인자 이름일 뿐입니다.
- **검증 명령의 필터가 아무것도 안 잡는다.** `search/batch/src/test/.../indexing/` 에는 `AttractionsIndexMappingTest.kt`·`IndexAliasManagerTest.kt`·`MarkdownPlainTextTest.kt` 만 있어, `'*AttractionIndex*Test'` 에 걸리는 파일이 없습니다.
- **`nori_search.filter` 는 지금 `["tourism_synonyms"]`(synonym_graph) 하나다.**
- **테스트 스텁은 늘 `total 0` 을 돌려준다.** `AttractionSearchRequestSnapshots.emptyResponse()` 가 `h.total { t -> t.value(0) … }` 입니다.
- **FE 쪽 현재 모양.**
  - 캐시 키는 `queryKey: ['place-attractions', query]`(`PlacePage.tsx:502`)입니다. `facets: true` 는 `:506` 에서 키 밖에서 붙습니다.
  - `placeHubState.ts:17,69,89` 는 `exactFor` 만 저장하고 검증합니다.
  - `relaxConditions` 는 첫 줄이 `if (s.keyword) out.push({ kind: 'keyword', … })` 입니다. 0건 문구는 `emptyReason: '고른 조건을 모두 만족하는 관광지가 없습니다…'` 입니다.
- **판정 파일은 ko 90 · en 60 질의다.**
- **판정 스펙의 규칙.** `judgment-cases/spec.md:112` 는 「순위 구성을 바꾸는 변경 … 비교 전에는 그 구성의 top-20 을 풀에 합치고」입니다. `:100` 은 「v3 첫 실행 값으로 `EVAL_BASELINE_KO/EN` 을 … 갱신」입니다.
- **클릭 계수는 기본 꺼짐이고, 짝 측정 경로가 이미 있다.** `AttractionClickBoostProperties` 는 `enabled: Boolean = false` 이고 k8s 에 env 가 없습니다. `live-eval.py --click-boost-pair` 가 같은 색인에서 켬·끔을 짝지어 재는 선례입니다(T1 대조군 제안의 근거).
- **「질의 이해」라는 말은 이미 코드에 있다.** `SearchAttractionService.kt:48`, `AttractionSearchAdapter.kt:219,550` 에서 씁니다(D2 강등 근거).

## 판정표

| id | 원판정 | 심판 | 근거 | 스펙에 반영할 편집 한 줄 |
|---|---|---|---|---|
| A-1 도메인 Condition 이 API 문자열을 듦 | REVISE | 유지 REVISE | 컨트롤러 `parking: String?` 은 상수가 아니라 인자 이름이고, `QueryIntent` 는 `:search:domain` 에 있다. tasks 2.2 의 「컨트롤러 상수에서 가져온다」는 지킬 수 없다 | SR-3.1: `Condition(kind: 속성 축 enum, values: 도메인 값 집합, phrase)`. param/value 문자열은 presentation 매핑 표 한 곳이 만들고, 컨트롤러 `@RequestParam(name=…)` 이 그 상수를 쓴다 |
| A-2 조건어·영문 불용어가 통합 검색 다른 타입에 샘 | REVISE | 유지 REVISE | `SearchUnifiedService.kt:29,83` 이 같은 `analyze` 의 잔여를 넘기고, null 이면 `matchAll` + 인기순이 된다 | SR-1·SR-3: 조건어 추출과 새 영문 불용어는 관광지 경로에서만(`analyze(…, attractionOnly=true)` 류). `SearchUnifiedServiceTest` 에 「travel」·「place」·「카드 결제 할인」 잔여 유지 케이스, TG6.1 주입 ⑯ 추가 |
| A-3 hasFilter 뜻이 갈림 | REVISE | 유지 REVISE | `QueryIntent` `val hasFilter: Boolean get() = facets.isNotEmpty()`, `intentCounter` 가 이 값을 센다 | SR-6.1: 한정 판정은 `facets 또는 conditions` 를 보는 별도 이름(`narrowsByIntent`)으로 하고 `intentCounter` 는 그대로. `keepConditionWords=true` 면 조건이 비어 CONFINE 이 걸린다고 명시 |
| I-1 벡터 레그 전제가 코드와 다름 | REVISE | 유지 REVISE | `vectorLeg(embedding, matched)` 의 filter 에 `must multiMatch` 가 든 `matched` 가 들어간다 | 원인 분석 2행을 「벡터 레그는 키워드 OR 일치 집합 안에서 k 를 채운다」로 고친다. SR-6.1 은 「`matchedQuery` 의 multi_match 에 msm — 두 레그가 함께 좁아진다」로. 근사 측정이 kNN 에 키워드 필터를 걸었는지 `verifications/` 에 한 줄 |
| I-2 게이트·CONFINE 과 패싯 건수 불일치 | REVISE | 유지 REVISE | `search()` 가 건수 요청을 먼저 띄운다. 하이브리드에서는 건수에서 검색어를 뺀다 | SR-5: 근거 0이면 건수 요청을 내지 않는다(근거 뒤 출발). SR-6: 한정 분기의 건수에도 msm. 4.1 테스트에 추가 |
| I-3 CONFINE 한정 분기에서 근거 요청 중복 | REVISE | 유지 REVISE | 한정 분기의 본 질의가 이미 msm 집합이다(SR-6.1·6.3) | SR-6: 「CONFINE + 쿼리 언더스탠딩 필터 없음이면 근거 요청 생략」. 4.1 에 「근거 요청 없음」 단언 |
| I-4 품사 필터 위치 미정 | REVISE | 유지 REVISE | `nori_search.filter` 가 `["tourism_synonyms"]`(synonym_graph)이고, SR-2.1 은 「더한다」고만 쓴다 | SR-2.1: 순서 `[pos, tourism_synonyms]`. 계약 테스트에 「품사 필터가 동의어 앞」, 회귀 주입에 순서 뒤집기 추가. 「서울 궁궐」 msm `_count` 탐침 |
| I-5 해석 칩 표시 방식 미정 | REVISE | 유지 REVISE | `attributes` 가 `query` 메모 의존성(`PlacePage.tsx:498`)에 있어, 거기 넣으면 요청이 한 번 더 나간다 | SR-4.2: 해석 조건은 응답에서 파생한 표시 상태이고 `attributes` 에 넣지 않는다. TG3.1 ①에 「추가 요청 없음」 |
| I-6 keepConditionWords 위치·캐시 키 | REVISE | 유지 REVISE | `queryKey: ['place-attractions', query]` 이고, `facets` 는 키 밖에서 붙는다(`:506`) | TG3.2: `keepConditionWords` 는 `exact` 처럼 `query` 메모 안(의존성 배열 포함). `keepWordsFor` 를 `PlaceHubState` 에 추가 |
| I-7 batch 테스트 필터 불일치 | REVISE | 유지 REVISE | indexing 테스트 폴더에 `AttractionsIndexMappingTest.kt` 만 있어 `*AttractionIndex*Test` 에 안 걸린다 | tasks 4.1·4.5: 계약 테스트는 `AttractionsIndexMappingTest` 에, 필터는 `'*AttractionsIndexMappingTest'` |
| I-8 단계 1·SR-2 되돌림 경로 없음 | REVISE | 유지 REVISE | SR-7.3 은 「env 되돌림 — 코드 배포 없이」인데 SR-1·SR-3 에는 스위치가 없다 | SR-7.3: 조건어 해석 스위치를 두고, 「SR-1 은 되돌림 배포, SR-2 는 보관 색인으로 별칭 이동 후 JSON 되돌림」을 명시(T1 과 합침) |
| I-9 단계 측정 통제 변수 | REVISE | 유지 REVISE | 클릭 계수는 기본 false 에 env 가 없다. `ids_live` 는 keyword·lang·size·sort 만 보낸다 | SR-7.5: 단계 1~3 동안 클릭 계수·하이브리드·융합 스위치 고정. 결과 JSON 에 색인 이름. 통합 검색 회귀는 단위 테스트로만 잡힌다고 명시 |
| I-참고1 page>0 게이트 생략 | 참고 | 유지 MINOR | 리뷰어 스스로 「조기 최적화 금지라 제안만」 | 편집 없음(p99 측정 후 판단) |
| I-참고2 품사 필터로 잔여 전체가 사라지는 0건 | 참고 | 유지 MINOR | SR-1.4 `noContent` 와 경계가 다르다는 지적. 반증 없음 | SR-5 에 「품사 필터로 잔여가 비면 multi_match 0건 — noContent 와 별개」 한 줄 |
| I-참고3 search-architecture 줄 번호 드리프트 | 참고 | 유지 MINOR | 리뷰어 인용 근거. 반증 없음 | SR-8 동기화 때 §4 줄 번호 갱신 |
| S-참고1 phrase XSS | 참고 | 유지 MINOR | `phrase` 는 사용자 입력이 되돌아오는 값이다 | TG3.1: 안내 줄은 React 텍스트 노드로 넣고 `<b>` 든 검색어 케이스 하나 |
| S-참고2 근거 요청 DoS | 참고 | 유지 MINOR | 증폭 경로 없음이라는 판단이고, 반증도 결함도 없다 | 편집 없음(I-3 반영 시 CONFINE 은 증가 0) |
| T1 단계 1 env 되돌림 불가·효과 분리 불가 | REVISE | 유지 REVISE | SR-1·SR-3 에 스위치가 없다. 짝 측정 선례 `live-eval.py --click-boost-pair` 가 실재한다 | SR-7.2: 단계 1 은 같은 실행에서 `keepConditionWords=true` 대조군을 짝으로 잰다(`--condition-pair`). 되돌림 절차는 I-8 과 같은 문장 |
| T2 탐침 12 중 넷은 자기 측정 | REVISE | 유지 REVISE | SR-5.3 실측 목록에 「도쿄 수족관」이 없다. 「에펠탑 ≤10」은 msm 으로 잰 8건에 맞춘 문턱이다 | SR-7.1: 탐침 × 단계 기대표. 에펠탑·디즈니랜드는 「남은 문서 전부 글자 그대로 언급 — 사람 확인」(Q1 과 묶음). 도쿄 수족관은 착수 전 `_count`. attrParking·petPolicy 검사는 「배선 확인」으로 이름 변경. 해수욕장·경복궁 기준 id 를 `verifications/` 에 고정하고 허용 4/5 |
| T3 채택 조건 vs 잡음·p99·풀링 | REVISE | 유지 REVISE | en 60 질의다. 판정 스펙 `:112` 는 순위 구성 변경 비교 **전** 풀링이다. SR-7.3 에 p99 조건이 없다 | SR-7.3: 무변경 이틀로 잡음 하한을 먼저 잰다. p99 가 ADR-0025 Tier 1 예산을 넘으면 불채택. 단계 2·3 전에 그 구성 top-20 풀링(판정 스펙 SR-6.3 과 같게) |
| T4 회귀 주입 ⑤⑥⑦⑨ 불확실·누락 | REVISE | 유지 REVISE | `analyze` 에 언어 인자가 없다. parking 꼬리말에 `무료` 가 있어 ⑥이 안 물 수 있다 | TG1/2 에 `analyze(…, lang)`. 조건 처리 순서 명시. ⑦은 다른 param 으로 고정. ⑨는 근거 경로에서만 주입하고 filter JSON 동일 + 지역 코드 존재로 단언. ⑯ CONFINE 필터 분기, ⑰ 조사 떼기, ⑱ 근거 실패 삼킴 추가 |
| T5 스텁이 근거 있음 경로를 못 엶 | REVISE | 유지 REVISE | `emptyResponse()` 가 `t.value(0)` 고정이다 | TG4.1: 근거 요청에만 total 1 을 돌려주는 스텁 |
| T6 음성·경계 케이스 부족 | REVISE | 유지 REVISE | SR-1.5·3.5 목록에 부정어·어순·조건 둘·행사 분류 케이스가 없다 | SR-3.5 에 「반려동물 동반 불가」「카드 결제 안 되는 곳」「무료 주차장」「주차가 되는 해수욕장」「주차 되는 반려견 동반 해수욕장」, 칩 pet=ALLOWED + 「반려견 동반」, 행사 + 「주차 되는 축제」, 근거 실패, exact+GATE 추가 |
| T7 판정 세트 v3 와의 순서 | REVISE | 유지 REVISE | 판정 스펙 `:100` 에서 v3 첫 실행이 기준선을 다시 정한다. NO_ANSWER 는 C 평균에서 빠진다(SR-7.2) | SR-7.1: 순서는 v3 머지 → v3 첫 실행·기준선 갱신 → 단계 1. 세트는 단계 3 까지 고정. 단계 2·3 은 v3 선행 |
| D1 Condition 이 presentation 문자열을 끎 | REVISE | 유지 REVISE | A-1 과 같은 근거(같은 결함, 두 리뷰어 독립 검출) | A-1 편집과 같다 |
| D2 「질의 이해」 vs glossary 「쿼리 언더스탠딩」, 새 용어 행 부족 | REVISE | **강등 MINOR** | ⓑ 「질의 이해」는 코드에 이미 실존한다: `SearchAttractionService.kt:48` 「질의 이해가 의도어를…」, `AttractionSearchAdapter.kt:219,550`. 새 용어 행 부족은 문서 보강이라 MINOR | SR-8: glossary 새 행은 「쿼리 언더스탠딩」 표기로 쓰고, 「머리말·꼬리말」「한정(CONFINE)」「내용 없는 입력」 행 추가. 「근거」는 판정 세트 `evidence` 와 다르다고 비고 |
| D3 조건어 의미 경계 (a~f) | REVISE | 유지 REVISE | SR-3.1 표: 예외가 「바로 앞 어절」만 본다. parking 꼬리말에 `무료`. admission 은 꼬리 없이 성립. 부정어 규칙이 없다. 조사 목록에 `가·이·은·는` 이 없다. pet·wheelchair 행은 ko 인데 영문 머리말이 있다 | SR-3.2: 예외를 「앞 또는 뒤 어절」로. 꼬리말 `무료` 와 예외 중 하나만 둔다. `무료` 단독은 다음 어절이 없거나 쿼리 언더스탠딩이 가져가는 말일 때만. 부정어(안·못·불가·불가능·금지·no·not)가 붙으면 미해석. 조사 `가·이·은·는` 추가. ko 전용 행의 영문 머리말은 삭제하거나 의도를 명시 |
| D4 합집합이 좁힌 명시 선택을 덮음 | REVISE | 유지 REVISE | SR-3.3 「합집합」과 Q4 「사용자가 PARTIAL 만 끌 수 있다」가 충돌한다 | SR-3.3: 같은 param 에 명시 선택이 있으면 그 param 의 해석은 버리고 명시를 쓴다(어절은 잔여에서 뺀다) |
| D5 행사 분류에서 속성 무의미 | REVISE | 유지 REVISE | glossary:75 「목록에서 「행사」를 고르면 화면이 칩·속성 조건·건수 요청을 모두 뺀다」 | SR-3: 요청 category 가 행사 하나뿐이면 조건어를 옮기지 않는다 |
| D6 해석 필터는 UNKNOWN 제외 고지 | REVISE | 유지 REVISE | glossary:75, `placeAttributes.ts:77` 「정보가 있는 곳만 거릅니다」 | SR-4.2 안내 줄에 `ATTRIBUTE_CAPTION` 재사용 문구를 덧붙인다 |
| U1 해석 해제 시 GATE 0건 | REVISE | 유지 REVISE | SR-4.3 은 칩 하나를 끄면 전체 `keepConditionWords=true`. SR-5.1 은 잔여 msm 근거를 요구한다. 통합 검색은 늘 true(SR-3.4) | SR-5.1 또는 SR-4.3 에 사용자 판단 1의 결정을 쓴다. Q2 에 기록 |
| U2 정답 없음 0건에 조건 탓 문구 | REVISE | 유지 REVISE | `relaxConditions` 첫 줄이 keyword 를 넣고, 이어서 `emptyReason` 「고른 조건을 모두…」이 뜬다 | SR-4.5·SR-5: 응답 `zeroReason: NO_EVIDENCE·NO_CONTENT·null`, ko·en 문구. 검색어 해제 버튼 이름 변경. TG3 ⑦ 추가 |
| U3 근거 요청 실패 처리 미정 | REVISE | 유지 REVISE | SR-5.4 에 실패·타임아웃 규정이 없다. 화면에는 `isError` 분기(「실패는 조건 탓이 아니다」)가 있다 | SR-5.4: 근거 요청 실패는 예외로 올린다(0건으로 삼키지 않음). 주입 ⑱ |
| U4 칩 건수와 목록 어긋남 | REVISE | 유지 REVISE | I-2 와 같은 코드 근거 | I-2 편집과 합친다 |
| U5 「원래 검색어로 검색」 vs 「검색어 그대로 검색」 혼동 | REVISE | 유지 REVISE | glossary:118 `exact` 링크 문구와 SR-4.2 문구가 거의 같고, 오타 + 조건 질의에서 둘이 함께 뜬다. 스타일이 아니라 동작이 다른 두 링크의 식별 문제다 | SR-4.2: 조건 쪽 문구를 「조건으로 읽지 않고 검색」으로 바꾸고, 두 링크 동시 노출 배치를 정한다 |
| U6 화면 흐름 빈칸 | REVISE | 유지 REVISE | `placeHubState.ts` 가 `exactFor` 만 다룬다. 반려동물 칩이 둘이다(`placeAttributes.ts:57-58`) | SR-4.2: 조건 둘 이상의 안내 줄 형식, 반려동물 칩 이름, en 문장 틀. TG3.2 에 `placeHubState.ts` 추가 |
| U7 exact + GATE | REVISE | 유지 REVISE | `exact` 는 교정을 건너뛴다(`SearchAttractionService` `takeUnless { query.exact }`). 오타 원문이 근거 검사를 받는다 | SR-5 에 exact 경로 동작을 명시하고, 0건 문구에 교정어로 되돌리는 링크 |

## Overall

**REVISE (착수 전 스펙 편집 필요).** BLOCK 은 없습니다.

1. **가장 큰 결함은 A-2 다.** 통합 검색의 다른 타입이 `matchAll` 로 바뀌는 회귀입니다. 스펙 결정과 코드를 둘 다 인용하고 있어 BLOCK 자격은 갖췄지만, 리뷰어가 REVISE 로 냈고 승격할 추가 근거가 없어 REVISE 로 둡니다.
2. **I-1 은 원인 분석 문장을 바꾼다.** 근사 측정 표의 B 행이 지금 경로인지 재확인이 필요합니다. 그 표가 Q5 판단의 근거라 재확인 결과가 Q5 에 영향을 줍니다.
3. **같은 결함을 두 리뷰어가 따로 찾은 짝이 넷이다.** A-1=D1, I-2=U4, I-8≈T1, I-6⊂U6 입니다. 편집은 한 번만 하면 됩니다.

SUMMARY: keep 36 / demote 1 / dismiss 0
NOTES: A-2 는 BLOCK 자격(스펙 결정 + 코드 위반 둘 다 인용)이 있었지만 리뷰어 원판정을 따라 REVISE 로 둠.

## 사용자 판단 목록 (권고 기본값으로 진행하고, 바꾸려면 알려 주세요)

| # | 판단 | 권고 기본값 | 근거 발견 |
|---|---|---|---|
| 1 | 해석 해제가 GATE 에서 0건을 만드는 문제를 어떻게 풀지 | **(가)+(나) 둘 다.** (가) 근거 검사용 잔여에서는 조건어 머리말·꼬리말 어절을 늘 뺀다. 통합 검색·미해석 조건·「검색어 그대로」까지 한 번에 막힌다. (나) 칩 끄기는 `skipCondition=<param>` 로 그 param 의 해석만 버린다. SR-4.3 의 「나머지를 명시 칩으로 옮기기」가 사라진다 | U1, U6 |
| 2 | 단계 1 되돌림 방식 | `search.attraction.condition-words.enabled` 스위치(기본 true)를 둔다. SR-1 은 되돌림 배포, SR-2 는 보관 색인으로 별칭을 옮긴다. 효과 분리는 `keepConditionWords=true` 짝 측정 | I-8, T1 |
| 3 | 단계 2·3 이 판정 세트 v3 를 선행 조건으로 삼는지 | 그렇다. 순서는 v3 머지 → v3 첫 실행·기준선 갱신 → 단계 1. 세트는 단계 3 까지 고정 | T7 |
| 4 | 「에펠탑」「디즈니랜드」 탐침 기대 | 0 을 요구하지 않는다. CONFINE 에서 남은 문서 전부가 개요에 글자 그대로 언급된 것인지 사람이 확인하고, 건수를 따로 보고(Q1 유지) | T2 |
| 5 | 「무료」 단독 해석 범위 | 다음 어절이 없거나 쿼리 언더스탠딩이 가져가는 말(유형·분류·불용구)일 때만 `admission=FREE`. 「무료 셔틀/체험/와이파이」는 미해석 | D3c |
| 6 | 「주차 무료」 처리 | 꼬리말 `무료` 를 유지하고(결과는 주차 가능, 안내 줄에 그대로 보임) admission 예외는 「앞 또는 뒤 어절이 parking 머리말」로. 둘 다 두되 처리 순서를 「parking 이 먼저 어절 소비」로 명시 | D3a·b, T4⑥ |
| 7 | 명시 칩과 해석이 같은 param 일 때 | 명시 선택이 이긴다(해석 버림, 어절은 잔여에서 뺌) | D4 |
| 8 | 0건 사유 필드 | `zeroReason` 을 추가한다(NO_EVIDENCE·NO_CONTENT·null) | U2 |
| 9 | 근거 요청 실패 | 예외로 올려 화면 실패 분기를 탄다(fail-closed 0건 금지) | U3 |
| 10 | exact + GATE | 게이트를 그대로 걸고, 0건 화면에 교정어로 다시 검색하는 링크를 둔다 | U7 |
| 11 | p99 채택 조건 | ADR-0025 Tier 1 예산을 넘으면 그 단계를 켜지 않는다. 잡음 하한은 무변경 이틀 정기 실행 차이로 먼저 잰다 | T3 |
| 12 | ko 전용 행의 영문 머리말(pet·wheelchair) | 삭제한다. 언어 열 규칙과 맞춘다 | D3f |