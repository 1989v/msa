# Task Breakdown: 관광지 검색 질의 결함 셋 — 없는 대상 0건 · 조건어 → 속성 필터 · 띄어 쓴 불용구

Total Task Groups: 6. 정본은 `spec.md`, 열린 질문은 `context/open-questions.yml`(권고 기본값으로 진행). 심판 판정 `context/review-verdict.md` 반영본이다.
작업 위치: 워크트리 `scratchpad/wt-impl`. 운영은 `ssh msa-oci` 로 읽기만 한다(OpenSearch `_search`·`_count`·`_analyze`). env 전환·수동 평가 Job 은 사용자 확인 뒤.

착수 전 메모
- 선행 순서(SR-7.1, V3): 판정 세트 v3 머지 → v3 첫 실행·기준선 갱신 → 단계 1. 단계 2·3 은 v3 가 없으면 시작하지 않는다. 세트는 단계 3 까지 고정한다. 결과 첫 줄에 세트 이름을 적는다.
- 측정 전후는 같은 색인 벌에서 비교한다. SR-2 는 재색인이 있어야 반영되므로, 단계 1 비교는 재색인 뒤 실행끼리만 한다.
- 원인 분석의 근사 측정 표는 쿼리 언더스탠딩 없이 원문으로 잰 값이다. 게다가 B 행의 kNN 이 키워드 필터 없이 돌았다(지금 경로와 다름). 채택 판정에 쓰지 않고 TG6.0 에서 다시 잰다.

---

### Task Group 1: 불용구 창·영문 불용어·내용 없는 입력 (SR-1)
**Dependencies:** None · **모듈:** `:search:domain`
- [ ] 1.1 테스트 먼저: `QueryIntentTest` 에 SR-1.6 케이스 전부를 넣는다(기대 잔여 문자열 전체로 단언). 통합 경로(`attractionOnly=false`)의 「travel」·「place」 잔여 유지도 넣는다. 지금 코드로 「아이랑 갈 만한 곳」·「가볼 만한 곳」·「winter trip」·「ㅁㄴㅇㄹ」이 빨강인지 확인하고 실패 줄을 기록한다.
- [ ] 1.2 `analyze` 에 `lang`·관광지 경로 표시(`attractionOnly`) 인자를 더한다(SR-1.3). 기존 호출부의 기본값은 지금 동작을 유지한다.
- [ ] 1.3 어절 창 1~3 을 긴 것부터 `match` 와 불용구 둘 다에 적용한다. 기존 두 어절 창 동작(「가볼만한 곳」)과 `RAINY_DAY` 선처리는 유지한다.
- [ ] 1.4 `STOP_PHRASES` 에 ko·en 을 추가한다(SR-1.2 목록 그대로, 그 외 금지). 새 en 불용어는 `attractionOnly` 에서만 쓴다.
- [ ] 1.5 `Understood.noContent` — 완성형 음절·라틴·숫자가 0개면 참이다.
- [ ] 1.6 Verify: `./gradlew :search:domain:test --tests '*QueryIntentTest'` 통과 줄. 기존 케이스 전부 초록.

### Task Group 2: 조건어 → 속성 선택 · 해석 응답 · 해제 파라미터 (SR-3 · SR-4.1 · SR-5 일부)
**Dependencies:** TG1 · **모듈:** `:search:domain`, `:search:app`
- [ ] 2.1 테스트 먼저
  - `QueryIntentTest`: SR-3.5 케이스 전부(부정어·조사 `가`·조건 둘·`무료` 단독/셔틀·「무료 주차장」·「주차 무료」·행사 분류·`attractionOnly=false`).
  - `SearchAttractionServiceTest`:
    - ① 다른 축 조건 + 명시 칩 → 합집합
    - ② 같은 축 명시 칩 → 명시가 이기고 어절은 잔여에서 빠짐
    - ③ `keepConditionWords=true` → 조건 없음·`interpretedConditions` 빈 배열
    - ④ `skipCondition=parking` → PARKING 만 빠짐
    - ⑤ 스위치 `condition-words.enabled=false` → 조건 없음
    - ⑥ 패싯 건수가 합친 선택으로 나감(포트 인자 캡처)
    - ⑦ `noContent` → 포트 미호출·0건·`zeroReason=NO_CONTENT`
    - ⑧ `narrowsByIntent` 가 conditions 만 있어도 참이고 `hasFilter`·`intentCounter` 는 그대로
  - `AttractionSearchControllerTest`: `keepConditionWords`·`skipCondition` 바인딩, 응답 `interpretedConditions`·`zeroReason` 직렬화.
  - `SearchUnifiedServiceTest`: 「travel」·「place」·「카드 결제 할인」의 잔여가 다른 타입 검색에 그대로 넘어가고 조건이 없음.
