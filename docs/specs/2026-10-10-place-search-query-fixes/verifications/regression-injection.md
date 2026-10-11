# 회귀 주입 — 백엔드 몫 (TG6.1)

2026-10-11. 워킹트리가 아니라 `scratchpad/regr`(워크트리 `rsync` 사본, `node_modules`·`build`·`.git` 제외)에서 했다.
주입마다 원본에서 파일 하나를 읽어 바꾼 뒤 그 테스트만 돌리고, 끝나면 원본으로 되돌렸다. **전부 컴파일되는 변경**이다(구문 오류 빨간불은 증거로 치지 않는다).
판정 근거는 각 테스트가 대상 함수(`QueryIntent.analyze` · `SearchAttractionService.execute` · `AttractionSearchAdapter.search` · 색인 정의 JSON · MockMvc 응답)를 부르고 그 산출물을 보는 것이다.

FE 몫(⑭·⑮)은 아래 「FE 몫」 절에 있다.

| # | 주입 | 돌린 테스트 | 결과 | 빨갛게 된 케이스(첫 줄) |
|---|---|---|---|---|
| ① | `MAX_WINDOW = 3` → `1` | `*QueryIntentTest` | RED 9/82 | 「갈 만한」·「곳」이 지워지고 「아이랑」만 남는다 외 |
| ② | `ATTRACTION_STOP_PHRASES` 에서 `"trip"` 삭제 | `*QueryIntentTest` | RED 1/82 | 영문 불용어 trip 이 지워진다(「winter trip」) |
| ③ | `hasNoContent` 를 늘 false 로(`text.isEmpty() && …`) | `*QueryIntentTest` | RED 2/82 | noContent 다(「ㅁㄴㅇㄹ」) |
| ④ | 꼬리말 검사 줄 삭제 | `*QueryIntentTest` | RED 1/82 | 꼬리말이 없으면 조건이 아니다(「반려견 놀이터」) |
| ⑤ | 언어 열 무시(`lang in it.langs` 삭제) | `*QueryIntentTest` | RED 1/82 | 언어 열에 없어 옮기지 않는다 — en 의 「반려견 동반」 |
| ⑥ | 순서 뒤집기(ADMISSION 먼저) + PARKING 이웃 예외 삭제 | `*QueryIntentTest` | RED 1/82 | 주차가 먼저 무료를 꼬리말로 가져간다(「주차 무료 해수욕장」) |
| ⑦ | 서비스 합집합 → 해석이 있으면 명시 선택을 버리고 덮어씀 | `*SearchAttractionServiceTest` | RED 1/74 | 칩과 해석이 합쳐진다(조건 PARKING + 명시 creditCard) |
| ⑧ | 통합 검색이 `attractionOnly = true` 로 부름 | `*SearchUnifiedServiceTest` | RED 1/9 | 잔여가 그대로 다른 타입 검색에 간다(「travel」·「place」·「카드 결제 할인」) |
| ⑨ | 근거 요청에서만 `sidoCode` 를 뺌 | `*AttractionSearchAdapterEvidenceTest` | RED 1/12 | 근거 요청의 필터는 본 질의와 같다 — 지역 코드까지 |
| ⑩ | 근거 0 이어도 본 질의 실행(`&& false`) | `*AttractionSearchAdapterEvidenceTest` | RED 1/12 | 본 질의와 건수 요청을 내지 않고 빈 페이지·noEvidence |
| ⑪ | CONFINE 의 kNN filter 에 msm 없는 일치를 넘김 | `*AttractionSearchAdapterEvidenceTest` | RED 1/12 | 키워드 레그와 knn filter 의 검색어 일치 모두에 msm |
| ⑫ | OFF 요청에 `track_total_hits` 필드 추가 | `*AttractionSearchAdapterEvidenceTest` `*AttractionSearchAdapterEventTest` | RED 14/54 | 본 질의 [keyword-only] 은 기준 JSON 과 바이트 단위로 같다 외 |
| ⑬ | stoptags 에 `"J"` 추가 | `*AttractionsIndexMappingTest` | RED 1/16 | stoptags 는 조사·어미 세분 태그 14개다 |
| ⑯ | CONFINE 분기 조건을 `hasFilter` 로 | `*SearchAttractionServiceTest` | RED 1/74 | 조건만 있는 질의(「반려견 동반 서울」) — 한정 없음 |
| ⑰ | 머리말 조사 떼기 삭제 | `*QueryIntentTest` | RED 3/82 | 조사를 떼고 같은 조건이 된다(「주차가 되는」) · 「반려견과 함께」 · 「무료로」 |
| ⑱ | 근거 요청 실패를 `runCatching` 으로 삼켜 0건 | `*AttractionSearchAdapterEvidenceTest` | RED 1/12 | 예외가 올라간다 — 0건으로 삼키지 않는다 |
| ⑲ | 품사 필터를 `tourism_synonyms` 뒤로 | `*AttractionsIndexMappingTest` | RED 1/16 | 품사 필터가 … 동의어 필터 앞에 있다 |
| 추가 | 응답 DTO 의 `@JsonIgnoreProperties("interpreted")` 삭제 | `*AttractionSearchControllerTest` | RED 1/15 | 도메인 조건은 나가지 않는다 |

