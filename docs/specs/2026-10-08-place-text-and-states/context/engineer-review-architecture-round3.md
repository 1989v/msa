# Engineer Review — architecture (3라운드, 마지막)

- 대상: `docs/specs/2026-10-08-place-text-and-states/spec.md` (2라운드 심판 편집 E1~E13 반영본)
- 작업 트리: `wt-impl`
- 범위: E7 로 바뀐 SR-6.3 의 포트·UseCase 재배치가 확정안인지, 레이어 표준(`docs/conventions/package-structure.md`, ADR-0083, 게이트 `build.gradle.kts:276-479` `verifyLayerDependencies`)에 맞는지 확인한다. 이미 판정된 항목(A2-1~A2-3, `AttractionSearchPort` 가 `search:domain` 에 있는 문제, ADR-0090 `:158` 개정 여부)은 다시 열지 않는다.

## 판정: SHIP (새 결함 0건)

## 1. 확정안인가

`spec.md:64` 가 이제 위치·이름·시그니처·소유를 모두 못박는다. 2라운드에 있던 「위치는 구현 단계에서」 같은 미정 문구는 남아 있지 않다.

| 요소 | 스펙 문안 (`spec.md:64`) | 확정 여부 |
|---|---|---|
| 코드표 포트 | `application/attraction/port/CategoryCodePort.kt`, `fun codes(): List<CategoryCode>`, 같은 파일에 `data class CategoryCode(lang, code, depth, name)` | 확정 |
| 코드표 어댑터 | `CategoryLexiconAdapter` → `CategoryCodeAdapter`, place 조회만 맡음 | 확정 |
| 색인 집합 포트 | `AttractionSearchPort.indexedCategoryCodes(bucketSize: Int): Map<String, Set<String>>`, 구현 `AttractionSearchAdapter` | 확정 |
| 사전 UseCase | `application/attraction/usecase/CategoryLexiconUseCase`(인터페이스, `fun lexicon(lang: String?): QueryIntent.Lexicon`) | 확정 |
| 사전 서비스 | `application/attraction/service/CategoryLexiconService`. 캐시(`AtomicReference`), `@Scheduled(initialDelay = 5_000, fixedDelay = 10 * 60 * 1000)`, 교집합, 실패 처리를 맡음 | 확정 |
| 소비자 | `SearchAttractionService`·`SearchUnifiedService` 가 포트 대신 UseCase 를 주입 | 확정 |
| 교집합 순서 | 행을 먼저 거르고 `Lexicon.of` (`spec.md:62`) | 확정 |
| 바꿀 곳 | KDoc · `SearchApplication.kt:23` 주석 · 테스트 대역 4곳 (`spec.md:65`) | 확정. grep 결과 `CategoryLexiconPort` 참조는 main 4곳 + test 4곳뿐이고 스펙 목록과 같다 |

## 2. 레이어 표준 대조

