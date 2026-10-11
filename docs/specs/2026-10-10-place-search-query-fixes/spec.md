<!-- source: search/domain/src/main/kotlin/com/kgd/search/domain/query/model/QueryIntent.kt, search/app/src/main/kotlin/com/kgd/search/application/attraction/service/SearchAttractionService.kt, search/app/src/main/kotlin/com/kgd/search/application/unified/service/SearchUnifiedService.kt, search/app/src/main/kotlin/com/kgd/search/infrastructure/opensearch/AttractionSearchAdapter.kt, search/batch/src/main/resources/opensearch/attractions-index.json, portal-fe/src/pages/place/placeAttributes.ts, portal-fe/src/pages/place/placeView.ts, portal-fe/src/pages/place/placeHubState.ts, k8s/base/search-batch/eval/live-eval.py -->
# Specification: 관광지 검색 질의 결함 셋 — 없는 대상 0건 · 조건어 → 속성 필터 · 띄어 쓴 불용구

> 2026-10-11. 근거: 판정 세트 스펙 `docs/specs/2026-10-10-search-judgment-cases/spec.md` 현황 절의 라이브 탐침.
> 측정은 그 스펙(H4, 판정 세트 v3·의도별 리포트)이 만든 지표로 한다. 이 스펙은 검색 동작을 바꾼다.
> 2026-10-11 심판 판정(`context/review-verdict.md`)을 반영했다. 사용자 판단 12건은 권고 기본값으로 넣었고, 사용자 확인을 기다린다(`context/open-questions.yml` V1~V12).

## Goal
관광지 검색이 세 가지를 하도록 바꾼다.
1. 색인에 어휘 근거가 없는 질의에는 0건을 낸다. 벡터 이웃만으로 「찾은 척」하지 않는다.
2. 「주차 되는」「반려견과 함께」 같은 조건어를 허브 칩과 같은 속성 필터로 옮긴다. 그 해석을 화면에 보이고, 사용자가 풀 수 있게 한다.
3. 띄어쓰기·조사가 다른 불용구를 같은 것으로 지운다.

판정 세트 C(라이브 API) nDCG@10 은 언어별로 0.01 넘게 떨어지지 않는다. 통합 검색의 다른 타입 결과는 바뀌지 않는다.

## 원인 분석 (2026-10-11 실측, 운영 색인 `attractions_20261010213013`, 하이브리드 켜짐)

| 결함 | 원인 | 근거 |
|---|---|---|
| 「에펠탑」 854 · 「디즈니랜드」 367 · 「ㅁㄴㅇㄹ」 691 | **키워드 레그가 OR 다.** `multi_match` 에 `operator`·`minimum_should_match` 가 없어 토큰 하나만 맞아도 후보가 된다. 「에펠탑」은 `에펠`·`탑` 으로 갈리고, `탑` 하나로 충렬탑·충혼탑이 맞는다(OR 1,271 · AND 8). 「ㅁㄴㅇㄹ」은 `ㅁ`·`ㄴ`·`ㅇㄹ` 이다(OR 969 · AND 0) | `AttractionSearchAdapter.matchedQuery` 의 `m.multiMatch { mm.query(keyword).fields(KEYWORD_FIELDS) }`, 운영 `_analyze`·`_count` |
| 같은 질의 | **벡터 레그는 키워드 OR 일치 집합 안에서 k 를 채운다.** `buildRequest` 는 `matched = matchedQuery(query, query.keyword, …)` 를 만든다. 이 `matched` 를 키워드 레그와 `vectorLeg(embedding, matched)` 의 kNN `filter` 에 같이 쓴다. 그래서 검색어가 있으면 kNN filter 에도 `must multi_match`(OR)가 들어간다. 벡터가 OR 집합 밖 문서를 끌어오지는 않는다. 다만 OR 집합이 크면(「탑」 하나로 맞는 수백 건) 그 안에서 늘 k=100 을 채운다. 잔여가 없는 질의는 `keyword == null` 이라 벡터 단독이다. 이때 filter 에 검색어가 없어 total 이 정확히 100 이다(「해수욕장」 — 쿼리 언더스탠딩이 검색어를 다 옮긴 경우) | `buildRequest`·`vectorLeg`(`k(hybrid.k)`, `b.filter(filters)`), 벡터 단독 탐침 18질의 전부 total 100(kNN filter 에 검색어 없음) |
| 같은 질의 | **유사도 하한으로 가를 수 없다.** 정답 없는 질의의 top1 은 0.69~0.83 이다(「제주 스키장」 0.829 · 「루브르 박물관」 0.807). 정답 있는 질의의 top1 은 0.77~0.84 다(「데이트 코스」 0.770 · 「야시장」 0.787). 두 분포가 겹친다 | 운영 인코더(`harrier-oss-v1-270m`) + kNN 탐침, cosinesimil |
| 「아이랑 갈 만한 곳」 | ① 불용구 검사가 **한 어절**만 본다. 두 어절 창은 사전·의도어(`match`)에만 쓰고 불용구에는 쓰지 않는다. 그래서 「갈」「만한」이 각각 남아 잔여가 「아이랑 갈 만한」이 된다. ② **색인·검색 분석기에 품사 필터가 없어** 조사·어미가 토큰이 된다. 「아이와」는 `아이`·`와`, 「아이랑」은 `아이`·`랑` 이 된다. 그래서 `와` 가 「와글아이」에, `랑` 이 「아이랑 캠핑장」에 맞는다. 붙여 쓴 「아이와 갈만한 곳」(v2 질의)도 같은 이유로 상위가 아이아이 연남·아이와즈다 | `QueryIntent.analyze` `:279`(`one !in normalizedStopPhrases`), `attractions-index.json` 의 `nori_analyzer`·`nori_search` 에 `nori_part_of_speech` 없음 |
| 「주차 되는 해수욕장」 375 | 조건어 사전이 없다. 「해수욕장」만 분류로 옮긴다. 「주차 되는」은 잔여로 남아 BM25 에서 `주차`·`되`·`는` OR 로 채점된다. 주차 조건은 허브 칩·`parking=YES` 로만 걸린다 | `QueryIntent`(타입·실내외·분류·상업 넷뿐), `SearchAttractionService.toAttributeSelection` |

