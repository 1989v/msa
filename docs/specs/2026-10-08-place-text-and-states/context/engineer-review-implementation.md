# Engineer Review — implementation (1라운드)

- 대상: `docs/specs/2026-10-08-place-text-and-states/spec.md` (작업 트리 origin/main a05ab2765)
- 범위: 세션 결정 ①~⑥은 재론하지 않고, 그 안에서 구현 결함만 본다.
- 인용 검증: 스펙의 file:line 은 전부 실제 코드와 맞는다. PlacePage.tsx 1533·1656·1375-1379·293-307·1204-1213·1249-1253·470-480, placeAttributes.ts 39-55, copy.mjs 844-860, placeView.ts 203·206, AttractionSeoText.kt 43-57, AttractionPageRenderer.kt 20-23, AttractionJsonLdParityTest.kt 90·92, SearchAttractionService.kt 74·83-87·125·169·226, SearchUnifiedService.kt 61·73, AttractionSearchController.kt 46-72, SearchAttractionUseCase.kt 9·84·188, AttractionAttributeParser.kt 26·113·147-158, AttractionApiReindexTasklet.kt 221, UnifiedSearchPage.tsx 230 을 확인했다. 클래스 이름 하나만 틀렸다(R6).

## 체크리스트

| # | 항목 | 판정 |
|---|---|---|
| 1 | 참조한 클래스·모듈이 있는가 | 대체로 있음. 이름 하나와 FE API 파일 하나가 빠짐(R6) |
| 2 | 기존 코드와 충돌이 없는가 | **충돌 있음.** 정규화를 두 번 거는 경로(R1·R2), 기존 픽스처 행(R3), 행사 분류의 속성 무시(R4) |
| 3 | 복잡도 위험을 짚었는가 | 0건 해제 버튼의 계측 trigger 대응이 정해지지 않음(R4) |
| 4 | NFR 안티패턴(N+1·타임아웃·무한 자원) | 해당 없음. 요약 정규화는 쪽당 최대 100건 × 정규식 몇 번이라 비용이 무시할 만하다 |
| 5 | 마이그레이션·롤백 | 파서 v2 롤백 절차와 배포 순서가 빠짐(R5) |
| 6 | 동시성 | 해당 없음(상태 없는 순수 함수, 색인은 배치 재색인) |

## 발견

### R1 [주요] `sourceText` 는 멱등이 아니다. 서버와 FE 에서 두 번 걸면 원문이 사라진다 — SR-1.2·SR-1.3·SR-2.1(카드)·SR-2.2
- 근거: `copy.mjs:849` 태그 제거가 `:850` 엔티티 디코드보다 **먼저** 돈다(`AttractionSeoText.kt:48-49` 도 같은 순서). 그래서 `&lt;X&gt;` 는 첫 번째 패스에서 `<X>` 가 되고(`placeView.test.ts:246` `'&lt;가&gt; &amp; 나' → '<가> & 나'`), 두 번째 패스에서 `<X>` 가 태그로 지워진다.
- 실제 데이터에 있는 경우다. `evidence/stage1/s1-6-hub-ui-check.md:16` 의 실화면 표본 `K-movie &lt;PARASITE&gt; - A town…` 은 서버 정규화(SR-1.2) 뒤 `K-movie <PARASITE> - …` 가 되고, 카드에서 `overviewText` 를 한 번 더 거치면(SR-2.1, `PlacePage.tsx:1656`) `K-movie  - …` 로 **작품 제목이 빠진다**.
- 같은 문제가 세 곳에 있다:
  - 카드(`:1656`): 목록 응답에서 온 값이라 SR-1.2 로 이미 정규화돼 있다.
  - 통합 검색: `SearchUnifiedService.kt:61` 이 `searchAttraction.execute` 를 부르므로 `:73` 의 `it.overview` 는 SR-1.2 를 이미 거쳤다. SR-1.3 대로 `sourceText` 를 한 번 더 걸면 서버 안에서 두 번 걸린다.
  - `UnifiedSearchPage.tsx:230`(SR-2.2): 위 결과에 FE 가 세 번째로 건다.
