# 엔지니어 리뷰 A — architecture · implementation · security

대상: `docs/specs/2026-10-10-place-search-query-fixes/` (spec.md · tasks.md · context/open-questions.yml), 워크트리 `scratchpad/wt-impl`.
체크리스트: hns 0.15.1 `reviewers/{architecture,implementation,security}/checklist.md` (0.16.1 경로 없음).
운영 확인: 이 세션에 셸 도구가 없어 `ssh msa-oci` 조회를 하지 못했다. 아래 판정은 전부 레포 코드와 스펙에서 나왔다. 운영 값(분석기 실측·p99)은 TG4.4·TG6 에서 확인할 몫이다.

| 관점 | 판정 | 이슈 |
|---|---|---|
| architecture | REVISE | 3 |
| implementation | REVISE | 9 |
| security | SHIP | 0 (참고 2) |

---

## 요청받은 다섯 가지 — 먼저 답

1. **품사 필터가 색인을 다시 만들지 않고도 적용되나.** 바뀌는 것은 검색 분석기뿐이다(`attractions-index.json:248-254` `nori_search` 는 `title`·`titleLocal`·`address`·`overview` 의 `search_analyzer`, `:288-337`). 그래서 문서를 다시 넣을 필요는 원리상 없다. 다만 **이미 있는 색인의 분석기 정의를 바꾸려면 `_close` → `PUT _settings` → `_open` 을 거쳐야 한다**. 별칭 뒤 색인이 하나라(`IndexAliasManager.kt:71`) 닫혀 있는 동안 검색이 실패한다. 스펙은 그 길을 피하고 다음 정기 재색인(새 색인 생성, `IndexAliasManager.kt:50`)에서 반영한다(SR-2.2, `spec.md:47`). 이 선택이 맞다. 되돌릴 때는 보관된 이전 색인(`maxRetention = 2`, `:71`)으로 별칭을 옮기면 되지만, 스펙에 그 절차가 없다(I-8).
2. **msm 근거 게이트의 지연·쿼리 비용.** 요청 하나에 `size 0 · terminate_after 1` 짜리 bool 검색 한 번이 **직렬로** 붙는다. 샤드 1개·노드 1개라 왕복 한 번 값이다. 다만 ① `CONFINE` 의 한정 분기에서는 본 질의가 이미 msm 집합으로 줄어 있어서 근거 요청이 같은 답을 한 번 더 구하는 셈이다(I-3). ② 패싯 건수 요청은 지금 본 질의보다 먼저 출발한다(`AttractionSearchAdapter.kt:177-179`). 그래서 게이트가 0이면 결과 0건 화면에 건수가 0이 아닌 칩이 함께 나온다(I-2).
3. **CONFINE 과 클릭 계수·정렬.** 클릭 계수는 키워드 레그의 `function_score` 에만 붙는다(`:669-673`, `:811-837`). `CONFINE` 은 그 안의 `multi_match` 에 msm 을 거는 것이라 계수 함수는 그대로 곱해지고, 벡터 레그에는 원래 계수가 없다. 하이브리드는 정렬을 걸지 않는다(`:717-721`). 거리순·시작일순이면 벡터 레그가 없어(`SearchAttractionService.kt:188`) `CONFINE` 의 효과가 키워드 레그 msm 하나로 줄어든다. 충돌은 없다. 다만 운영 클릭 계수가 꺼져 있다(`AttractionClickBoostProperties.kt:15-18` 기본 false, `k8s/base/search/deployment.yaml` 에 env 없음). 단계 1~3을 재는 동안 클릭 계수 스위치를 고정해야 한다는 조건이 SR-7 에 없다(I-9).
4. **`keepConditionWords` 와 캐시 키.** 서버의 목록 검색에는 응답 캐시가 없다. `Cache-Control` 은 상세·주변에만 붙고(`AttractionSearchController.kt:107-121`) 게이트웨이에도 검색 캐시가 없다. 질의 벡터 캐시(`QueryVectorService.kt:51`)의 키는 교정 뒤 원문인데(`SearchAttractionService.kt:91`), 조건어를 옮겨도 벡터 입력은 원문 그대로라 영향이 없다. **위험은 FE 에 있다.** react-query 키가 `['place-attractions', query]` 이고(`PlacePage.tsx:497-498`), `facets` 처럼 `query` 밖에서 덧붙이는 값(`:502`)은 키에 들어가지 않는다. `keepConditionWords` 를 그렇게 붙이면 해석한 응답과 해석하지 않은 응답이 같은 키를 쓴다(I-6).
5. **통합 검색(ADR-0090) 경로 회귀.** SR-3.4 는 관광지 호출(`SearchUnifiedService.kt:60-63`)만 다룬다. 통합 검색은 **자기 `QueryIntent.analyze`**(`:29`)의 잔여를 다른 타입 검색에 그대로 넘긴다(`:83`). 그래서 SR-1.2 영문 불용어와 SR-3 조건어가 블로그·게임·혜택·서비스 검색어까지 지운다. 잔여가 null 이 되면 `UnifiedSearchAdapter` 가 `match_all` + 인기순으로 바뀐다(`UnifiedSearchAdapter.kt:24-44`). 이것이 가장 큰 결함이다(A-2).

