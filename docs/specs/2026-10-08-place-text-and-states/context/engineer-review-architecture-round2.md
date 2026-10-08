# Engineer Review — architecture (2라운드)

- 대상: `docs/specs/2026-10-08-place-text-and-states/spec.md` (1라운드 심판 편집 반영본 + SR-6 신설)
- 작업 트리: `wt-impl`
- 범위: 1라운드 G1·G6·G10 반영 확인, 신설 SR-6 을 레이어 표준(`docs/conventions/package-structure.md`, ADR-0083)으로 검토.
- 지식베이스(읽기 전용): `wiki/concepts/hybrid-search-local-embedding.md:166-182` 「의도는 필터로 — 원천이 정한 뜻이라 문서 쪽 신호가 확실하다」. SR-6 은 이 원칙을 바꾸지 않고, 문서 쪽 신호가 0인 코드만 뺀다. 충돌하지 않는다.

## 판정: REVISE (이슈 3건: 중 2건, 하 1건)

## 1라운드 반영 확인

| 묶음 | 확인 | 근거 |
|---|---|---|
| G1 정규화는 한 번, 원문을 받는 곳에서만 | 반영됨 | `spec.md:20`(서버 목록 요약) · `:21`(통합 검색 코드 불변, 이중 정규화 사유 명시) · `:24`(패널만 FE 정규화, 카드는 그대로) · `:25`(통합 FE 불변 + 원칙 문장). 회귀 주입 `:72` 「카드에 FE 재정규화 추가 → `<PARASITE>` 빨강」으로 원칙을 검사가 지킨다 |
| G6 목록 overview 계약 | 반영됨 | `spec.md:20` KDoc 문안. 현재 KDoc `SearchAttractionUseCase.kt:83` 「목록 응답은 200자 요약 — 전문은 단건 조회로」를 바꿀 대상으로 정확히 짚었다. `escapeHtml` 의 `'` 미이스케이프는 `spec.md:19` |
| G10 패키지 | 반영됨 | `spec.md:19` → `com.kgd.search.domain.attraction.model`. `package-structure.md:21-22`(`domain/{entity}/model`)와 맞다 |

그 밖에 `spec.md:35` 의 `AttractionSearchDocumentTest.kt:61` 은 실제로 `attributes.parserVersion shouldBe 1` 이다. 심판 NOTES 의 지적이 반영됐다.

## SR-6 레이어 검토

### 현재 구조 (사실)

- 소비자 계약: `CategoryLexiconPort.lexicon(lang): QueryIntent.Lexicon`(`application/attraction/port/CategoryLexiconPort.kt:12-14`). 다 만든 **사전 객체**를 돌려준다.
- 구현: `infrastructure/client/CategoryLexiconAdapter.kt` 가 세 가지를 한꺼번에 한다.
  - place 코드표 조회(`:74-78`)
  - 사전 조립 `Lexicon.of`(`:81-85`)
  - 캐시·주기 갱신·실패 시 이전 사전 유지(`:37`, `:50-63`)
- 소비자: `SearchAttractionService.kt:35,91`, `SearchUnifiedService.kt:16,29`.
- 색인 쪽 포트: `AttractionSearchPort`(`search/domain/.../attraction/port/AttractionSearchPort.kt:12`), 구현은 `AttractionSearchAdapter.kt:55`.

SR-6.3(`spec.md:58`)은 「교집합은 application 한 곳에서, 위치는 구현 단계에서」라고 정했다. 방향은 규칙 8(`package-structure.md:84-88`)과 규칙 6(`:58-64`)에 맞다. 어댑터가 다른 어댑터를 부르지 않게 하는 것이 옳다. 다만 아래 두 가지 때문에 **위치를 구현 단계로 미룰 수 없다**. 지금 포트 계약으로는 application 에서 올바른 교집합을 만들 수 없다.

### A2-1 (중) 교집합은 사전을 만들기 **전**, 코드표 행에 걸어야 한다. 그러려면 포트 계약과 캐시 소유가 함께 옮겨 와야 한다