- [ ] 2.2 `Condition(kind, values, phrase)` 와 조건어 표(SR-3.1)를 `:search:domain` 에 둔다. `kind` 는 속성 축 enum, `values` 는 도메인 값 집합이다. **API 문자열(param·value)은 presentation 매핑 표 한 곳**이 만들고, 컨트롤러 `@RequestParam(name = …)` 이 그 상수를 쓴다. 문자열 사본을 두지 않는다.
- [ ] 2.3 SR-3.2 규칙을 구현한다.
  - 머리말 + 꼬리말
  - 조사 떼기(`가·이·은·는` 포함)
  - 부정어 미해석
  - 처리 순서 PARKING 먼저
  - ADMISSION 예외(앞 또는 뒤 어절)와 `무료` 단독 제한
  - 언어 열
  - 행사 분류 단독이면 미해석
  - ko 전용 행의 영문 머리말 없음
- [ ] 2.4 서비스 쪽 작업
  - 명시 우선 + 다른 축 합집합
  - `keepConditionWords`·`skipCondition`
  - `AttractionConditionWordsProperties`(`enabled`, 기본 true, env `SEARCH_ATTRACTION_CONDITION_WORDS_ENABLED`) — `application.yml` 한 줄
  - 응답 `interpretedConditions`·`zeroReason`
  - 통합 검색은 `attractionOnly=false`
  - `narrowsByIntent`
- [ ] 2.5 Verify: `./gradlew :search:domain:test --tests '*QueryIntentTest'` · `./gradlew :search:app:test --tests '*SearchAttractionServiceTest' --tests '*AttractionSearchControllerTest' --tests '*SearchUnifiedServiceTest'` 통과 줄.

### Task Group 3: 허브 해석 표시·해제 (SR-4.2~4.5)
**Dependencies:** TG2(응답 계약) · **모듈:** `portal-fe`
- [ ] 3.1 테스트 먼저: `PlacePage.relax.test.tsx`(또는 새 `PlacePage.interpret.test.tsx`)에 넣는다.
  - ① 응답 `interpretedConditions=[parking]` → 주차 칩 켜짐 + 안내 줄(`ATTRIBUTE_CAPTION` 문장 포함), **추가 요청 없음**(요청 수 단언)
  - ② 칩 끄기 → 다음 질의에 `skipCondition=parking`, 다른 해석은 파라미터로 옮겨지지 않음
  - ③ 「조건으로 읽지 않고 검색」 → `keepConditionWords=true`
  - ④ 검색어를 바꾸면 `keepConditionWords`·`skipCondition` 이 빠짐
  - ⑤ 해제 trigger `relax`·`changed` 목록
  - ⑥ 0건 + 해석 조건 → `relaxConditions` 버튼에 그 조건, 검색어 버튼 이름 「검색어 빼고 보기」
  - ⑦ `zeroReason=NO_EVIDENCE`·`NO_CONTENT` → 조건 탓 문구(`emptyReason`) 대신 새 문구(ko·en)
  - ⑧ 조건 둘 이상 안내 줄 형식, PET 두 칩 켜짐·안내 줄은 「반려동물 동반」
  - ⑨ 오타 교정 안내와 조건 안내가 함께 뜰 때 순서·링크 문구가 구별됨
  - ⑩ phrase 에 `<b>x</b>` 가 든 응답 → 텍스트로 보이고 `b` 요소가 생기지 않음
  - ⑪ `exact` + `NO_EVIDENCE` → 교정어로 다시 검색 링크
  - `placeApi` 단위 테스트에는 `keepConditionWords`·`skipCondition` 직렬화를 넣는다.
