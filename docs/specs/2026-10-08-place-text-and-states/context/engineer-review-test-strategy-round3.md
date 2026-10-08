# Engineer Review — test-strategy (3라운드)

이번 라운드는 두 가지를 봤다. 첫째, 2라운드 심판 편집 E8~E11 이 반영된 `spec.md` 가 R1~R8 을 닫았는지 확인했다. 둘째, 새로 들어온 테스트가 대상의 산출물을 보는지 확인했다. 이미 판정된 항목은 다시 열지 않고, 새로 찾은 결함만 적는다.

## Seed Discovery
- 문서: `spec.md`, `context/engineer-review-test-strategy-round2.md`, `context/review-verdict-round2.md`, `docs/standards/test-rules.md`
- 대조한 코드
  - `CategoryLexiconAdapter.kt:37-40,50-86`
  - `AttractionSearchRequestSnapshots.kt:20,31-56`
  - `UnifiedAttractionRequests.kt:30-47`
  - `AttractionReindexCaptureTest.kt:179-184`
  - `App.tsx:71-73,102-113,202,263-264`

## R1~R8 해소 여부

| 2라운드 | 해소 | 근거 |
|---|---|---|
| R1 세 상태·빈 집합 | 해소 | SR-6.3 실패 처리(spec.md:63), SR-6.5 ⑤ 빈 집합 · ⑥ 한 번도 못 받음 · ⑦ 코드표 실패(spec.md:69). 판정은 `QueryIntent.analyze` 의 산출물로 한다(spec.md:68) |
| R2 집계 요청이 목 경계 밖 | 요청 쪽은 해소 | 어댑터 요청 캡처 테스트에 세 필드 · `bucketSize` · 잘림 예외가 있다(spec.md:70). 응답 쪽은 T1 로 남는다 |
| R3 언어 축 | 해소 | 집합을 `lang` 별로 받는다(spec.md:61). ② ko 전용 코드 → en 사전에서 빠짐(spec.md:69) |
| R4 회귀 주입 8종 | 해소 | 8종에 5종을 더해 13종이 SR-7.3(spec.md:83)에 있다. 각 주입이 해당 단언을 실제로 빨갛게 만드는지 따라가 봤다. 예: `selectRegion` 으로 되돌리면 `setGeo(null)` 때문에 `lat` 이 빠진다. 13종 모두 빨강이 된다 |
| R5 패널 이중 정규화 | 해소 | 패널 `&lt;PARASITE&gt;` vitest(spec.md:75), `findById` 원문 Kotest(spec.md:82), 주입(spec.md:83) |
| R6 언어 전환 경로·마운트 | 해소 | `/en/place` 에 `App` 자체를 마운트한다(spec.md:78). jsdom 의 hostname 은 `localhost` 라 `isApexProd`·`isPlaceHost` 가 거짓이다. 그래서 `placeRoute` 가 리다이렉트하지 않고 그대로 렌더한다(`App.tsx:110-113`) |
| R7 0건 픽스처 세부 | 해소 | 지역 · 시도+반경 · `areaCode` · 지역 고르기 · 반경 · 모두 해제 · `changed` 목록(spec.md:79) |
| R8 요약 길이 경계 | 해소 | 250자 원문에서 정규화 결과가 150자면 `…` 를 붙이지 않는다. 기대 문자열 전체로 단언한다(spec.md:82) |

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | 모든 AC 에 테스트 | 부분 충족. SR-6.3 의 「버킷 크기 ≥ 코드표 행 수」는 서비스 쪽 테스트가 없다(T2) |
| 2 | 계층 배정 | 부분 충족. 어댑터의 응답 해석을 재는 계층이 없다(T1) |
| 3 | 목 경계 | 결함. 서비스 테스트는 포트를 목으로 둔다. 그런데 어댑터 테스트는 요청 모양만 본다. 그래서 「응답 → `Map<lang, Set<code>>`」 변환이 두 테스트 사이에 빠진다(T1) |
| 4 | 테스트 데이터 | 부분 충족. 「잘림 예외」를 재려면 집계가 든 응답 픽스처가 필요하다. 그런데 지정된 관례 헬퍼는 집계 없는 빈 응답만 준다(T1) |
| 5 | 음성·경계 | 부분 충족(T3·T4) |
| 6 | 네이밍 | 통과. Kotest BehaviorSpec + MockK(`test-rules.md:6,12`) |