### 근사 측정 (판정 세트 v2 150 질의) — **지금 경로 값이 아니다. 재측정 필요**

쿼리 언더스탠딩·오타 교정 없이 원문을 넣은 근사다. 융합은 OpenSearch 파이프라인이 아니라 스크립트 안 RRF(1/(61+순위), 레그별 top-10)로 했다. 분류 가중치·클릭 계수도 없다. 아래 「근사가 잰 구성」 열은 근사 스크립트로 보이는 것(`scratchpad/exp.py`, 2026-10-11 09:51)을 읽은 것이다. 그 스크립트의 kNN filter 는 `lang`·`embeddingModel` 뿐이고 키워드 일치는 없다. 다만 표의 숫자와 그 스크립트 출력을 잇는 저장된 결과가 없어서, 이 표가 그 스크립트로 나온 값이라고 확정하지는 못한다. 어느 쪽이든 B 행은 지금 코드(kNN filter 에 OR `multi_match`)와 다르다. 실제 경로 값은 SR-7 이 잰다(`verifications/approx-measurement.md`).

| 구성 | 근사가 잰 구성 | 지금 코드와 관계 | ko nDCG@10 | en nDCG@10 |
|---|---|---|---|---|
| B 「지금」 | 키워드 OR + kNN(키워드 필터 없음) | **다르다** — 지금 코드는 kNN 도 OR 일치 집합 안에서 돈다. **재측정 필요** | .6746 | .6632 |
| 근거 게이트 | B + 키워드 AND `_count` 0 이면 빈 결과 | 기준선도 다르고 근거 기준도 다르다(SR-5 는 msm `2<75%`). **재측정 필요** | .6482 | .6495 |
| 키워드 msm `2<75%` + 벡터 그대로 | msm 키워드 + kNN(키워드 필터 없음) | 지금 코드로는 만들 수 없는 구성이다. msm 을 `matchedQuery` 에 넣으면 두 레그가 함께 좁아진다. 참고값 | .6600 | .6957 |
| 키워드 msm + 벡터를 msm 일치 문서로 한정 | msm 키워드 + kNN filter 에 msm 일치 | SR-6.1 `CONFINE` 이 만드는 모양과 같다. 비교 기준(B)이 지금 경로가 아니어서 차이는 **재측정 필요** | .6593 | .6664 |

원문 AND 0건 질의 9개는 실제 경로에서 대부분 따로 처리된다.
- 「비 오는 날 갈만한 곳」은 쿼리 언더스탠딩이 실내외 필터로 옮긴다.
- 「경복굼」「불국싸」「해수욕쟝」은 오타 교정이 먼저 고친다.
- 「winter trip」은 SR-1 영문 불용어를 지운 뒤 잔여 「winter」가 msm 111건이다.
- 「scenic drive near seoul」은 msm 7건이라 게이트를 지난다.

그래서 근거 게이트 손실 대부분은 실제 경로에서 사라질 것으로 본다. 하지만 근사인 데다 B 기준선이 지금 경로가 아니므로 Q5 판단(단계별 스위치)의 수치 근거도 재측정 대상이다.

## User Stories
- 관광지를 찾는 사람으로서, 「에펠탑」처럼 국내에 없는 것을 찾으면 「없다」를 바로 알고 싶다. 글자만 겹치는 충렬탑 수백 건은 필요 없다.
- 같은 사람으로서, 「주차 되는 해수욕장」이라고 치면 주차 칩을 누른 것과 같은 결과를 보고 싶다. 내 말을 그렇게 읽었다는 표시도 보고, 원하지 않으면 풀고 싶다.
- 같은 사람으로서, 「아이랑 갈 만한 곳」과 「아이와 갈만한 곳」이 띄어쓰기·조사 때문에 다른 결과를 내지 않기를 바란다.

## Specific Requirements

### SR-1 불용구·의도어를 어절 1~3개 창으로 맞춘다
1. `QueryIntent.analyze` 의 어절 창을 최대 3어절로 늘린다. **창마다 정규화(공백 제거)한 이어붙임을 긴 것부터** 의도어(`match`)와 불용구 둘 다에 맞춘다. 맞은 창의 어절은 잔여에서 빠진다. 예: 「갈 만한」→`갈만한`, 「가볼 만한 곳」→`가볼만한곳`(유형 12), 「갈 수 있는」→`갈수있는`.
2. `STOP_PHRASES` 에 더한다.
   - ko: `갈수있는`·`볼수있는`·`가볼수있는`·`가기좋은곳`
   - en: `trip`·`trips`·`travel`·`places`·`place`·`spots`·`spot`·`visit`·`to visit`·`things to do`

   뜻이 있는 말은 넣지 않는다는 기존 규칙(`:126-128`)을 따른다. 그래서 `tour`·`course`·`코스`·`여행지` 는 넣지 않는다(`여행지` 는 이미 유형 의도다).