---

## architecture — REVISE

체크: 레이어 분리 △ · 상향 의존 없음 ○ · 외부 연동은 포트 경유 ○ · 모듈 경계 변경 근거 △ · 패턴 일관 ○ · 순환 없음 ○ · 트랜잭션 해당 없음 · 새 모듈 삭제 테스트(`AttractionAnswerEvidenceProperties`) ○

**A-1. 도메인 `Condition(param, value)` 이 API 파라미터 문자열을 들고 있다.**
- 근거: SR-3.1 (`spec.md:51`) 「`param`·`value` 는 검색 API 속성 파라미터와 같은 이름·값」, tasks 2.2 (`tasks.md:24`) 「컨트롤러 파라미터 문자열과 같은 상수에서 가져온다」. `QueryIntent` 는 `:search:domain` 에 있고(`QueryIntent.kt:1`), 컨트롤러 파라미터는 상수가 아니라 Kotlin 매개변수 이름이다(`AttractionSearchController.kt:61-67`). 도메인은 presentation 상수를 import 할 수 없다(CLAUDE.md 의존 방향).
- 수정안: 도메인 `Condition` 은 타입 값(예: `Condition(kind: AttributeKind, value: Set<String>, phrase)`, 또는 `AttributeSelection` 의 부분 선택)으로 둔다. 서비스는 그것을 `AttributeSelection` 과 합친다(`SearchAttractionService.kt:141-155` 와 같은 타입이라 합집합이 자연스럽다). `param`/`value` 문자열은 응답 DTO 를 만드는 presentation 이 만든다. 「사본이 없어야 한다」는 요구는 컨트롤러가 `@RequestParam(name = AttributeParams.PARKING)` 처럼 **presentation 상수**를 쓰고 응답 매핑도 같은 상수를 쓰는 것으로 지킨다.

**A-2. 조건어 해석·새 영문 불용어가 통합 검색의 다른 타입에 샌다 (BLOCK 후보였으나 수정이 명확해 REVISE).**
- 스펙 결정: SR-1.2 (`spec.md:40`) `trip·travel·place·places·spot·visit·things to do` 를 `STOP_PHRASES` 에 더한다. SR-3.4 (`spec.md:64`)는 통합 검색의 **관광지 호출**에만 `keepConditionWords=true` 를 준다.
- 코드: `SearchUnifiedService.kt:29` 가 같은 `QueryIntent.analyze` 를 부르고 `:83` 이 그 잔여를 블로그·게임·개념·혜택·서비스·상품 검색에 넘긴다. 잔여가 null 이면 `UnifiedSearchAdapter.kt:27-44` 가 `match_all` + `popularity` 순이 된다.
- 결과: 「travel」 블로그 검색이 인기 글 전체가 되고, 서비스 「place」 는 서비스 전체가 된다. 「카드 결제 할인」(혜택)은 `creditCard` 조건으로 「카드 결제」가 빠진다.
- 수정안: ① 조건어 추출은 `analyze(..., conditions = false)` 기본 꺼짐으로 두고 관광지 서비스만 켠다. ② 새 영문 불용어는 관광지 전용 집합으로 나누거나 `searchTypes = true` 경로에서는 적용하지 않는다. ③ `SearchUnifiedServiceTest` 에 「travel」·「place」·「카드 결제 할인」의 `others()` 잔여가 그대로인지 보는 케이스를 넣고, TG6.1 회귀 주입 목록에도 추가한다.

