# Engineer Review — security (1라운드)

대상: `docs/specs/2026-10-08-place-text-and-states/spec.md` (S2-1·S2-4). 세션 결정 ①~⑥은 다시 다루지 않았다.
작업 트리: origin/main a05ab2765 (wt-impl).

## 인용 대조 (spec → 코드)
일치: `AttractionPageRenderer.kt:20-23`, `AttractionJsonLdParityTest.kt:90,92`, `SearchAttractionService.kt:74,83-87,125,169,226`, `SearchUnifiedService.kt:61,73`, `AttractionSearchController.kt:46-72`, `copy.mjs:844-860`, `placeView.ts:203,206`, `AttractionSeoText.kt:43-57`, `AttractionAttributeParser.kt:26,113`, `PlacePage.tsx:1375-1379,1533,1656`, `UnifiedSearchPage.tsx:230`. 어긋난 인용은 없다.

## 체크리스트
| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | 위협 모델링 | 해당 부분만 | 새로 생기는 공격면은 둘이다. 원천 HTML 을 정규화하는 위치(Tampering/XSS)와 `exact` 파라미터다. 아래 R1·R2 |
| 2 | 인증/인가 경계 | 통과 | 익명 공개 읽기 API 에 Boolean `exact` 만 더한다(SR-5.3). 권한 경계 변경 없음 |
| 3 | 민감 데이터 흐름 | 통과 | 관광지 공개 텍스트뿐이다. PII·토큰 없음. 계측 ref(SR-5.1)는 기존 trigger 규약 재사용 |
| 4 | 입력 검증 바운더리 (XSS) | **REVISE** | R1(이중 디코드), R2(API 텍스트 계약) |
| 5 | 서비스 간 통신 | 통과 | SR-1.3 은 같은 JVM 안의 UseCase 호출(`SearchUnifiedService.kt:61`). 통신 변경 없음 |
| 6 | 시크릿 | 해당 없음 | — |
| 7 | 암호화/해싱 | 해당 없음 | — |
| 8 | 감사 로깅 | 해당 없음 | `exact=true` 면 `correctionCounter`(`SearchAttractionService.kt:86`)가 안 올라간다. 지표 의미는 맞다 |
| C1 | PCI-DSS | 해당 없음 | — |
| C2 | 주문/재고 권한 | 해당 없음 | — |
| C3 | Rate limit / abuse | 통과 | `exact=true` 는 `correct()` 를 건너뛰므로 요청당 비용이 줄어든다. 새 증폭 경로 없음 |

현재 렌더 지점은 모두 React 텍스트 노드다(`PlacePage.tsx:1533,1656`, `UnifiedSearchPage.tsx:230`). place·search 화면에는 `dangerouslySetInnerHTML` 이 없다(grep: blog·tech 에만 있음). 그래서 지금 바로 터지는 XSS 는 없다.

## 발견

### R1. 정규화를 서버와 FE 가 두 번 거는데 `sourceText` 는 멱등이 아니다 — 원천의 `&lt;…&gt;` 가 두 번째 단계에서 태그로 지워진다
- 스펙 결정: SR-1.2 에서 서버가 목록 overview 를 정규화한다. SR-1.3 은 이미 정규화된 그 overview(`SearchUnifiedService.kt:73` 가 `searchAttraction.execute` 결과를 받는다)에 한 번 더 건다. SR-2.1·2.2 는 FE 가 같은 값에 또 건다. SR-2.2 는 「함수는 멱등이어야 한다」를 테스트로 고정하겠다고 적었다.
- 코드: `copy.mjs:849` 는 태그를 지운 **뒤에** `copy.mjs:850` 에서 `&lt;`→`<` 로 디코드한다. 서버 사본 `AttractionSeoText.kt:48-49` 도 순서가 같다. 그래서 첫 결과에 생긴 `<…>` 를 두 번째 호출이 태그로 보고 지운다. `&amp;lt;` 는 호출할 때마다 한 단계씩 더 풀린다(이중 디코드).
- 실데이터에 이 경우가 있다: `s1-6-hub-ui-check.md:16` `K-movie &lt;PARASITE&gt; - A town…`
  - 1회 정규화: `K-movie <PARASITE> - A town…`
  - 2회 정규화: `K-movie  - A town…` — 작품명이 사라진다
  - 따라서 SR-2.2 의 멱등 테스트는 이 입력에서 실패한다. 이 입력을 피한 픽스처로만 통과시키면 테스트가 사실과 다른 성질을 고정하게 된다.