3. **새 영문 불용어와 조건어 추출(SR-3)은 관광지 경로에서만 쓴다.** `SearchUnifiedService.kt:29` 가 같은 `analyze` 를 부르고, `:83` 이 `understood.residual` 을 다른 타입 검색에 넘긴다. 잔여가 null 이면 `UnifiedSearchAdapter` 가 `matchAll` + 인기순으로 바뀐다. 그래서 통합 검색에서 「travel」「카드 결제」가 지워지면 다른 타입 결과가 통째로 바뀐다. `analyze` 는 언어와 관광지 경로 표시를 인자로 받는다(`analyze(rawQuery, lexicon, searchTypes, lang, attractionOnly)` — 이름은 구현이 정한다). 통합 검색은 `attractionOnly=false` 로 부른다. 어절 창(SR-1.1)과 ko 불용구 추가는 두 경로에 공통이다.
4. 조사는 쿼리 언더스탠딩이 지우지 않는다(어절 단위 원칙 유지, `:230-232`). 조사 토큰은 SR-2 가 검색 분석기에서 뺀다. 조건어 머리말의 조사만 SR-3.2 가 떼고 비교한다.
5. 완성형 음절·라틴 글자·숫자가 하나도 없는 질의(자모·기호만, 예 「ㅁㄴㅇㄹ」)는 `Understood.noContent = true` 다. 서비스는 색인을 부르지 않고 0건을 낸다(응답 `zeroReason=NO_CONTENT`, SR-4.5).
6. 단위 테스트는 기대 잔여 문자열 전체로 단언한다.
   - 「아이랑 갈 만한 곳」→`아이랑`
   - 「아이와 갈만한 곳」→`아이와`
   - 「부모님과 가기 좋은 곳」→`부모님과`
   - 「가볼 만한 곳」→잔여 null·`contentTypeId=12`
   - 「winter trip」(en, 관광지 경로)→`winter`
   - 「비 오는 날 갈만한 곳」→잔여 null·`setting=indoor`(기존 유지)
   - 「야경 명소」의 `야경` 유지
   - 「ㅁㄴㅇㄹ」 `noContent`
   - 「ㄱ경복궁」은 `noContent` 아님
   - 통합 경로(`attractionOnly=false`)에서는 「travel」·「place」 잔여가 그대로다

### SR-2 검색 분석기에서 조사·어미 토큰을 뺀다
1. `attractions-index.json` 의 `nori_search` 에 `nori_part_of_speech` 필터를 더한다. **순서는 `[품사 필터, tourism_synonyms]` 다.** 지금 `nori_search.filter` 는 `["tourism_synonyms"]`(synonym_graph) 하나이고, 품사 필터는 그 앞에 둔다.
   - 태그는 **세분 태그만** 쓴다: `EP·EF·EC·ETN·ETM·JKS·JKC·JKG·JKO·JKB·JKV·JKQ·JX·JC`. 묶음 태그 `E`·`J` 는 Lucene 10 이 400 으로 거부한다(메모 nori-lucene10-stoptags).
   - 색인 분석기 `nori_analyzer` 는 바꾸지 않는다. 질의 쪽에서 빠진 토큰은 색인에 남아도 맞을 일이 없다. 색인 쪽까지 바꾸면 비교할 변수가 둘이 된다.
2. 반영은 다음 정기 재색인(새 색인 생성)부터다. 운영 `_analyze`(필터 인라인) 실측은 이렇다.
   - 「아이랑 갈 만한 곳」: `아이·랑·가·ᆯ·만·하·ᆫ·곳` → `아이·가·만·하·곳`
   - 「와우정사」「의성 마늘」「이랑 카페」「하와이안 워터파크」: 변화 없음
   - 「과천과학관」: `과천·과·학관` → `과천·학관`. 색인 쪽 `과천`·`학관` 으로 여전히 맞는다
   - 「서울 궁궐」: 근사 손실 상위 질의라 착수 전 msm `_count` 를 잰다(필터 전후). 결과를 `verifications/analyze.md` 에 적는다
3. 계약 테스트는 search:batch 의 기존 `AttractionsIndexMappingTest` 에 더한다. 색인 JSON 을 읽어 세 가지를 확인한다.
   - `nori_search.filter` 에 품사 필터가 있고 **`tourism_synonyms` 앞**에 있다
   - stoptags 에 `E`·`J` 단독 값이 없다
   - stoptags 가 위 14개와 같다

### SR-3 조건어를 허브 칩과 같은 속성 선택으로 옮긴다
1. `QueryIntent`(`:search:domain`)에 조건어 표를 둔다. 결과는 `Understood.conditions: List<Condition>` 이다.
   - 모양은 `Condition(kind, values, phrase)` 다. `kind` 는 속성 축 enum(PARKING·ADMISSION·PET·STROLLER_RENTAL·BARRIER_FREE·CREDIT_CARD), `values` 는 도메인 값 집합, `phrase` 는 원문 어절이다.
   - **도메인은 API 문자열을 모른다.** API 파라미터 이름·값 문자열(`parking=YES` 등)은 presentation 의 매핑 표 한 곳이 만든다. 컨트롤러는 `@RequestParam(name = …)` 에 그 상수를 쓴다. 지금 `AttractionSearchController.kt:61-67` 의 `parking: String?` 등은 Kotlin 인자 이름일 뿐이고 상수가 없다.