- [ ] 3.2 구현
  - `placeApi.ts` 응답 타입(`interpretedConditions`·`zeroReason`)과 질의 파라미터.
  - `keepConditionWords`·`skipCondition` 은 `exact` 처럼 `PlacePage.tsx` 의 `query` 메모 **안**에 넣는다(의존성 배열 포함). 그래야 캐시 키 `['place-attractions', query]` 가 갈린다. 해석 조건은 응답에서 파생한 표시 상태이고 `attributes` 에 넣지 않는다.
  - `placeHubState.ts` 에 `keepWordsFor`·`skipConditions` 를 `exactFor` 와 같은 저장·검증으로 추가한다.
  - 칩 역변환, 안내 문구(ko·en — 칩 이름·`ATTRIBUTE_CAPTION` 재사용, React 텍스트 노드), `placeView.ts` 의 `relaxConditions`·0건 문구 분기.
- [ ] 3.3 Verify: `cd portal-fe && npx vitest run src/pages/place/__tests__/PlacePage.relax.test.tsx src/pages/place/__tests__/PlacePage.tracking.test.tsx` + 새 테스트 파일 + `placeHubState` 테스트 + `npx tsc --noEmit` 통과 줄.

### Task Group 4: 어휘 근거 게이트 · 한정 · 검색 분석기 품사 필터 (SR-2 · SR-5 · SR-6)
**Dependencies:** TG1, TG2(`narrowsByIntent`·근거 잔여) · **모듈:** `:search:app`, `:search:batch`
- [ ] 4.1 테스트 먼저 — 어댑터 요청 캡처. 스텁은 **근거 요청(size 0)에만 total 1 을 돌려주는 것**을 새로 둔다. 기존 `emptyResponse()` 는 total 0 고정이라 근거 있음 경로를 못 연다.
  - `OFF` → 지금 요청과 바이트 단위로 같음(스냅숏)
  - `GATE` + 근거 잔여 있음 → 근거 요청(`size 0`·`terminate_after 1`·msm `2<75%`·본 질의와 같은 필터 전부) 뒤 건수 요청 ∥ 본 질의
  - 근거 0 → 본 질의 **와 건수 요청** 없음·빈 페이지·`NO_EVIDENCE`
  - 근거 잔여 없음 → 근거 요청 없음
  - 근거 잔여가 조건어 머리말·꼬리말을 뺀 것(`keepConditionWords=true` 의 「주차 되는 해수욕장」 → 근거 요청 없음)
  - 근거 요청 실패 → 예외 전파(0건으로 삼키지 않음). 건수 실패는 지금처럼 건수 없이 감
  - `CONFINE` + `narrowsByIntent` 거짓 → 키워드 레그 msm·kNN filter 에 msm 일치·건수 요청 키워드에도 msm, **근거 요청 없음**
  - `CONFINE` + `narrowsByIntent` 참 → `GATE` 와 같은 요청
  - `exact=true` → 원문으로 근거 검사
  - 계약 테스트는 search:batch 의 `AttractionsIndexMappingTest` 에 넣는다: `nori_search` 품사 필터가 `tourism_synonyms` **앞**·세분 태그 14개·`E`/`J` 단독 없음
- [ ] 4.2 `AttractionAnswerEvidenceProperties`(`mode`, 기본 `OFF`)와 `application.yml` env 한 줄. 서비스가 `SearchQuery` 에 「근거 필요(근거 잔여)」「한정」을 실어 넘긴다. 어댑터는 설정을 읽지 않는다 — 판단은 application 층이다.
- [ ] 4.3 어댑터에 근거 요청(건수 요청보다 먼저)·한정 분기(`matchedQuery` 의 msm, `countFacets` 의 msm)를 넣는다. msm 값은 상수 하나다.
- [ ] 4.4 `attractions-index.json` `nori_search` 에 품사 필터를 `[pos, tourism_synonyms]` 순서로 넣는다. 운영 `_analyze`(필터 인라인)로 SR-2.2 예시를 재확인하고, 「서울 궁궐」 msm `_count`(필터 전후)를 잰다. 결과는 `verifications/analyze.md` 에.
- [ ] 4.5 Verify: `./gradlew :search:app:test --tests '*AttractionSearchAdapter*Test' --tests '*SearchAttractionServiceTest'` · `./gradlew :search:batch:test --tests '*AttractionsIndexMappingTest'` 통과 줄.