**A-3. `hasFilter` 의 뜻이 두 군데에서 갈린다.**
- 근거: SR-6.1 (`spec.md:82`) 「질의 이해가 필터(분류·유형·실내외·**조건**)를 하나도 만들지 않았으면」. 지금 `Understood.hasFilter` 는 `facets.isNotEmpty()` 뿐이고(`QueryIntent.kt:161`) `intentCounter` 가 그 값을 센다(`SearchAttractionService.kt:94`).
- 수정안: `CONFINE` 분기 판정은 `hasFilter || conditions.isNotEmpty()` 로 따로 이름을 붙인다(예: `narrowsByIntent`). `intentCounter` 의 뜻은 바꾸지 않는다(Q8 「카운터를 건드리지 않는다」와 맞춘다). `keepConditionWords=true` 면 조건이 비어 `CONFINE` 이 걸린다는 점을 SR-6 에 한 줄 적는다.

---

## implementation — REVISE

체크: 참조 클래스 존재 △ · 기존 코드와 충돌 ✗ · 복잡도 위험 ○ · NFR(직렬 IO·불필요한 왕복) △ · 마이그레이션/롤백 △ · 동시성 △

**I-1. 벡터 레그는 지금도 키워드 OR 일치 집합 안에서만 돈다 — 원인 분석과 SR-6.1 의 전제가 코드와 다르다.**
- 코드: `buildRequest` 는 `matched = matchedQuery(query, query.keyword, ...)`(`AttractionSearchAdapter.kt:667`)를 만들고, `must multi_match`(`:580`)가 든 그 bool 을 벡터 레그의 kNN `filter` 로 그대로 넣는다(`:690` → `:755-770`). 테스트도 「키워드 레그의 필터를 그대로 감싸 넣었다」고 확인한다(`AttractionSearchAdapterHybridTest.kt:133-137`).
- 스펙: 원인 분석 둘째 행(`spec.md:15`)은 「필터드 kNN 은 … 가장 가까운 100개」라고 쓰고, SR-6.1(`spec.md:82`)은 「벡터 레그의 kNN `filter` 에 같은 msm 일치를 **더한다**」고 쓴다. 근사 측정 표(`spec.md:26-27`)의 「벡터 그대로」와 「벡터를 msm 일치 문서로 한정」도 지금 벡터가 어휘와 무관하다는 전제로 읽힌다.
- 영향: ① 그대로 구현하면 kNN filter 안에 OR `must` 와 msm 이 둘 다 들어간다(결과는 같지만 사본이 생긴다). ② `CONFINE` 의 실제 변경은 공유되는 `matched` 의 `multi_match` 에 msm 을 거는 한 곳이고, 그것만으로 두 레그가 함께 좁아진다. ③ 근사 측정 스크립트가 kNN 을 키워드 필터 없이 돌렸다면 표의 B 행은 지금 경로가 아니다. 그 값을 Q5 판단 근거로 쓴 부분은 다시 봐야 한다.
- 수정안: 원인 분석 둘째 행을 「벡터 레그는 키워드 OR 일치 문서 안에서 k 개를 채운다. OR 집합이 수백~천 건이라 사실상 늘 100이다」로 고친다. SR-6.1 을 「`matchedQuery` 의 `multi_match` 에 msm 을 건다. 두 레그가 같은 bool 을 쓰므로 벡터 레그도 함께 좁아진다」로 바꾼다. 테스트 4.1 은 「두 레그의 msm 이 같은 Query 객체에서 나온다」를 단언한다. 근사 측정 스크립트가 kNN 에 키워드 필터를 걸었는지 `verifications/` 에 한 줄 남긴다.

**I-2. 근거 게이트·`CONFINE` 과 패싯 건수가 어긋난다.**
- 코드: 건수 요청은 본 질의보다 먼저 비동기로 출발한다(`:177-179`). 하이브리드 경로에서는 건수에서 검색어를 뺀다(`:229` `keyword = query.keyword.takeIf { query.embedding == null }`).
- 스펙: SR-5.1·5.4(`spec.md:75,78`)는 근거 0이면 본 질의를 내지 않는다고 하고, SR-3.3(`:63`)은 건수를 합친 선택으로 센다고만 한다.
- 결과: ① `GATE` 에서 결과 0건인데 칩 옆 건수가 수십~수백이 나온다. SR-4.5 의 0건 해제 버튼이 그 건수를 보여 주면 「풀면 나온다」로 잘못 읽힌다. ② `CONFINE` 에서는 결과가 msm 집합(「에펠탑」 8건)인데 건수는 검색어 없는 구조 필터 기준이라 수천이다.
- 수정안: SR-5 에 「근거 0이면 건수 요청을 내지 않는다(취소하거나 근거 요청 뒤에 출발)」, SR-6 에 「`CONFINE` 한정 분기의 건수는 msm 키워드를 건다」를 더하고 4.1 테스트 케이스로 넣는다.