- 보안 측면: 화면이 React 텍스트 노드라 지금은 실행 경로가 없다. 다만 「어느 단계가 원문을 디코드하는가」가 둘 이상이 되면, 앞단의 검사를 뒷단 디코드가 무력화하는 고전적인 필터 우회 모양이 된다. 이후 누군가 이 값을 HTML 로 꽂으면 그대로 구멍이 된다.
- 수정안 — 경로마다 정규화는 **한 번만** 건다:
  1. 목록 overview·통합 summary 는 서버(SR-1.2)만 정규화한다. SR-1.3 은 「정규화된 overview 를 그대로 쓰고, 주소 대체(`?: it.address`)만 유지」로 고친다.
  2. FE 의 `overviewText` 는 원문이 오는 경로에만 쓴다. 상세 `findById`(summarize=false)가 그 경로다. 허브 카드·패널·통합 검색은 서버 값을 그대로 그린다. 패널(`:1533`)이 상세 원문을 받는다면 그 경로만 FE 정규화를 유지한다.
  3. SR-2.2 의 멱등 테스트를 지운다. 대신 `K-movie &lt;PARASITE&gt;` 픽스처가 서버 → FE 전 경로를 거친 뒤 화면 텍스트가 `K-movie <PARASITE>` 인지 확인하는 테스트를 vitest·Kotest 에 하나씩 둔다. SR-6.3 회귀 주입 목록에 「이중 정규화 재도입 → 빨강」을 더한다.

### R2. 공개 JSON 의 `overview`/`summary` 계약이 「원천 HTML 조각」에서 「디코드된 평문(이스케이프 안 됨)」으로 바뀌는데 스펙에 적혀 있지 않다
- 스펙 결정: SR-1.2·1.3 으로 목록 API `overview` 와 통합 `summary` 가 디코드된 평문이 된다. 이 API 는 llms.txt 로 외부에 공개돼 있다(`prerender-seo.mjs:1731-1732`).
- 코드: `AttractionSeoText.kt:40-42` 주석이 「출력 직전에 escapeHtml 을 거쳐야 한다 — 디코드된 `<script>` 는 이 단계에서 글자일 뿐이다」라고 적는다. 정규화 결과는 escape 전 값이라 `&lt;script&gt;` 원천이 응답에 `<script>` 글자로 나간다. 지금의 내부 소비자는 안전하다. React 텍스트 노드로 그리고, `prerender-seo.mjs:996` 은 값이 있는지만 본다.
- 수정안:
  - SR-1 에 한 줄을 넣는다: 「목록 `overview`·통합 `summary` 는 HTML 이 아닌 평문이며 이스케이프되지 않았다. HTML 로 내보내는 소비자는 반드시 escape 한다」. `search/CLAUDE.md` 또는 API 문서에도 같은 문장을 둔다.
  - SR-1.1 로 `AttractionSeoText` 가 public 도메인 객체가 된다. `escapeHtml`(`AttractionSeoText.kt:67-71`)은 `'` 를 이스케이프하지 않으므로 「큰따옴표 속성·본문 전용」이라고 KDoc 에 적는다. 지금은 큰따옴표 속성만 쓴다(`AttractionPageRenderer.kt:130-152`). 공개 범위가 넓어지면 홑따옴표 속성에 쓰일 수 있다.

## 판정
비차단 2건. R1 은 실데이터 손실로 이어지고 스펙이 세운 테스트 전제(멱등)가 틀린 것이라 구현 전에 고쳐야 한다. R2 는 문서 계약 보강이다.

VERDICT: REVISE