- 코드 근거: `QueryIntent.Lexicon.of`(`search/domain/.../query/model/QueryIntent.kt:183-193`)는 이름이 겹치면 **깊은 코드가 이기고**(`:190` `depth >= existing.second`), 진 코드는 그 이름에서 사라진다. `Lexicon` 은 코드 목록을 밖에 내놓지 않는다(`:172` `private val byName`).
- 결과: application 이 지금 계약대로 다 만든 `Lexicon` 을 받아 사후에 걸러내면 문제가 생긴다. 색인 0건인 깊은 코드(예: 템플스테이 `EX040100`)가 이름을 가져간 경우, 그 열쇠가 통째로 빠진다. 같은 이름을 가진 얕은 코드에 문서가 있어도 그 코드로 돌아가지 않는다. 행을 먼저 거르고 `Lexicon.of` 를 부르면 얕은 코드가 그 이름을 갖는다. 두 순서는 결과가 다르다. 그런데 SR-6 의 테스트(`spec.md:60`)는 「사전에서 빠진다」만 보므로 이 차이를 잡지 못한다.
- 따라서 교집합을 application 에 두려면 다음 둘이 함께 바뀐다.
  1. 포트가 사전이 아니라 **코드표 행**을 돌려줘야 한다. 예: `CategoryLexiconPort` 를 `CategoryCodePort.codes(): List<CategoryCode>` 로 바꾸고, 어댑터는 조회만 한다.
  2. 캐시와 「못 받으면 이전 것, 한 번도 못 받았으면 코드표 전체」 규칙(`spec.md:58`)도 application 으로 온다. 지금 그 상태는 어댑터 안(`CategoryLexiconAdapter.kt:37,53-61`)에 있다.
- 레이어 표준에 맞는 자리(선례 있음):
  - `application/attraction/usecase/CategoryLexiconUseCase`(인터페이스, `lexicon(lang)`)를 둔다.
  - 구현은 `application/attraction/service/CategoryLexiconService` 다. `@Scheduled` 10분 갱신, 캐시, 교집합, 폴백을 맡는다.
  - 소비자 두 곳은 포트 대신 이 UseCase 를 주입한다.
  - 선례 1: 서비스가 다른 UseCase 인터페이스를 주입한다(`SearchAttractionService.kt:34` `ResolveQueryVectorUseCase`, `SearchUnifiedService.kt:14` `SearchAttractionUseCase`).
  - 선례 2: application 서비스에 `@Scheduled` 를 둔다(`inventory/.../application/inventory/service/InventoryReconciliationService.kt:18`, 레이어 견본 모듈).
  - application 클래스가 아웃바운드 포트를 직접 구현하는 방식(포트 이름을 그대로 두고 서비스가 `: CategoryLexiconPort`)은 피한다. 규칙 6(포트 → infrastructure 어댑터)의 뜻을 뒤집는다.
- 수정안: SR-6.3 의 「위치는 구현 단계에서 정한다」를 위 구조로 확정한다. 문장 예시는 다음과 같다.
  > 교집합은 코드표 **행**에 걸고 그 뒤에 `Lexicon.of` 로 사전을 만든다(이름 충돌 해소가 남은 코드 기준으로 다시 돌게). 어댑터는 코드표 행만 돌려주고(`CategoryCodePort`), 캐시·10분 갱신·폴백·교집합은 `application/attraction/service` 의 사전 서비스(UseCase 인터페이스 뒤)가 갖는다.

  SR-6.5 테스트에 한 줄을 더한다: 「같은 이름을 가진 깊은 코드가 색인 0이고 얕은 코드가 색인 1 이상이면, 그 이름은 얕은 코드로 필터된다」. 사후 필터로 회귀하면 이 테스트가 빨개진다.

### A2-2 (중) 색인 코드 집합은 언어별이어야 한다 — 포트 시그니처에 `lang` 이 들어가야 한다