**I-3. `CONFINE` 한정 분기에서 근거 요청이 중복이다.**
- 근거: SR-6.3(`spec.md:84`) 「`CONFINE` 은 SR-5 + SR-6」. 한정 분기에서는 본 질의 자체가 msm 집합이라 근거 0이면 본 질의도 0건이다.
- 수정안: 「`CONFINE` 이고 질의 이해 필터가 없으면 근거 요청을 생략한다(본 질의가 근거를 겸한다)」를 SR-6 에 적는다. p99 증가분이 그 분기에서 0이 된다. tasks 4.1 의 `CONFINE` + 필터 없음 케이스에 「근거 요청 없음」 단언을 넣는다.

**I-4. 품사 필터의 위치를 정하지 않았다 — `synonym_graph` 뒤에 두면 안 된다.**
- 근거: `nori_search.filter` 에는 이미 `tourism_synonyms`(`synonym_graph`, `attractions-index.json:10-24`, `:251-253`)가 있다. SR-2.1(`spec.md:46`)은 「필터를 더한다」고만 쓴다.
- 이유: `nori_part_of_speech` 는 토크나이저가 단 품사 속성을 읽는다. 동의어가 끼워 넣은 토큰에는 품사가 없다. 또 그래프 필터 뒤에서 토큰을 지우면 position length 가 깨질 수 있다.
- 수정안: 순서를 `["<pos 필터>", "tourism_synonyms"]` 로 못 박는다. SR-2.3 계약 테스트에 「품사 필터가 동의어 필터 **앞**」을 단언으로 넣고, TG6.1 회귀 주입에 순서 뒤집기를 더한다. SR-2.2 `_analyze` 실측도 이 순서로 한다. 동의어가 든 잔여(「서울 궁궐」)에서 msm 이 그래프 경로를 어떻게 세는지 `_count` 로 한 번 확인하고 탐침에 추가한다. 근사 손실 상위가 바로 이 질의다(`spec.md:83`).

**I-5. 해석된 조건을 「켜진 칩」으로 보이는 방식이 정해지지 않았다.**
- 근거: SR-4.2(`spec.md:69`) 「해석된 조건은 칩 줄에서 켜진 칩으로 보이고」. 칩 상태는 `attributes` 이고 `query` 를 거쳐 다시 요청한다(`PlacePage.tsx:489,494`).
- 위험: 해석 조건을 `attributes` 상태에 넣으면 응답마다 요청이 한 번 더 나가고 새 view·SEARCH 이벤트가 생긴다(`:517`). 그때 trigger 는 `other` 다(`:543-549`).
- 수정안: 「해석 조건은 응답에서 파생한 표시 상태이고 `attributes` 에 넣지 않는다. 명시 칩으로 옮기는 것은 SR-4.3 의 해제 때뿐이다」를 적고, TG3.1 ①에 「추가 요청 없음」 단언을 넣는다.

**I-6. FE 에서 `keepConditionWords` 를 어디에 둘지 정해야 한다 — 캐시 키와 상태 복원.**
- 근거: 질의 키는 `['place-attractions', query]` 이다(`PlacePage.tsx:497-498`). `facets` 는 키 밖에서 붙는다(`:502`). 로그인 왕복 상태 `PlaceHubState` 는 `exactFor` 만 저장·검증한다(`placeHubState.ts:15-29`, `:69`, `PlacePage.tsx:529-533`).
- 수정안: tasks 3.2 에 ① `keepConditionWords` 는 `exact` 처럼 `query` 메모 안에 둔다(`PlacePage.tsx:490` 옆, 의존성 배열 `:494` 포함). 그래야 캐시 키와 뽑기가 같은 값을 본다. ② `keepWordsFor` 를 `PlaceHubState`·`parsePlaceHubState` 에 더한다. ③ 테스트 3.1 에 「같은 검색어에서 keepConditionWords 만 다르면 요청이 두 번 나간다」를 넣는다.

**I-7. 검증 명령의 테스트 필터가 기존 파일과 맞지 않는다.**
- 근거: tasks 4.5(`tasks.md:41`) `:search:batch:test --tests '*AttractionIndex*Test'`. 기존 파일은 `AttractionsIndexMappingTest.kt` 와 `IndexAliasManagerTest.kt` 뿐이라(`search/batch/src/test/kotlin/com/kgd/search/infrastructure/indexing/`) 필터에 아무것도 안 걸리고 Gradle 이 「No tests found」로 실패한다.
- 수정안: 계약 테스트를 `AttractionsIndexMappingTest` 에 넣고 필터를 `'*AttractionsIndexMappingTest'` 로 고친다.

