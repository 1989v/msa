# Engineer Review — domain (2라운드)

- 대상: `docs/specs/2026-10-08-place-text-and-states/spec.md` (개정본, SR-6 신설)
- 작업 트리: `scratchpad/wt-impl`
- Seed: spec → `context/engineer-review-domain.md`(1라운드) · `context/review-verdict-round1.md` → `search/glossary.md` §3-1·3-2 · `docs/conventions/blog-writing.md` → `CategoryLexiconAdapter.kt` · `SearchAttractionService.kt` 대조
- 범위: G14 와 D-1~D-6 반영 확인, SR-6 새 용어 정합. 다른 차원은 보지 않았다.

## 판정: REVISE (2건, 차단 없음)

## 1라운드 반영 확인

| 항목 | 반영 위치 | 결과 |
|---|---|---|
| D-1 멱등 불변식 거짓 | SR-1.3(`spec.md:21`), SR-2.1·2.2(`:24-25`), SR-7.1 `<PARASITE>` 픽스처(`:65`), SR-7.3 회귀 주입(`:72`) | 반영. 「값 하나에 정규화는 한 번」이 원칙으로 적혔다 |
| D-2 통합 검색 FE 정규화가 다른 BC 로 샘 | SR-2.2(`:25`) `UnifiedSearchPage.tsx` 미변경, SR-7.1 `List<String>` 케이스(`:66`) | 반영 |
| D-3 목록 overview 계약 | SR-1.2 KDoc 문구(`:20`) | 반영 |
| D-4 걸린 조건 ≠ 실제 질의 | SR-5.1 순수 함수 정의(`:39-47`), 경계 케이스(`:68`) | 반영. 행사 분류에서 속성 제외(`:43`)가 glossary §3-1 속성 패싯 정의(`search/glossary.md:75`)와 맞는다 |
| D-5 / G14 「원문」 이중 의미 | 결정 ⑤(`:4`) 「원래 검색어로 재검색」, SR-5.3(`:51`) 「원래 검색어 검색 파라미터」, SR-5.5(`:53`) glossary 두 행 | 반영. 남은 「원문」(`:2,9,20,24,25,64,71,74,85`)은 모두 TourAPI 원천 텍스트 뜻이다. 검색어 쪽에는 더 쓰지 않는다 |
| D-6 「개요 없음」 판정 두 벌 | Out of Scope(`:85`) | 반영(후속 후보) |

glossary 두 행(`correctedKeyword`·`exact`)은 아직 `search/glossary.md` §3-2(`:99-113`)에 없다. SR-5.5 가 구현 산출물로 정했으므로 지금 없는 것은 결함이 아니다.

## 체크리스트

| # | 항목 | 결과 |
|---|---|---|
| 1 | BC 경계·누출 | 통과 — SR-6 은 search BC 안에서 place 코드표(읽기)와 search 색인을 교집합한다. place 원천은 바꾸지 않는다 |
| 2 | Glossary 존재 | 통과 — `search/glossary.md` |
| 3 | 스펙 어휘 ↔ glossary | **D2-1** — 「질의 이해」가 glossary 표제어 「쿼리 언더스탠딩」과 다르고, 「분류 사전」이 사전에 없다 |
| 4 | `Avoid:` 동의어 | 통과 — glossary 의 피할 말(「정제 검색어」·「카테고리 부스트」·「질의 사전」·「주변 관광지」)을 쓰지 않는다 |
| 5 | 코드와의 어휘 일관 | 통과 — 「분류 사전」은 코드 로그 문구와 같다(`CategoryLexiconAdapter.kt:62` 「분류 사전 갱신」) |
| 6 | 불변식 명시·강제 가능 | **D2-2** — SR-6.3 「색인에 문서가 1건 이상인 코드만」의 언어 단위와 집합 완전성이 정해지지 않았다 |
| 7 | 도메인 이벤트 | 해당 없음 |
| 8 | 교차 집계 직접 참조 | 통과 — 사전 어댑터가 색인 어댑터를 직접 부르지 않고 application 한 곳에서 교집합(`spec.md:58`) |
| 9 | VO / Entity | 통과 — `QueryIntent.Lexicon` 은 값 객체 그대로 |

## 발견