| 축 → API 매핑 | 머리말 (정규화 일치) | 꼬리말 — 머리말 다음 어절, 붙여 쓴 것 포함 | 언어 |
|---|---|---|---|
| PARKING → `parking=YES` | 주차 · 주차장 / parking | 되는·돼요·가능·가능한·있는·편한·무료 / available · lot · free | ko · en |
| ADMISSION → `admission=FREE` | 무료 · 무료입장 · 입장무료 · 공짜 / free admission · free entry · free entrance | 꼬리 없이 성립. 단 SR-3.2 ④⑤ 제한 | ko · en |
| PET → `pet=ALLOWED,PARTIAL` | 반려동물 · 반려견 · 애견 · 강아지 | 동반·함께·같이·가능·입장·출입 | ko |
| STROLLER_RENTAL → `strollerRental=YES` | 유모차 | 대여·빌려주는·렌탈 | ko |
| BARRIER_FREE → `barrierFree=WHEELCHAIR` | 휠체어 | 가능·대여·접근·이용·되는 | ko |
| CREDIT_CARD → `creditCard=YES` | 카드 · 신용카드 | 결제·되는·가능 | ko |

   ko 전용 행(PET·BARRIER_FREE)의 영문 머리말·꼬리말은 지웠다. 언어 열 규칙(③)과 맞추려는 것이다(V12).

2. 규칙
   1. **머리말과 꼬리말이 함께 있을 때만** 옮긴다(ADMISSION 행은 예외). 「반려견 놀이터」「주차장식당」은 조건이 아니다.
   2. 머리말 어절 끝의 조사는 떼고 비교한다: `가·이·은·는·과·와·랑·이랑·하고·로·으로·도`. 예: 「주차가 되는」「반려견과 함께」「무료로」.
   3. **부정어가 붙으면 해석하지 않는다.** 꼬리말 다음 어절이나 같은 창에 부정어(`안·못·불가·불가능·금지` / `no·not`)가 있는 경우다. 그 어절들은 검색어로 남는다. 「반려동물 동반 불가」「카드 결제 안 되는 곳」이 이 경우다. 부정 필터를 만들지 않는 기존 원칙과 같다(Out of Scope).
   4. **처리 순서: PARKING 이 먼저 어절을 가져간다.** 그래서 「주차 무료」의 `무료` 는 PARKING 꼬리말로 쓰인다(결과는 주차 가능, 안내 줄에 원문 그대로 보인다). ADMISSION 은 **앞 또는 뒤 어절이 PARKING 머리말이면** 성립하지 않는다. 「무료 주차장」은 ADMISSION 이 아니고, PARKING 꼬리말도 없어 조건이 없다(V6).
   5. **ADMISSION 의 `무료` 단독**은 두 경우에만 성립한다. 다음 어절이 없을 때, 또는 다음 어절을 쿼리 언더스탠딩이 가져갈 때(유형·분류·불용구)다. 「무료 셔틀」「무료 체험」「무료 와이파이」는 해석하지 않는다(V5). `무료입장`·`입장무료`·`공짜`·영문 머리말은 이 제한이 없다.
   6. 옮긴 어절(머리말·꼬리말)은 잔여에서 빠진다.
   7. **언어 열에 없는 언어는 옮기지 않는다.** 그 언어 원천에 값이 없어 필터가 늘 0건을 만든다. 영문 반려동물·유모차·신용카드·무장애가 이 경우이고, 허브 칩 `only: 'ko'` 와 근거가 같다. 옮기지 않은 말은 검색어로 남는다.
   8. `openToday`·엘리베이터·장애인 화장실·웰니스는 옮기지 않는다(Out of Scope).
   9. **요청 분류가 행사 하나뿐이면 조건어를 옮기지 않는다.** 화면이 「행사」를 고르면 칩·속성 조건·건수 요청을 모두 뺀다(glossary:75). 행사에서는 속성 조건이 무의미하다.
3. `SearchAttractionService` 는 조건을 요청의 속성 선택과 합친다.
   - **같은 축에 명시 선택(칩)이 있으면 명시 선택이 이긴다.** 그 축의 해석은 버리고, 해석에 쓴 어절은 잔여에서 뺀다. 그래서 사용자가 반려동물 칩을 ALLOWED 하나만 켠 채 「반려견 동반」을 치면 `pet=ALLOWED` 다(V7).
   - 다른 축끼리는 합집합이다. 패싯 건수(`countAttributeFacets`)도 합친 선택으로 센다.
   - 한정 판정은 `hasFilter` 를 바꾸지 않는다. 별도 이름 `narrowsByIntent`(facets 또는 conditions 가 있음)로 한다(SR-6.1). 지금 `hasFilter` 는 `facets.isNotEmpty()` 이고 `intentCounter` 가 이 값을 센다.
4. 해제 파라미터는 둘이다(V1).
   - `keepConditionWords=true` 면 조건어를 하나도 옮기지 않는다(문장 그대로 검색).
   - `skipCondition=<param>`(여럿 가능) 이면 그 param 의 해석만 버린다. 그 어절은 검색어로 남는다.
   - 통합 검색은 SR-1.3 의 `attractionOnly=false` 로 조건어 추출 자체를 하지 않는다.
   - 스위치 `search.attraction.condition-words.enabled`(기본 true, env `SEARCH_ATTRACTION_CONDITION_WORDS_ENABLED`)가 false 면 서비스는 조건을 쓰지 않는다. 단계 1 되돌림용이다(SR-7.3, V2).