- SR-2.2 가 요구하는 테스트 `sourceText(sourceText(x)) === sourceText(x)` 는 위 입력에서 거짓이다. 테스트 픽스처를 고르는 방식에 따라 통과도 실패도 할 수 있어서, 통과해도 안전하다는 근거가 되지 못한다.
- 수정안:
  1. 정규화는 **원문을 받는 자리에서 한 번만** 한다. 목록 요약은 서버(SR-1.2)가 맡는다. 카드(`:1656`)·뽑기 카드·통합 검색 요약(`UnifiedSearchPage.tsx:230`)은 받은 값을 그대로 그린다. FE 정규화는 단건 원문(`fetchAttraction` → `PlacePage.tsx:606` → 패널 `:1533`)에만 건다.
  2. SR-1.3 은 「추가 처리 없음. SR-1.2 가 이미 정규화한 값을 쓴다」로 바꾼다. Kotest 는 실제 `SearchAttractionService` 를 거친 통합 summary 에 엔티티·태그가 0이고 `<PARASITE>` 가 남는지를 본다.
  3. 멱등 테스트는 지운다. 대신 `K-movie &lt;PARASITE&gt;` 를 회귀 픽스처로 둔다. 서버 요약과 카드 화면 모두 `<PARASITE>` 를 글자로 보여야 한다.
  4. SR-6.3 의 「카드 정규화 제거 → vitest 빨강」은 「서버 요약 정규화 제거 → Kotest 빨강」으로 바꾼다.

### R2 [주요] 통합 검색 FE 정규화가 관광지 외 타입에도 걸린다 — SR-2.2
- `UnifiedSearchPage.tsx:211-230` 은 모든 타입(글·게임·개념·혜택·상품)의 `hit.summary` 를 같은 자리에 그린다. SR-1.3 이 「관광지 외 타입의 summary 는 손대지 않는다」고 한 것과 어긋난다.
- 태그 정규식 `<[^>]*>`(`copy.mjs:849`)는 개념 사전 요약의 `List<String>` 같은 꺾쇠를 지운다.
- 수정안: R1-1 을 따르면 FE 처리가 없어져 함께 해결된다. FE 처리를 남긴다면 `hit.type === 'ATTRACTION'` 일 때만 건다고 명시한다.

### R3 [주요] 기존 픽스처 행이 새 규칙과 모순되고, 행 수 검사가 깨진다 — SR-4.2
- `search/domain/src/test/resources/attributes/raw-fixtures.tsv:105` 는 `parking	en	NO	N/A (Please use nearby parking facilities)` 이다. SR-4.1 을 적용하면 이 행이 UNKNOWN 이 되어 `AttractionAttributeParserTest.kt:57-59` 가 실패한다.
- 스펙은 N/A 행을 「추가」하라고만 한다. 그러면 `AttractionAttributeParserTest.kt:19` 의 `fixtures.size shouldBe 145` 도 깨진다.
- 수정안: 「`:105` 의 기대값을 NO → UNKNOWN 으로 바꾼다(행을 새로 넣지 않는다)」로 고친다. 새 행이 필요하면 `:19` 의 145 를 함께 올린다고 적는다. 판정은 바뀌지 않는다는 점도 적는다 — 필터는 YES 만 거르기 때문이다(`SearchAttractionService.kt:142`). 바뀌는 것은 상세 배지뿐이라는 사실을 SR-4.3 배포 확인에 넣는다.