## 산출물을 보는가
- SR-6.5 서비스 테스트는 `QueryIntent.analyze(...).facets/hasFilter` 를 본다. 사전 내부가 아니라 쿼리 언더스탠딩의 산출물이므로 통과다.
- 0건 해제 · `relax` · `exact` 는 `searchAttractions` 목 인자, `track` 페이로드, `placeApi` URL 을 본다. 화면이 경계 밖으로 내보내는 값이므로 통과다.
- 어댑터 캡처 테스트는 요청 JSON 을 본다. 통과다. 다만 어댑터의 다른 산출물인 반환 맵은 아무 테스트도 보지 않는다 → T1.

## Findings

### T1 (REVISE) 집계 응답을 해석하는 코드가 목 경계 밖에 남는다
- 스펙: SR-6.5 어댑터 테스트(spec.md:70)는 「요청 모양 + `sum_other_doc_count > 0` 이면 예외」만 본다. 서비스 테스트(spec.md:69)는 `indexedCategoryCodes` 를 MockK 로 대신한다.
- 문제
  - 어댑터가 응답을 `Map<String, Set<String>>` 으로 바꾸는 코드를 아무 테스트도 보지 않는다. 다음과 같이 해석을 틀려도 모든 테스트가 초록이다.
    - `lclsSystm1` 하위 집계를 빠뜨린다.
    - lang 버킷 키 대신 상위 키를 쓴다.
    - 세 필드를 합치지 않고 마지막 필드로 덮어쓴다.
  - 운영에서는 이렇게 된다. 얕은 코드가 집합에서 빠지면, 문서가 있는 대분류 이름(예: 「자연관광」)의 필터가 꺼진다. 이 변화는 조용해서 0건이 아니라 결과가 넓어질 뿐이고, 배포 뒤 확인(템플스테이 `total > 0`)으로도 잡히지 않는다.
  - 데이터 측면의 문제도 있다. 스펙이 지정한 관례 헬퍼 `AttractionSearchRequestSnapshots.adapter()` 는 `JsonData` 검색에 집계 없는 빈 응답을 돌려준다(`AttractionSearchRequestSnapshots.kt:48-51`, 주석 「집계가 없어 건수 조립은 실패한다 — 요청 모양만 본다」). 그래서 「잘림 → 예외」 케이스는 이 헬퍼로 짤 수 없다. 이 파일은 「항목을 고치면 기준을 새로 떠야 하므로 고치지 않는다」고 적혀 있기도 하다(`:20`).
- 수정안: SR-6.5 어댑터 테스트 항목에 다음을 더한다.
  - 「이 테스트는 `AttractionSearchRequestSnapshots.adapter()` 를 쓰지 않는다. 자기 `OpenSearchClient` 목을 두고, 응답은 `SearchResponse.Builder` 로 집계를 채워 준다.」
  - 응답 해석 케이스를 하나 둔다. ko 버킷에서 `lclsSystm1={A}`·`lclsSystm2={B}`·`lclsSystm3={C}`, en 버킷에서 `lclsSystm3={D}` 를 주면 반환값은 `{ko={A,B,C}, en={D}}` 와 같아야 한다. 맵 전체를 같음으로 단언한다.
  - SR-7.3 에 주입 한 줄을 더한다: `lclsSystm1` 하위 집계를 읽는 줄을 지운다 → 응답 해석 케이스가 빨강.