### D2-1 SR-6 이 glossary 표제어 대신 「질의 이해」를 쓰고, 「분류 사전」이 사전에 없다 (REVISE · 3번)
- 근거
  - glossary 표제어는 「쿼리 언더스탠딩」이다(`search/glossary.md:106`).
  - 스펙은 같은 단계를 「질의 이해」로 쓴다(`spec.md:6,55,56,57,85`).
  - 레포 표기 규칙은 「질의 이해」를 버리고 「쿼리 언더스탠딩」을 쓰라고 한다(`docs/conventions/blog-writing.md:54,70`, 원장 `docs/changelog/harness-changelog.md:35`).
  - glossary 의 `Avoid` 칸에 올라 있지는 않아서 BLOCK 이 아니다.
- 근거
  - 「분류 사전」(`spec.md:57,81`)은 SR-6 의 주어인데 §3-2 에 행이 없다.
  - 이번 개정으로 불변식(색인 문서 1건 이상인 코드만)이 생겼다.
  - 「질의 사전」(옛 이름, `search/glossary.md:105`)과도 헷갈리기 쉽다.
- 수정안
  1. SR-6 제목·본문, 개정 머리말, Out of Scope 의 「질의 이해」를 「쿼리 언더스탠딩」으로 바꾼다.
  2. SR-5.5 에 셋째 행을 더한다. 문안은 「분류 사전 — place 분류 코드표(`lclsSystmCode2`) 이름 → 코드 사전(`CategoryLexiconPort`). 쿼리 언더스탠딩이 패싯 필터를 만들 때 쓴다. attractions 색인에 그 언어 문서가 1건 이상인 코드만 담는다. 10분 주기로 갱신한다」.
  3. 피할 말 칸에는 「질의 사전(쿼리 벡터 캐시의 옛 이름)과 다르다」를 적는다.

### D2-2 SR-6.3 의 「색인에 있는 코드 집합」이 언어 단위와 완전성을 정하지 않았다 (REVISE · 6번)
- **언어 단위**
  - 사전은 언어별로 들고 있다. 그런데 이름은 언어를 가로질러 넣는다(`CategoryLexiconAdapter.kt:66-85`, 영문 이름도 같은 코드로 옮겨진다). 조회는 요청 언어로 한다(`SearchAttractionService.kt:91` `lexicon(query.lang)`).
  - 질의는 문서 `lang` 으로 갈린다. 국문 문서에만 있는 코드가 영문 사전에 남으면 `lang=en` 질의가 그 코드로 좁혀져 0건이 된다. 같은 증상이 언어만 바뀌어 남는다.
  - 스펙의 「attractions 색인의 `lclsSystm1~3` 값 집합」(`spec.md:58`)은 언어별 집합인지 전체 집합인지 적지 않았다. 그런데 배포 뒤 확인은 `lang=en&keyword=temple stay` 의 `total > 0` 을 요구한다(`spec.md:60`).
- **완전성**
  - 집합을 terms 집계로 받으면 버킷 수 상한(기본 10)에 잘린 부분 집합이 올 수 있다. 코드표는 ko 315 · en 302 행이다(`place/CLAUDE.md:58`).
  - 잘린 집합과 교집합하면 유효한 코드가 사전에서 조용히 빠진다. 「분류를 좁혀 주던 질의」가 경고 없이 넓어지는 것이고, 이 스펙이 막으려는 「조용히 조건을 바꾸기」의 반대 방향 판이다.
  - 빈 집합(색인 교체 중 등)도 같은 문제다. 지금 어댑터는 빈 코드표를 실패로 본다(`CategoryLexiconAdapter.kt:57-59`). 색인 집합에는 같은 규칙이 없다.
- **수정안**: SR-6.3 에 두 문장을 넣는다.
  1. 「집합은 언어별로 받고, 그 언어 사전과만 교집합한다.」
  2. 「집합이 비었거나 집계가 잘렸으면(`sum_other_doc_count > 0`) 받지 못한 것으로 보고 들고 있던 사전을 쓴다.」
- **SR-6.5 테스트에 더할 것**
  - 국문에만 있는 코드는 영문 사전에서 빠진다.
  - 잘린 집계·빈 집합이면 이전 사전을 유지한다.

## 참고(판정 무관)
- 스펙 1행 source 목록의 컨트롤러 경로는 `presentation/attraction/AttractionSearchController.kt` 다. 실제 경로는 `search/app/src/main/kotlin/com/kgd/search/presentation/search/controller/AttractionSearchController.kt` 다(클래스 `:26`). 본문 인용 `:44-72` 는 맞다.

VERDICT: REVISE