- 코드 근거: 사전은 언어별로 따로 만든다(`CategoryLexiconAdapter.kt:80-85` `langs.associateWith`). 질의 이해가 고른 분류 필터는 `lang` term 필터와 **함께** 걸린다(`AttractionSearchAdapter.kt:522-524` lang, `:545-547` facets).
- 결과: SR-6.3 은 「`lclsSystm1~3` 값 집합」을 언어 구분 없이 하나로 적었다(`spec.md:58`). 어떤 코드의 문서가 ko 에만 있으면 언어 없는 합집합을 통과한다. 그러면 en 사전에 남고, `lang=en&keyword=temple stay` 는 그대로 0건이다. SR-6.5 의 배포 뒤 확인(`spec.md:60`)이 ko·en 둘 다를 요구하므로, 이 차이가 곧 합격·불합격을 가른다.
- 수정안: 색인 조회 포트를 언어별 집합으로 정한다. 예: `AttractionSearchPort.indexedCategoryCodes(): Map<String, Set<String>>`(lang → 코드), 구현은 `lang` × `lclsSystm1~3` terms 집계. 교집합은 언어별 사전마다 그 언어의 집합으로 건다. SR-6.5 에 「ko 문서만 있는 코드는 ko 사전에 남고 en 사전에서 빠진다」를 더한다.
- 참고(이번 스펙 범위 밖): `AttractionSearchPort` 는 `search:domain` 의 `domain/attraction/port` 에 있다. 문서화된 예외는 `product/port` 하나뿐이다(`package-structure.md:104-108`). 기존 변종에 메서드 하나를 더하는 것은 최소 수정이라 이번에는 문제 삼지 않는다. 포트를 옮기는 것은 별도 정리 대상이다.

### A2-3 (하) 사전의 원본·소유가 바뀌는데, 따라 바꿀 문서와 테스트 대역이 스펙에 없다

- `CategoryLexiconPort.kt:9` KDoc 「못 받으면 빈 사전을 준다」 → 실제로는 이전 사전을 유지하고, 처음이면 코드표 전체를 쓴다. 원본도 「place 코드표 ∩ attractions 색인」으로 바뀐다.
- `SearchApplication.kt:23` 주석 「분류 사전 주기 갱신 (CategoryLexiconAdapter)」 → 갱신 주체가 application 서비스로 옮긴다.
- 포트 계약이 바뀌면 다음 테스트 대역 넷이 같이 바뀐다.
  - `SearchAttractionServiceTest.kt:52`
  - `SearchUnifiedServiceTest.kt:38`
  - `UnifiedAttractionRequests.kt:32`
  - `AttractionReindexCaptureTest.kt:183`
- 수정안: SR-6 에 「바꿀 곳」 한 줄로 위 여섯 곳을 적는다. 그러면 「Existing Code to Leverage」(`spec.md:81`)의 `CategoryLexiconAdapter.kt:50-86` 이 무엇으로 쪼개지는지도 드러난다.

## 통과한 항목

- 의존 방향: SR-6 이 정한 「사전 어댑터가 검색 어댑터를 직접 부르지 않는다」는 규칙 8과 맞다. application → port ← infrastructure 방향이 유지된다.
- 순환 의존: 없다. 사전 서비스는 포트 둘을 부르고, 소비자 서비스는 UseCase 하나를 부른다.
- 트랜잭션: 해당 없다(읽기와 메모리 캐시뿐이다).
- 질의 경로 지연: 갱신은 10분 주기 백그라운드에서 돈다(`CategoryLexiconAdapter.kt:45-50` 의 「질의 경로에 네트워크를 두지 않는다」를 유지). 질의마다 집계하거나 사전을 다시 만들지 않으므로 ADR-0025 의 지연 예산에 영향이 없다. A2-1 의 구조도 캐시를 그대로 갖고 가므로 이 성질을 지킨다.
- 상수 금지: 문서 수 하한을 두지 않는다(`spec.md:58`). YAGNI 에 맞다.
- SR-1~SR-5 의 레이어: 1라운드 판단과 같다. 새 포트·심이 없다.

## Deletion Test

- 사전 서비스(신규, A2-1 안): 지우면 캐시·폴백·교집합이 소비자 두 곳(`SearchAttractionService`, `SearchUnifiedService`)으로 흩어진다. 존재 이유가 있다.
- 코드표 어댑터: 조회만 하는 얇은 어댑터지만, 외부 시스템(place) 경계라 포트 → 어댑터 구조가 표준이다(규칙 6). 얕은 통과 계층(shallow pass-through)에 해당하지 않는다.

VERDICT: REVISE