5. 단위 테스트
   - 「주차 되는 해수욕장」→잔여 null·분류 필터·PARKING(phrase 「주차 되는」)
   - 「주차가 되는 해수욕장」→위와 같음(조사 `가`)
   - 「주차 되는 반려견 동반 해수욕장」→PARKING·PET·잔여 null
   - 「반려견과 함께 갈 수 있는 곳」→PET(ALLOWED,PARTIAL)·잔여 null
   - 「무료로 볼 수 있는 곳」→ADMISSION·잔여 null
   - 「무료 박물관」→ADMISSION·분류
   - 「무료 셔틀」→조건 없음·잔여 그대로
   - 「주차 무료 해수욕장」→PARKING 만
   - 「무료 주차장」→조건 없음·잔여 그대로
   - 「반려견 놀이터」→조건 없음·잔여 그대로
   - 「반려동물 동반 불가」「카드 결제 안 되는 곳」→조건 없음·부정어 포함 잔여 그대로
   - 「pet friendly」(en)→조건 없음·잔여 `pet friendly`
   - 「free admission museum」(en)→ADMISSION
   - `keepConditionWords` 면 조건 없음
   - `skipCondition=parking` 이면 PARKING 만 빠지고 다른 조건은 남음
   - 명시 칩 `pet=ALLOWED` + 「반려견 동반」→`pet=ALLOWED`·어절은 잔여에서 빠짐
   - 행사 분류 + 「주차 되는 축제」→조건 없음
   - 스위치 off 면 조건 없음
   - `attractionOnly=false` 에서 「카드 결제 할인」→조건 없음·잔여 그대로

### SR-4 해석했다는 표시와 해제
1. 응답에 두 필드를 둔다.
   - `interpretedConditions: [{param, value, phrase}]`(없으면 빈 배열). param·value 는 presentation 매핑 표가 만든다. `keepConditionWords=true` 면 빈 배열이다.
   - `zeroReason: NO_EVIDENCE | NO_CONTENT | null`(V8). `NO_EVIDENCE` 는 SR-5 게이트·SR-6 한정이 0건을 만든 경우, `NO_CONTENT` 는 SR-1.5 다. 필터 조건 때문인 0건과 결과가 있는 경우는 null 이다.
2. portal-fe 허브 표시
   - **해석 조건은 응답에서 파생한 표시 상태다. `attributes` 에 넣지 않는다.** `attributes` 는 `query` 메모 의존성(`PlacePage.tsx:498`)이라, 거기 넣으면 요청이 한 번 더 나간다.
   - 칩 줄에서는 해석된 칩을 켜진 칩으로 그린다. PET(ALLOWED,PARTIAL)는 「반려동물 동반」「반려동물 일부 구역」 두 칩을 다 켠다(`placeAttributes.ts:57-58`).
   - 결과 위 안내 줄(ko)은 이렇다: 「‘주차 되는’을 주차 가능 조건으로 읽었습니다. 정보가 있는 곳만 거릅니다」. 조건이 둘 이상이면 「‘주차 되는’·‘반려견 동반’을 주차 가능·반려동물 동반 조건으로 읽었습니다…」처럼 원문과 칩 이름을 각각 `·` 로 잇는다. PET 은 칩 이름 「반려동물 동반」 하나로 적는다.
   - en 틀: "Read ‘parking available’ as Parking. Filters only places that list this information". en 은 PARKING·ADMISSION 만 생긴다.
   - 칩 이름은 `ATTRIBUTE_CHIPS` 그대로 쓴다. 뒷문장은 `ATTRIBUTE_CAPTION[lang]` 을 재사용한다(해석 필터도 UNKNOWN 을 뺀다는 고지, `placeAttributes.ts:77`).
   - 안내 줄의 원문(phrase)은 사용자 입력이 되돌아오는 값이다. React 텍스트 노드로만 넣는다(`dangerouslySetInnerHTML` 금지).
   - 링크 문구는 **「조건으로 읽지 않고 검색」** 이다. 기존 오타 교정 링크(`exact`, 「원래 검색어로 검색」)와 이름이 겹치지 않게 한다. 두 안내가 함께 뜨면 교정 안내 줄을 먼저, 조건 안내 줄을 그 아래에 둔다. 각 링크는 자기 줄 끝에 둔다.
   - param·value → 칩 id 는 `placeAttributes.ts` 의 기존 칩 ↔ 질의 변환을 거꾸로 쓴다.
3. 해제(V1)
   - 해석된 칩을 끄면 다음 질의에 `skipCondition=<그 param>` 을 싣는다. 나머지 해석은 그대로 해석으로 남는다(명시 칩으로 옮기지 않는다).
   - 「조건으로 읽지 않고 검색」은 `keepConditionWords=true` 를 싣는다.
   - 상태는 `exactFor` 와 같은 방식으로 `PlaceHubState`(`placeHubState.ts`)에 둔다: `keepWordsFor: string | null`, `skipConditions: { for: string, params: string[] } | null`. 검색어가 바뀌면 둘 다 저절로 풀린다. 저장·검증(`placeHubState.ts:17,69,89` 의 `exactFor` 자리)에도 같이 넣는다.
   - 해석 해제가 GATE 에서 0건을 만들지 않는 것은 SR-5.1 의 근거 잔여 규칙이 막는다.
4. 계측: 칩 해제·「조건으로 읽지 않고 검색」은 `trigger='relax'`(place-text-and-states SR-5.1 값 재사용)다. `changed` 는 `['keepConditionWords','attributes','page']` 또는 `['skipCondition','attributes','page']` 다.
5. 0건 화면
   - `zeroReason` 이 `NO_EVIDENCE`·`NO_CONTENT` 면 「고른 조건을 모두 만족하는 관광지가 없습니다…」(`emptyReason`)를 쓰지 않는다. 대신 ko·en 「찾는 대상이 색인에 없습니다」류 문구를 쓴다(문구는 TG3 에서 정해 FE 사본 표에 둔다).
   - `relaxConditions` 의 검색어 해제 버튼은 「검색어 빼고 보기」로 이름을 바꾼다(지금은 첫 줄 `if (s.keyword) out.push({ kind: 'keyword', … })`).
   - 해석된 조건도 속성 조건으로 나열한다.