### Task Group 5: 문서 (SR-8)
**Dependencies:** TG2, TG4
- [ ] 5.1 ADR-0090 개정 단락, `QueryIntent` 머리 주석, `search/glossary.md`·`search-architecture.md` 동기화. glossary 새 행은 「쿼리 언더스탠딩」 표기로 쓴다: 어휘 근거 게이트 · 조건어 해석 · 머리말·꼬리말 · 한정(CONFINE) · 내용 없는 입력, 「근거」 ≠ 판정 세트 `evidence` 비고. search-architecture §4 줄 번호도 갱신한다.
- [ ] 5.2 Verify: `python3 ai/plugins/hns/scripts/doc_scan.py` 가 새 경로를 추적하는지 확인한다(`docs/standards/doc-index-tracking.md` 절차). glossary 에 「어휘 근거 게이트」·「조건어 해석」·「머리말·꼬리말」·「한정(CONFINE)」·「내용 없는 입력」 다섯 행이 있는지 grep.

### Task Group 6: 착수 전 측정 · 회귀 주입(임시 사본) · 배포 · 운영 확인 · 판정 세트 전후 nDCG (SR-7)
**Dependencies:** TG1~TG5(6.0 은 TG1 과 병행 가능)
- [ ] 6.0 착수 전 측정(운영 읽기만). 결과는 `verifications/` 에.
  - 「도쿄 수족관」 msm `_count`
  - 「해수욕장」「경복궁」 top-5 기준 id
  - 무변경 이틀 정기 실행의 언어별 C 차이(잡음 하한)
  - 원인 분석 근사 표의 재측정: 지금 경로 B(kNN filter 에 OR multi_match)와 GATE·CONFINE 근사. `verifications/approx-measurement.md` 갱신
  - `live-eval.py` 에 `--condition-pair`(같은 실행에서 `keepConditionWords=true` 대조군) 추가, 결과 JSON 에 색인 이름 기록
- [ ] 6.1 회귀 주입은 워킹트리가 아니라 `scratchpad` 임시 사본(`git worktree add` 또는 `cp -r search portal-fe`)에서 한다. 각각 컴파일되는 변경으로 빨강을 확인한다. 결과 표는 `verifications/regression-injection.md` 에.
  - ① 불용구 창을 1어절로 되돌림 → 「아이랑 갈 만한 곳」 빨강
  - ② `STOP_PHRASES` 에서 `trip` 삭제 → 「winter trip」 빨강
  - ③ `noContent` 항상 false → 「ㅁㄴㅇㄹ」 빨강
  - ④ 꼬리말 검사 삭제 → 「반려견 놀이터」 빨강
  - ⑤ 언어 열 무시(`analyze` 의 `lang` 을 쓰지 않음) → 「pet friendly」(en) 빨강
  - ⑥ 처리 순서를 뒤집고(ADMISSION 먼저) PARKING 예외도 삭제 → 「주차 무료 해수욕장」 빨강. 예외 하나만 지우면 안 문다 — PARKING 이 먼저 `무료` 를 가져가고, 「무료 주차장」은 `무료` 단독 제한(SR-3.2 ⑤)이 따로 막는다. 이 중복은 V6 에 적어 뒀다
  - ⑦ 서비스 합집합을 덮어쓰기로 → 다른 param(조건 PARKING + 명시 `creditCard`) 합집합 케이스 빨강
  - ⑧ 통합 검색이 `attractionOnly=true` 로 부름 → `SearchUnifiedServiceTest` 「travel」·「카드 결제 할인」 빨강
  - ⑨ 근거 요청 경로에서만 지역 필터 누락 → 근거 요청 filter JSON 이 본 질의와 같음 + 지역 코드 존재 단언이 빨강
  - ⑩ 근거 0 인데 본 질의 실행 → 빨강
  - ⑪ `CONFINE` 의 kNN filter 에서 msm 삭제 → 빨강
  - ⑫ `OFF` 요청에 필드 하나 추가 → 스냅숏 빨강
  - ⑬ stoptags 에 `J` 추가 → 계약 빨강
  - ⑭ FE 칩 끄기에서 `skipCondition` 누락 → vitest 빨강
  - ⑮ 검색어 변경 뒤에도 `keepConditionWords` 유지 → vitest 빨강
  - ⑯ `CONFINE` 분기 조건을 `hasFilter` 로 → 조건만 있는 질의 케이스 빨강
  - ⑰ 조사 떼기 삭제 → 「반려견과 함께」「주차가 되는」 빨강
  - ⑱ 근거 요청 실패를 0건으로 삼킴 → 예외 전파 테스트 빨강
  - ⑲ 품사 필터를 `tourism_synonyms` 뒤로 → 계약 빨강