### R4 [주요] 0건 해제 버튼이 아무 일도 하지 않는 경우와, 계측 trigger 대응이 비어 있다 — SR-5.1·SR-5.3
- **행사 분류에서는 속성 조건이 질의에 실리지 않는다**(`PlacePage.tsx:353`). 그 상태에서 0건이면 스펙대로라면 속성 해제 버튼이 보인다. 하지만 눌러도 `query` 가 같아 요청이 나가지 않는다. 버튼이 심은 `triggerRef` 도 소비되지 않고 남았다가(`:409-414` 는 새 view 에서만 소비한다) 다음 조작의 SEARCH 에 잘못 붙는다. `listEventStatus` 도 `category === EVENT_CATEGORY` 일 때만 질의에 실린다(`:345-347`). 수정안: 「지금 걸린 조건」은 **실제 질의에 실린 것**으로 정의한다. 행사 분류에서는 속성을 빼고, 행사 상태는 행사 분류이면서 값이 있을 때만 넣는다.
- **검색어 해제가 입력창을 비우지 않는다.** `keyword` 만 비우면 `keywordInput`(`:293`)이 남는다. 그 상태에서 Enter 를 누르면 `runKeywordSearch`(`:1019-1026`)가 해제했던 검색어를 다시 건다. 수정안: 검색어 해제는 `setKeywordInput('')` 과 `exact` 해제를 함께 한다.
- **trigger 대응이 비어 있다.** `SearchTrigger`(`:231-244`)에는 반경 해제, 「모두 해제」, 「원래 검색어로 검색」에 맞는 값이 없다. ref 를 비워 두면 `other` 로 떨어지는데(`:411`), `other` 는 기준선에서 0 이어야 하는 안전망이다(`:228-229`). 수정안: 버튼마다 `trigger`/`changed` 를 표로 고정한다. 예: 검색어→`submit`/`['keyword']`, 분류→`category`, 행사 상태→`eventStatus`, 속성→`attribute`, 지역→`region`. 반경·모두 해제·원문 검색은 새 값(예: `clear`·`exact`)을 union 에 더한다. 새 값을 집계 쪽이 받는지 확인하는 일과 SR-6.1 의 계측 테스트를 함께 적는다.

### R5 [보통] 배포 순서·롤백이 없다 — SR-3.4·SR-4.3
- R1 수정 뒤에는 정규화를 서버(목록 요약)가 맡는다. FE 가 먼저 배포되면 그 사이 카드에 원문이 보인다. 지금 상태와 같아서 퇴행은 아니다. 다만 SR-6.4 의 「30카드 노출 0」은 **search:app 배포 뒤에만** 성립하므로 확인 순서를 적는다.
- 파서 v2 롤백 절차가 없다. 「search:batch 이전 이미지 + 재색인 1회」로 돌아간다고 적는다. 섞인 색인(v1·v2 문서 공존)은 필터 결과를 바꾸지 않는다는 점도 적는다(R3 근거와 같다).
- 목록 응답의 `overview` 뜻이 「원문 200자」에서 「평문 200자, 비면 null」로 바뀐다. 이 값을 읽는 다른 소비자가 있다. 프리렌더 `prerender-seo.mjs:996` 이 `hasOverview`(사이트맵 포함 여부)를 이 값으로 정한다. 태그만 있는 개요는 이제 사이트맵에서 빠진다. 반면 서버 렌더의 noindex 는 원문 `isNullOrEmpty` 로 판정한다(`AttractionPageRenderer.kt:63`). 둘이 어긋날 수 있다는 사실을 스펙에 적고, 하나로 맞출지 정한다(같은 판정 = 정규화 뒤 빈 값).

### R6 [경미] 이름·누락
- SR-5.3 의 `SearchAttractionController` 는 실제로 `AttractionSearchController`(`search/app/.../presentation/search/controller/AttractionSearchController.kt:44-72`)다.
- `exact` 를 실을 FE 쪽 파일이 빠져 있다. `placeApi.ts:356` `AttractionQuery` 타입과 `:405-428` 직렬화가 그곳이다. 스펙 머리 `source:` 목록에도 없다.
- SR-3.2 의 「반려동물 동반」은 `petAllowed` 와 `petPartial`(`placeAttributes.ts:44-45`) **둘 다**여야 영문 4종이 나온다(11 − 7). 두 칩 id 를 모두 적는다.

## 결론
설계 방향은 맞다. 다만 R1 그대로 구현하면 실데이터 표본(`<PARASITE>`)에서 새 결함이 생기고, 그 결함을 막을 멱등 테스트도 성립하지 않는다. R3 은 첫 빌드에서 바로 실패한다. R4 는 계측 기준선(`other` = 0)을 깬다. 스펙 문구만 고치면 되는 문제라 사람 판단이 필요한 BLOCK 은 아니다.

VERDICT: REVISE