### SR-5 결과 0건이 정답 — 어휘 근거 게이트
1. **규칙: 근거 잔여가 있으면, 같은 필터 안에서 근거 잔여가 `minimum_should_match: "2<75%"` 로 맞는 문서가 1건 이상이어야 결과를 낸다.** 같은 필터는 언어·지역·분류·쿼리 언더스탠딩 필터·속성·행사 범위·반경이다. 0건이면 본 질의를 내지 않고 0건이다(`zeroReason=NO_EVIDENCE`). 벡터 이웃은 근거가 아니다(원인 분석 둘째·셋째 행).
   - **근거 잔여 = 잔여에서 조건어 표의 머리말·꼬리말 어절을 늘 뺀 것이다(V1 (가)).** 해석했든 안 했든 뺀다. `keepConditionWords`·`skipCondition`·부정어로 해석하지 않은 경우도 뺀다. 그래서 해석을 풀어도 「주차 되는」 같은 조건어가 근거 요구를 만들지 않는다. 채점용 잔여는 바꾸지 않는다.
2. 근거 잔여가 없으면 게이트가 없다. 쿼리 언더스탠딩이 전부 필터로 옮긴 질의가 그렇고, 필터가 곧 답이다.
3. `2<75%` 의 뜻: 토큰 2개 이하는 전부, 3개 이상은 75%. 실측은 이렇다.
   - 「ㅁㄴㅇㄹ」 8건(3토큰 중 2). SR-1.5 가 먼저 막는다
   - 「scenic drive near seoul」 7 · 「부모님과」 1,678
   - 「eiffel tower」「disneyland」「tokyo aquarium」「qwxzv」 0
   - 「에펠탑」 8 · 「디즈니랜드」 2(개요에 글자 그대로 나오는 문서)
   - 「도쿄 수족관」(ko)은 아직 재지 않았다. 착수 전 `_count` 로 잰다(SR-7.1)
   - 품사 필터(SR-2)로 잔여 토큰이 전부 사라지면 multi_match 는 0건이다. 이 경우도 `NO_EVIDENCE` 이고, SR-1.5 `noContent` 와는 다른 경로다
4. 요청 순서
   - 근거 계수는 `_count` 가 아니라 `size: 0`·`terminate_after: 1`·`track_total_hits: 1` 검색 한 번이다. **근거 요청 → (근거 1 이상이면) 건수 요청 ∥ 본 질의** 순으로 낸다.
   - 근거가 0이면 건수 요청도 내지 않는다. 지금 `search()` 는 건수 요청을 먼저 띄우는데, 게이트가 걸리는 경로에서는 근거 뒤에 출발한다. 그래야 0건 화면 칩 건수와 목록이 어긋나지 않는다.
   - **근거 요청이 실패·타임아웃하면 예외로 올린다(V9).** 0건으로 삼키지 않는다. 화면의 `isError` 분기(「실패는 조건 탓이 아니다」)를 탄다. 건수 요청 실패만 지금처럼 경고 후 건수 없이 간다.
   - p99 증가분을 ADR-0025 측정 표준으로 배포 전후 기록한다.
5. 스위치 `search.attraction.answer-evidence.mode`(`OFF`·`GATE`·`CONFINE`, 코드 기본 `OFF`, env `SEARCH_ATTRACTION_ANSWER_EVIDENCE_MODE`). 클릭 계수와 같은 방식으로, 측정(SR-7)이 통과한 단계까지만 켠다.
6. **`exact` 경로(V10).** `exact=true` 는 교정을 건너뛴다(`SearchAttractionService` `original?.takeUnless { query.exact }`). 그래서 오타 원문이 그대로 근거 검사를 받는다. 게이트는 그대로 건다. 0건 화면에는 교정어로 다시 검색하는 링크를 둔다. 교정어는 화면이 직전 교정 안내에서 받은 값을 쓴다. 상태에 없으면 응답에 교정 후보를 싣는다 — 구현 때 확인한다.

### SR-6 `CONFINE` — 쿼리 언더스탠딩 필터가 없으면 결과 집합을 어휘 근거로 한정
1. `CONFINE` 이고 `narrowsByIntent` 가 거짓이면(쿼리 언더스탠딩이 분류·유형·실내외·조건을 하나도 만들지 않음) 다음과 같이 한다.
   - **`matchedQuery` 의 multi_match 에 msm `2<75%` 를 건다.** `matched` 가 키워드 레그와 kNN filter 에 같이 들어가므로 두 레그가 함께 좁아진다. 벡터는 그 집합 안의 순서만 바꾼다. 「에펠탑」은 글자 그대로 언급한 8건만 남고 충렬탑·에이플이 빠진다.
   - 건수 요청(`countFacets`)의 키워드에도 같은 msm 을 건다. 하이브리드에서 지금 건수는 검색어를 빼고 센다(`keyword = query.keyword.takeIf { query.embedding == null }`). 한정 분기에서 그대로 두면 칩 건수가 목록보다 크다.
   - **근거 요청을 내지 않는다.** 본 질의가 이미 msm 집합이므로 0건이면 그 자체가 0건이다(`zeroReason=NO_EVIDENCE`).
   - `keepConditionWords=true` 면 조건이 비어 `narrowsByIntent` 가 거짓이 될 수 있다. 그때도 CONFINE 이 걸린다.