| 규칙 | 근거 | 결과 |
|---|---|---|
| 규칙 6: Outbound Port 는 `application/{묶음}/port` | `package-structure.md:58-64`. `CategoryCodePort` 는 기존 `CategoryLexiconPort` 와 같은 `application/attraction/port/` 에 둔다 | 맞음 |
| 규칙 6: 포트 시그니처에 프레임워크 타입 금지 | `CategoryCode` 는 순수 data class. `indexedCategoryCodes` 는 `Int` → `Map<String, Set<String>>` 이다. OpenSearch 타입이 새지 않는다 | 맞음 |
| 규칙 7: UseCase 는 인터페이스, 구현은 `service/` | `package-structure.md:69-72`. `usecase/CategoryLexiconUseCase` + `service/CategoryLexiconService` | 맞음 |
| 규칙 8 · 게이트 ①: application 은 infrastructure·기술 클라이언트를 import 하지 않는다 | `build.gradle.kts:327-336` 의 금지 목록에 `org.springframework.scheduling.` 와 `java.util.concurrent.` 는 없다. `:325-326` 은 인메모리 캐시가 application 정책이라고 명시한다. 서비스가 쥐는 것은 포트 둘과 `QueryIntent`(domain) 뿐이다. RestClient(`CategoryLexiconAdapter.kt:9`)는 어댑터에 남는다 | 맞음 |
| 어댑터 간 호출 금지 | 코드표 어댑터와 색인 어댑터가 서로를 부르지 않는다. 교집합은 application 한 곳에서 만든다 | 맞음 |
| 서비스가 UseCase 를 주입 | 레이아웃 주석 「Port 만 주입」(`package-structure.md:31`)과 다르게 보일 수 있다. 그러나 게이트 ④⑤(`build.gradle.kts:419-459`)는 presentation 만 검사하고, 같은 모양의 선례가 있다: `SearchAttractionService.kt:34`(`ResolveQueryVectorUseCase`), `SearchUnifiedService.kt:14`(`SearchAttractionUseCase`). 2라운드에서 이미 판정한 선례다 | 맞음 |
| application `@Scheduled` | 선례 `InventoryReconciliationService.kt:18`(레이어 견본 모듈). `@EnableScheduling` 은 `SearchApplication.kt:24` 에 있고 서비스도 `search:app` 에 있다 | 맞음 |
| 순환 의존 | 사전 서비스 → 포트 둘. 소비자 → UseCase 하나. 사전 서비스는 소비자를 모른다 | 없음 |
| 프록시 | 서비스에 `@Transactional`·`@Cacheable` 이 없다. 규칙 7 주의문(`package-structure.md:76-82`)의 JDK 프록시 위험은 해당하지 않는다 | 해당 없음 |
| 컴파일 영향 | `AttractionSearchPort` 의 직접 구현은 `AttractionSearchAdapter.kt:61` 하나다. 다른 테스트 대역은 `mockk<AttractionSearchPort>()` 라서, 추상 메서드를 하나 더해도 깨지는 곳이 없다 | 영향 없음 |

## 3. Deletion Test

- `CategoryLexiconService`: 지우면 캐시·10분 갱신·교집합·세 갈래 폴백이 소비자 두 곳(`SearchAttractionService.kt:91`, `SearchUnifiedService.kt:29`)으로 흩어진다. 존재 이유가 있다.
- `CategoryLexiconUseCase`: 구현은 하나다. 그래도 규칙 7(`package-structure.md:69`)이 단일 구현에도 인터페이스를 요구하므로 가상의 심이 아니다.
- `CategoryCodeAdapter`: 조회만 하는 얇은 어댑터다. 그러나 외부 시스템(place) 경계라 얕은 통과 계층으로 보지 않는다.
- 이름: `search/glossary.md` 에 「분류 사전 → `CategoryLexiconUseCase`」 행을 더한다(`spec.md:55`). 용어집에 있는 이름이다.

## 4. 참고 (결함 아님, 판정에 반영하지 않음)

- `indexedCategoryCodes` 의 실패 계약(잘리면 예외)은 `CategoryLexiconService` 가 기대는 동작이다. 그런데 스펙은 이 계약을 어댑터 테스트(`spec.md:70`)에만 적었다. 이 포트의 다른 메서드는 모두 KDoc 으로 계약을 적어 두었다(`AttractionSearchPort.kt:18-35`). 구현할 때 새 메서드의 KDoc 에 「`bucketSize` 는 받을 수 있는 코드 수의 상한, `sum_other_doc_count > 0` 이면 예외」를 한 줄 적으면 된다. 스펙을 고칠 필요는 없다.
- 어댑터의 `search.category-lexicon.enabled`(`CategoryLexiconAdapter.kt:22`)는 레포 어디에서도 설정되지 않는다. 어댑터에 남아 꺼졌을 때 빈 목록을 돌려주면, 서비스의 「코드표 못 받음」 경로와 결과가 같다. 위치를 정하지 않아도 동작은 달라지지 않는다.

VERDICT: SHIP