### T2 (REVISE) 서비스가 코드표 행 수를 버킷 크기로 넘기는지 아무 테스트도 보지 않는다
- 스펙: 「버킷 크기는 그 갱신에서 받은 코드표 행 수 이상으로 잡는다(상수·설정 아님)」(spec.md:61). 이 값은 `CategoryLexiconService` 가 계산해 `indexedCategoryCodes(bucketSize)` 에 넘긴다(spec.md:64).
- 문제
  - 어댑터 테스트는 「요청 크기 ≥ 인자」만 본다(spec.md:70). 서비스 테스트는 `indexedCategoryCodes(any())` 로 목을 둘 수 있다. 그래서 서비스가 상수 `10` 을 넘겨도 두 테스트가 모두 초록이다.
  - 운영에서는 이렇게 된다. 상위 10개만 받으면 `sum_other_doc_count > 0` 이고 예외가 난다. 처음이면 ⑥ 에 따라 코드표 전체 사전이 된다. 그러면 SR-6 이 한 번도 적용되지 않은 채 템플스테이 0건이 그대로 남는다. 이것을 잡는 것은 배포 뒤 확인 하나뿐이다.
  - SR-7.3 의 주입 「집계 버킷 크기 지정 삭제 → 요청 캡처 빨강」(spec.md:83)은 어댑터 쪽만 덮는다. 서비스 쪽 인자는 덮지 않는다.
- 수정안
  - SR-6.5 서비스 테스트에 ⑧ 을 더한다: 「코드표 N 행을 받으면 `indexedCategoryCodes` 는 N 이상의 인자로 호출된다(`verify { search.indexedCategoryCodes(match { it >= N }) }`)」.
  - SR-7.3 에 주입을 더한다: 서비스가 상수 `10` 을 넘긴다 → ⑧ 이 빨강.

### T3 (MINOR) 잘림 검사에 회귀 주입이 없다
- 근거: SR-6.5 에 「`sum_other_doc_count > 0` 이면 예외」 테스트가 있다(spec.md:70). 그런데 SR-7.3(spec.md:83)의 주입 13종에 이 검사를 지우는 항목이 없다. 버킷 크기 주입과 이 검사는 서로 다른 방어선이다. 크기 지정이 맞아도 코드표보다 색인 값이 많아지면 이 검사만 남는다.
- 수정안: SR-7.3 에 「`sum_other_doc_count` 검사를 지운다 → 어댑터 잘림 케이스 빨강」을 더한다(T1 의 응답 픽스처가 있어야 짤 수 있다).

### T4 (MINOR) `lexicon(null)` 경로에 테스트가 없다
- 근거: 지금은 `lang` 이 없으면 ko 사전을 쓴다(`CategoryLexiconAdapter.kt:39-40`, `DEFAULT_LANG`). 심판 NOTES 의 「lang 없는 질의는 ko 사전 → 0건 위험 없음」도 이 동작을 전제로 한다. 이 코드는 `CategoryLexiconService` 로 새로 옮겨 쓴다. 그런데 SR-6.5 의 ①~⑦ 은 모두 `lang` 을 명시한다(spec.md:69).
- 문제: 새 구현이 `null` 에 `EMPTY` 를 돌려줘도 모든 테스트가 초록이다. 그러면 언어 없는 질의에서 쿼리 언더스탠딩이 통째로 꺼진다.
- 수정안: SR-6.5 에 ⑨ 를 더한다: 「`lexicon(null)` 은 `lexicon("ko")` 와 같은 필터를 낸다(ko 집합에 있는 코드 이름 → 필터 있음)」.

## 요약
R1~R8 은 모두 닫혔다. 13종의 회귀 주입도 각각 실제로 빨강이 된다. 새 결함은 모두 SR-6 의 어댑터 ↔ 서비스 이음매에 있다.
- 응답 해석이 어느 테스트에도 없다(T1).
- 버킷 크기 인자를 서비스 쪽에서 아무도 재지 않는다(T2).

둘 다 테스트 항목 한두 줄로 고칠 수 있고, 스펙 결정을 바꾸지 않는다. 사람 판단은 필요 없다.

VERDICT: REVISE