- [ ] 6.2 커밋은 경로를 좁혀 한다: `search/` · `portal-fe/src/pages/place` · `portal-fe/src/api/placeApi.ts` · `k8s/base/search-batch/eval/live-eval.py` · 문서 · 이 스펙 폴더. `git diff --cached` 로 핵심 라인 다섯이 스테이지에 있는지 확인한다: 조건어 표·근거 요청·품사 필터·`keepConditionWords`·`attractionOnly`. 푸시는 사용자 확인 뒤.
- [ ] 6.3 배포 순서: search:app(+env `OFF`, 조건어 스위치 기본 true) → portal-fe → search:batch(색인 JSON) → 다음 정기 재색인. 재색인 뒤 운영 `_analyze`(`field: title`, 새 색인)로 「아이랑」에서 `랑` 이 빠지는지 본다. 직전 색인은 SR-2 되돌림용 보관 색인으로 남긴다.
- [ ] 6.4 운영 확인(공개 API GET)
  - 탐침 12 의 단계 1 결과를 SR-7.1 기대표대로 기록
  - 「주차 되는 해수욕장」 응답 `interpretedConditions` 와 전 결과 `attrParking=YES`(배선 확인)
  - 허브 화면 CDP 실측: 안내 줄·칩 해제·「조건으로 읽지 않고 검색」(fe-visual-verification 표준, start·측정·stop 한 명령)
- [ ] 6.5 판정 세트 전후 nDCG
  - 단계 1: 정기 실행 짝 + `--condition-pair` 대조군
  - 단계 2·3: v3 선행 확인 → 그 구성 top-20 풀링·채점 → `GATE` → `CONFINE`. env 전환·수동 평가 Job 은 사용자 확인 뒤
  - 클릭 계수·하이브리드·융합 스위치는 고정
  - 단계마다 SR-7.3 채택 조건(잡음 하한·p99 ADR-0025 Tier 1 포함)을 판정하고, 어기면 SR-7.3 되돌림 경로를 쓴다
- [ ] 6.6 Verify: `python3 k8s/base/search-batch/eval/live-eval.py <세트> scripts/search-eval/results/<날짜>-query-fixes.json`(EVAL_API_URL=공개 API) 출력의 언어별 C 와 게이트 판정 줄. 다음 정기 `search-eval` Job 이 `Completed` 인지(`ssh msa-oci kubectl get pods -n commerce | grep search-eval`).

## 완료 보고에 넣을 것
- 측정 세트(v3)와 색인 이름
- 잡음 하한
- 단계별 ko/en C(조건어 짝 대조 포함)와 채택 여부
- 0.05 넘게 나빠진 질의
- 탐침 12 결과(에펠탑·디즈니랜드 사람 확인 건수 따로)
- 빈 정답 통과율
- p99 전후
- 근사 표 재측정 결과
- 회귀 주입 19건 결과
- 켜진 최종 `mode` 와 조건어 스위치 값