**I-8. 단계 1과 SR-2 의 되돌림 경로가 없다.**
- 근거: SR-7.3(`spec.md:91`) 「env 되돌림 — 코드 배포 없이」. 그러나 단계 1(SR-1·SR-3·SR-4)에는 스위치가 없고 SR-2 는 색인 JSON 이다.
- 수정안: 단계 1 채택 조건을 어겼을 때의 절차를 적는다. 예: 조건어 해석만 `search.attraction.condition-words.enabled` 스위치로 감싸고, SR-1 은 코드 되돌림 배포, SR-2 는 보관된 이전 색인으로 별칭을 옮긴 뒤 다음 재색인 전에 JSON 을 되돌린다. 아니면 「단계 1은 되돌림이 배포다」라고 명시한다.

**I-9. 단계 측정의 통제 변수.**
- 근거: SR-7.2(`spec.md:88-90`)는 단계끼리 짝지어 비교한다. 클릭 계수 스위치(`AttractionClickBoostProperties.kt:15-18`)와 정기 재색인 사이의 데이터 변화가 같은 창에서 움직일 수 있다.
- 수정안: 「단계 1~3 동안 클릭 계수·하이브리드·융합 스위치를 고정한다. 단계 2·3 은 같은 색인 이름에서 잰다(결과 JSON 에 `resolve_index()` 값을 남긴다)」를 SR-7.5 에 적는다. `live-eval.py:76` 은 검색어·언어·크기·정렬만 보내므로 통합 검색 경로는 이 측정에 들어가지 않는다. A-2 의 회귀는 단위 테스트로만 잡힌다는 점도 함께 적는다.

참고(이슈 아님)
- 게이트는 쪽마다(`page>0`)·뽑기마다 다시 돈다. 첫 쪽에 근거가 있었으면 뒷장에도 있다. 측정한 p99 가 크면 `page > 0` 에서 생략하는 선택지가 있다(조기 최적화 금지라 지금은 제안만).
- 잔여 토큰이 전부 품사 필터에 걸려 사라지는 질의(예: 조사 한 글자)는 `multi_match` 가 `zero_terms_query: none` 으로 0건을 낸다. `GATE` 에서는 결과도 0건이 된다. SR-1.4 `noContent` 와 경계가 다르다는 점을 SR-5 에 한 줄 적어 두면 나중에 0건 원인을 가를 수 있다.
- `search-architecture.md` §4 의 근거 줄 번호(`attractions-index.json:293·446·452…`)는 분석기 블록에 줄이 늘면 밀린다. 드리프트 테스트는 줄 번호를 떼고 보므로(`searchArchitecture.drift.test.ts:154`) 실패하지 않지만, SR-8 동기화 때 같이 고친다.

---

## security — SHIP

체크: STRIDE ○ · 인가 경계(공개 GET, 변화 없음) ○ · 민감 데이터(개인정보 없음, Q8 로 해석 내용을 원장에 남기지 않음) ○ · 입력 검증 ○ · 서비스 간 통신(변화 없음) ○ · 시크릿 해당 없음 · 감사 로깅 해당 없음 · 결제·주문 해당 없음 · Rate limiting △(참고)

- 주입: 조건어 값은 고정 표에서 나와 `term` 값으로만 들어간다(`AttractionSearchAdapter.kt:254-267` 와 같은 길). 사용자 문자열은 지금처럼 `multi_match` 질의 텍스트로만 간다. msm 은 상수다(tasks 4.3). 새 주입면은 없다.
- 참고 1 (XSS): `interpretedConditions[].phrase` 는 사용자 입력 일부가 그대로 돌아오는 값이다. SR-4.2 안내 줄 「‘{phrase}’을 …」은 React 텍스트 노드로 넣고, i18n 템플릿을 HTML 로 렌더하지 않는다. TG3.1 에 `<b>` 가 든 검색어가 글자 그대로 보이는 케이스를 하나 두면 확인된다.
- 참고 2 (DoS): 요청당 OpenSearch 호출이 최대 하나 는다(근거 요청). `noContent` 는 색인을 부르지 않아 오히려 줄어든다. 게이트웨이 속도 제한이 그대로 적용되므로 새 증폭 경로는 아니다. I-3 을 반영하면 `CONFINE` 에서는 늘지 않는다.

VERDICT: REVISE