2. `narrowsByIntent` 가 참이면 지금과 같다. 벡터가 필터 안에서 후보를 더하고, 게이트는 SR-5 대로다. 「야시장」「실내 놀거리」처럼 벡터가 답을 찾는 질의를 깎지 않으려는 것이다. 근사 측정의 손실 상위는 이 분기와 오타 교정이 다루는 질의다: 「서울 궁궐」 .73→.09 · 「실내 놀거리」 .87→.44 · 「hanbok rental」 .80→.32. 근사 값이라 재측정 필요.
3. `GATE` 는 SR-5 만, `CONFINE` 은 SR-5 + SR-6 이다.

### SR-7 판정 세트로 전후를 잰다 — 기준선 게이트를 깨지 않는다
1. **측정 순서와 세트(V3)**
   - 순서: 판정 세트 v3 머지 → v3 첫 실행과 `EVAL_BASELINE_KO/EN` 갱신(판정 스펙 `:100`) → 단계 1. 단계 2·3 은 v3 를 선행 조건으로 삼는다.
   - 세트는 단계 3 까지 고정이다. 세트가 바뀌면 단계 비교가 눈금 차이와 섞인다.
   - NO_ANSWER 는 C 평균에서 빠진다(판정 스펙 SR-7.2). 그래서 탐침을 따로 잰다.
   - 탐침 × 단계 기대표:

| 탐침 | 단계 1 | 단계 2 `GATE` | 단계 3 `CONFINE` | 성격 |
|---|---|---|---|---|
| 「에펠탑」「디즈니랜드」 | 기록만 | 기록만(근거 있음 → 결과 남음) | 남은 문서 **전부** 개요에 글자 그대로 언급하는지 사람이 확인. 건수 따로 보고(V4·Q1) | 판정 |
| 「ㅁㄴㅇㄹ」 | 0 (`NO_CONTENT`) | 0 | 0 | 판정 |
| 「eiffel tower」「qwxzv」 | 기록만 | 0 | 0 | 판정 |
| 「도쿄 수족관」 | 착수 전 운영 msm `_count` 를 `verifications/` 에 고정. 0이면 단계 2·3 기대 0, 아니면 「에펠탑」 줄과 같은 사람 확인 | ← | ← | 판정 |
| 「주차 되는 해수욕장」 | `interpretedConditions` 에 parking, 전 결과 `attrParking=YES` | 같음 | 같음 | 배선 확인 |
| 「반려견과 함께 갈 수 있는 곳」 | pet, 전 결과 `petPolicy ∈ {ALLOWED, PARTIAL}` | 같음 | 같음 | 배선 확인 |
| 「아이랑 갈 만한 곳」「아이와 갈만한 곳」 | 재색인 뒤 top-5 에 제목이 「아이」로 시작하는 상호 없음 | 같음 | 같음 | 판정 |
| 「해수욕장」「경복궁」 | top-5 중 4개 이상이 기준 id. 기준 id 는 착수 전 운영 값으로 `verifications/` 에 고정 | 같음 | 같음 | 판정 |

   「배선 확인」 두 줄은 필터가 걸리면 당연히 참이 되는 검사다. 품질 판정이 아니라 조건이 요청까지 실렸는지 확인하는 용도다.
2. **단계와 각 단계의 판정 지표**(전부 C, NO_ANSWER 를 뺀 언어별 평균)
   - 단계 1: SR-1·SR-3·SR-4 배포 + SR-2 재색인 뒤 첫 정기 실행. 비교 대상은 직전 정기 실행이다. 같은 실행에서 `keepConditionWords=true` 대조군을 짝으로 잰다(`live-eval.py --condition-pair`, `--click-boost-pair` 선례). 이렇게 조건어 해석 효과를 불용구·품사 필터 효과와 가른다.
   - 단계 2 는 `mode=GATE`, 단계 3 은 `mode=CONFINE` 이다. 각 단계는 env 전환 뒤 수동 평가 Job 한 번(사용자 확인 뒤)을 돌려 직전 단계 값과 짝지어 비교한다.
3. **채택 조건(단계마다).** 하나라도 어기면 그 단계를 켜지 않는다.
   - 먼저 **잡음 하한**을 잰다: 무변경 상태 이틀 정기 실행의 언어별 C 차이(V11). 하락 문턱 0.01 이 잡음 하한보다 작으면 결과에 그 사실을 적고, 하한 이내의 하락은 판정을 보류한다.
   - 언어별 C 평균 하락 ≤ 0.01
   - 0.05 넘게 나빠진 질의 ≤ 3(언어별)
   - 판정 없는 top-10 비율 20% 이하. 단 **단계 2·3 은 비교 전에** 그 구성의 top-20 을 풀에 합치고 판정 없는 문서를 채점한 뒤 잰다(판정 스펙 SR-6.3, `:112`)
   - v3 면 빈 정답 통과율이 오르거나 같다
   - **p99 가 ADR-0025 Tier 1 예산을 넘지 않는다**
   - 되돌림(V2)
     - 단계 2·3: env `SEARCH_ATTRACTION_ANSWER_EVIDENCE_MODE` 를 이전 값으로 — 코드 배포 없이
     - 단계 1 의 SR-3: env `SEARCH_ATTRACTION_CONDITION_WORDS_ENABLED=false` 로 — 코드 배포 없이
     - 단계 1 의 SR-1(불용구 창·불용어): 되돌림 배포
     - 단계 1 의 SR-2: 보관 색인으로 별칭을 옮기고, 색인 JSON 을 되돌린다