## 스펙 목록과 다르게 한 것

- **⑤ 의 대상 케이스를 바꿨다.** 스펙은 「pet friendly」(en)가 빨개진다고 적었지만, V12 로 ko 전용 행의 영문 머리말(`pet` 등)을 지웠기 때문에 언어 열을 무시해도 「pet friendly」는 여전히 조건이 아니다 — 그 케이스로는 안 문다. 언어 열이 실제로 막는 것은 **en 요청의 ko 머리말**(「반려견 동반」·「유모차 대여」)이라 그 케이스로 잡았다.
- **TG1.1 의 「가볼 만한 곳」은 지금 코드에서도 초록이었다.** 질의 전체를 한 구절로 먼저 맞추는 기존 단계가 `가볼만한곳`(유형 12)으로 잡는다. 세 어절 창이 필요한 것은 다른 말이 섞인 경우(「서울 갈 수 있는 곳」·「부모님과 가기 좋은 곳」)다 — 착수 전 빨강 확인에서 그 둘이 빨갰다.

## FE 몫 (⑭·⑮)

2026-10-11. `scratchpad/regress-fe/portal-fe`(워크트리 `portal-fe` 의 `rsync` 사본, `node_modules` 는 워크트리 것을 심링크)에서 했다.
사본에 함께 딸려 온 다른 작업의 미완성 테스트(`AttractionAccess.test.tsx`)는 사본에서만 지우고 기준 `tsc -b` exit 0 을 확인했다.
주입마다 `npx tsc -b` exit 0(컴파일되는 변경)을 확인한 뒤 `npx vitest run src/pages/place/__tests__/PlacePage.interpret.test.tsx` 를 돌리고 원본으로 되돌렸다.
판정 근거는 화면이 실제로 보낸 질의(`searchAttractions` 대역 인자)와 SEARCH 계측 payload 다.

| # | 주입 | 결과 | 빨갛게 된 케이스 |
|---|---|---|---|
| ⑭ | 해석된 칩을 끌 때 `skipInterpreted(param)` 호출 삭제(trigger·changed 는 그대로) | RED 2/14 | 해석된 칩을 끄면 다음 질의에 skipCondition=parking · 검색어를 바꾸면 keepConditionWords·skipCondition 이 질의에서 빠진다 |
| ⑮ | `keepConditionWords: keepWordsFor != null` — 검색어 대조 삭제 | RED 1/14 | 검색어를 바꾸면 keepConditionWords·skipCondition 이 질의에서 빠진다 |