4. 매일 게이트(`EVAL_BASELINE_KO/EN` − 0.03)는 그대로 둔다. 기준선은 개선으로 올리지 않는다. 올리는 것은 판정 세트 교체 때뿐이다(S3-6b SR-5.4).
5. **통제 변수.** 단계 1~3 동안 클릭 계수(`search.attraction.click-boost.enabled`, 지금 기본 false·env 없음)·하이브리드·융합(`fusion`) 스위치를 바꾸지 않는다. 결과 JSON 에 측정 시점의 색인 이름을 적는다. `ids_live` 는 keyword·lang·size·sort 만 보내므로, 통합 검색 회귀는 판정 세트로 잡히지 않는다. 단위 테스트(SR-1.6·SR-3.5)로만 잡힌다.
6. 결과는 `scripts/search-eval/results/<날짜>-query-fixes.json` 과 이 스펙의 `verifications/` 표에 남긴다.
   - 단계 · ko/en C(짝 대조 포함) · 잡음 하한 · 나빠진 질의 목록 · 탐침 12 결과 · p99 · 색인 이름
   - 원인 분석 근사 표의 재측정(지금 경로 B 대비 GATE·CONFINE)

### SR-8 문서
- ADR-0090 개정 단락에 세 가지를 넣는다. 「벡터 이웃은 답이 있다는 근거가 아니다 — 잔여 검색어가 있으면 어휘 근거(msm)가 결과 유무를 정한다」, 조건어 → 속성 선택, 검색 분석기 품사 필터. 근거는 이 스펙이다.
- `search/glossary.md`·`portal-fe/src/content/search-architecture.md`(§5 동기화 규칙)
  - 새 행은 glossary 표기 「쿼리 언더스탠딩」으로 쓴다.
  - 행: 「어휘 근거 게이트」「조건어 해석(`interpretedConditions`·`keepConditionWords`·`skipCondition`)」「머리말·꼬리말」「한정(CONFINE)」「내용 없는 입력(`noContent`)」
  - 「근거」 행 비고: 판정 세트의 `evidence`(판정 출처)와 다른 말이다.
  - 동기화 때 search-architecture §4 의 줄 번호도 갱신한다.
- `QueryIntent` 머리 주석의 의도 갈래에 「조건 의도 → 속성 선택(관광지 경로만)」을 더한다.

## Existing Code to Leverage
- `QueryIntent.analyze`·`STOP_PHRASES`·`normalize`·`RAINY_DAY`(세 어절 선처리 선례)·`hasFilter` — `search/domain/.../query/model/QueryIntent.kt`. 테스트 `QueryIntentTest.kt`.
- `SearchAttractionService.toAttributeSelection`·`resolveEmbedding`·`exact` 처리(`:79-135`). `AttributeSelection`·`PET_CHOICES`(`AttributeFacets.kt`), `BarrierFreeInfo.FILTER_CODES`.
- `SearchUnifiedService`(`:29` analyze, `:83` 잔여 전달)·`SearchUnifiedServiceTest`.
- `AttractionSearchAdapter.search`(건수 병렬 선례)·`matchedQuery`·`buildRequest`·`vectorLeg`(kNN 안 필터 — 한정은 `matched` 에 거는 것으로 두 레그에 함께 걸린다)·`countFacets`. 요청 스냅숏 `AttractionSearchRequestSnapshots.kt`(`emptyResponse()` 는 total 0 고정)·`AttractionSearchAdapterHybridTest.kt`.
- `AttractionClickBoostProperties`(스위치 + 짝 측정 후 켜는 선례), `AttractionHybridProperties`.
- FE: `placeAttributes.ts`(`ATTRIBUTE_CHIPS`·`ATTRIBUTE_CAPTION`·`only`), `placeView.ts` `relaxConditions`, `placeHubState.ts`(`exactFor`), `PlacePage.tsx` `query` 메모, `PlacePage.relax.test.tsx`.
- 평가: `k8s/base/search-batch/eval/live-eval.py`(C·게이트·`--click-boost-pair`), S3-6b 의도별 리포트.

## Out of Scope
- 초성 검색(「ㄱㅂㄱ」→경복궁). 지금도 안 되며, SR-1.5 는 자모만인 입력을 0건으로 확정한다(Q3).
- 벡터 유사도 하한(원인 분석 셋째 행 — 분포가 겹친다), 리랭커, 융합 방식(RRF) 변경.
- `openToday`(「오늘 여는」)·웰니스·엘리베이터·장애인 화장실 조건어.
- 부정 조건 필터(「주차 안 되는」). 부정 필터 길을 열지 않는 기존 원칙이다. SR-3.2 ③ 은 해석하지 않는 것까지만 한다.
- 의도어만인 질의의 total 이 k(100)에 묶이는 것(「해수욕장」 total 100). 별도 결함 후보로 보고만 한다.
- 통합 검색 화면의 해석 표시(SR-1.3 으로 해석 자체를 하지 않는다).
- 「반려견과」→`반려·견과` 같은 nori 분절 오류. 사용자 사전 보강 후보로 보고만 한다.
- 2쪽 이후(page>0) 근거 요청 생략. p99 측정 뒤 판단한다(조기 최적화 금지).

## Open Questions
`context/open-questions.yml` — 권고 기본값으로 진행한다. V1~V12(심판 판정의 사용자 판단 목록)는 `answered-default` 로 사용자 확인을 기다린다.
