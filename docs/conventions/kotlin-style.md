# Kotlin 코드 스타일 & 리팩터링 가이드

> 언어 차원의 작성·정리 기준을 정의한다. 레이어 네이밍 / DI 방향은 `docs/conventions/code-convention.md`,
> 영속성은 `docs/conventions/jpa-persistence.md`, 로깅은 `docs/conventions/logging.md` 를 따른다.
> 대상은 blocking Spring MVC + JPA 스택의 Kotlin 코드다 (reactive / coroutine 전용 관용구는 본 플랫폼 대상 아님).

## 1. 기본 원칙

- **KISS / YAGNI**: 동작하는 가장 단순한 형태를 먼저 작성한다. 현재 요구에 없는 일반화·설정·확장점은 만들지 않고, 사용하지 않는 코드는 제거한다.
- **DRY**: 동일한 로직·결정이 여러 곳에 중복되면 한 곳으로 모은다. 단, 우연히 모양만 같은 코드를 무리하게 합치지 않는다 (잘못된 추상화의 비용이 중복보다 크다).
- **단일 책임(SRP)**: 한 클래스·함수는 한 가지 변경 이유만 갖는다.
- **보이스카우트 규칙**: 수정한 코드는 손댄 범위 안에서 발견한 코드 스멜을 함께 정리해 처음보다 깔끔하게 둔다. 단, 동작은 보존한다 (§9).

추상화는 실제 중복·복잡도를 줄일 때만 도입한다. 아래는 기본적으로 만들지 않는다.

| 만들지 않는 것 | 이유 |
|---|---|
| 구현체가 하나뿐인 interface | 추상화 비용만 발생 (YAGNI) |
| 미래 요구를 가정한 확장점 / 범용 설정 | 현재 요구와 무관, 흐름만 흐려짐 |
| 한 곳에서만 쓰는 util/helper, 단순 생성용 factory | 이동 비용만 증가 |
| 깊은 상속 계층 | 변경 영향 추적 곤란 |

단, 인바운드 포트(`UseCase`)·아웃바운드 포트(`Port`)는 구현체가 하나라도 Clean Architecture 경계를 만드는 의도적 추상화이므로 예외다 (`docs/architecture/00.clean-architecture.md`).

## 2. 네이밍

이름이 의도를 드러내야 한다. 레이어별 클래스 suffix 는 `code-convention.md` §1 이 정의하고, 여기서는 언어 차원만 다룬다.

| 대상 | 규칙 | 예 |
|---|---|---|
| Package | 소문자, underscore 금지 | `com.kgd.order.domain` |
| Class / Interface | UpperCamelCase | `OrderService` |
| Function / 지역 변수 | lowerCamelCase, 함수는 동사로 시작 | `cancelOrder`, `findById` |
| 상수 (top-level·companion `val`) | SCREAMING_SNAKE_CASE | `DEFAULT_PAGE_SIZE` |
| Boolean | 질문형으로 읽히게 | `isActive`, `hasStock`, `canCancel` |
| 약어 | 2글자는 전부 대문자(`IOStream`), 3글자+는 첫 글자만(`HttpClient`) | — |

- `data`, `info`, `manager`, `processor` 같은 광의 네이밍을 피하고 책임을 드러내는 명사를 쓴다.
- 보편 약어(`id`, `url`)만 줄이고 도메인 용어는 줄이지 않는다.

## 3. 불변성과 Null 안전성

가변 상태와 null 은 기본을 안전한 쪽에 두고, 필요할 때만 의도적으로 연다.

불변성 규칙:

- 변수·프로퍼티는 `val` 을 기본으로 한다. `var` 는 변경이 필요한 이유가 분명할 때만 쓴다.
- 컬렉션은 읽기 전용 인터페이스(`List`/`Set`/`Map`)로 노출하고, 가변 컬렉션은 노출 범위를 좁힌다.
- DTO·VO 는 `data class` 로 만들고, 선택 필드는 `= null` 또는 의미 있는 기본값을 준다.

```kotlin
data class OrderView(
    val id: Long,
    val orderNo: String,
    val memo: String? = null,
    val discountRate: Int = 0,
)
```

Null 안전성 규칙:

- nullable 타입은 "없을 수 있음" 이 도메인상 참일 때만 쓴다.
- `?.` (safe call) 과 `?:` (elvis) 를 우선한다. 사전 조건은 `requireNotNull()` 또는 도메인 예외로 표현한다.
- `!!` 는 사용하지 않는다. 불가피하면 이유를 코드로 드러내고 범위를 한 줄로 가둔다.

```kotlin
// ✅ 표현이 분명하다
val label = order.memo ?: "(메모 없음)"
val order = orderRepository.findById(id) ?: throw OrderNotFoundException(id)

// ❌ 금지: NPE 를 런타임으로 미룬다
val order = orderRepository.findById(id)!!
```

## 4. Kotlin 관용구

자바식 습관을 코틀린 관용구로 바꾸되, 가독성을 해치는 과도한 함축은 피한다.

- 제한된 타입 계층은 `sealed class`/`sealed interface` 로 표현하고, 분기는 `when` 으로 exhaustive 하게 처리한다 (`else` 로 뭉개면 분기 누락이 컴파일러에 잡히지 않는다). 도메인 이벤트가 대표 사례다 (`code-convention.md` §1).
- 단순 오버로드보다 default + named argument 를 우선한다.
- 반복되는 변환·조회 보조는 extension function 으로 분리할 수 있다.
- 컬렉션 파이프라인은 읽기 쉬울 때만 쓰고, 체이닝은 각 호출을 새 줄에 둔다. 원소가 많고 연산이 여러 단계면 `asSequence()` 를 검토한다.

```kotlin
val activeNames = orders
    .asSequence()
    .filter { it.isActive }
    .map { it.orderNo }
    .toList()
```

스코프 함수는 목적이 분명할 때만, 중첩 없이 사용한다.

| 함수 | 용도 |
|---|---|
| `let` | nullable 처리 / 변환 |
| `apply` | 객체 초기 설정 |
| `also` | 로깅 등 부수효과 |

enum 의 코드 변환 로직은 `companion object` 에 모은다. 다만 알 수 없는 값을 기본값으로 흡수하면 버그를 숨길 수 있으므로, 기본값 처리와 예외 처리 중 무엇을 택할지 의식적으로 결정한다. 결제·상태 전이처럼 잘못된 값이 사고로 이어지는 도메인에서는 예외를 우선한다.

```kotlin
enum class OrderStatus {
    CREATED, PAID, CANCELED;

    companion object {
        // 외부 입력을 신뢰할 수 없고 미지값을 끊어야 하는 경우
        fun from(code: String): OrderStatus =
            entries.firstOrNull { it.name == code.uppercase() }
                ?: throw IllegalArgumentException("unknown order status: $code")
    }
}
```

## 5. 함수와 클래스

- 함수는 한 가지 일만 한다 (권장 5~20줄). 한 함수 안에서 추상화 수준을 섞지 않고, 섹션 주석이 필요해지면 private 함수로 추출한다. 분기가 깊어지면 early return 을 먼저 검토한다.
- 클래스는 한 가지 책임만 가진다. 모든 메서드가 핵심 책임과 직접 관련되어야 하며, 커지면 책임 기준으로 분리한다.
- 부수효과가 있는 함수는 이름에서 의도를 드러낸다.

클래스 내부 멤버 순서: ① 주 생성자 프로퍼티 → ② 프로퍼티·`init` → ③ 보조 생성자 → ④ public → ⑤ internal/protected → ⑥ private → ⑦ `companion object`(특별한 이유 없으면 맨 아래) → ⑧ 중첩 클래스.

data class 프로퍼티 순서는 필수 → 기본값 있는 선택 → 타임스탬프 순서로 둔다. 검증은 `init`, 파생 값은 저장하지 말고 computed property 로 제공한다.

```kotlin
data class Period(
    val start: LocalDate,
    val end: LocalDate,
) {
    val days: Long get() = ChronoUnit.DAYS.between(start, end)

    init { require(!end.isBefore(start)) { "end must be on or after start" } }
}
```

포맷팅: 4-space 들여쓰기, 여는 중괄호는 선언 줄 끝, 여러 줄 파라미터와 컬렉션 리터럴에 trailing comma, wildcard import 금지, 미사용 import 제거, public class 는 파일당 하나 원칙(작고 밀접한 보조 타입은 동봉 가능).

## 6. 애너테이션 순서

프레임워크 stereotype 을 맨 위에, 설정·검증·직렬화·횡단 관심사를 뒤에 둔다.

| 우선 | 분류 | 예 |
|---|---|---|
| 1 | 프레임워크 stereotype | `@Entity`, `@RestController`, `@Component` |
| 2 | 매핑 / 설정 | `@Table`, `@RequestMapping`, `@Transactional` |
| 3 | 검증 / 제약 | `@Valid`, `@field:NotNull`, `@field:Positive` |
| 4 | 직렬화 / 포맷 | `@JsonProperty`, `@JsonFormat` |
| 5 | 횡단 관심사 | `@PreAuthorize`, `@Cacheable`, `@TransactionalEventListener` |

```kotlin
@PostMapping
@ResponseStatus(HttpStatus.CREATED)
fun create(
    @Valid @RequestBody request: CreateOrderRequest,
): ApiResponse<OrderResponse> { ... }
```

파라미터는 검증(`@Valid`) → 바인딩(`@RequestBody`) 순서, 필드는 매핑(`@Column`/`@Enumerated`) → 검증 순서로 둔다.

`@JsonFormat` 은 Kotlin 에서 적용 대상이 모호하므로 use-site target 으로 방향을 명시한다.

| target | 방향 | 용도 |
|---|---|---|
| `@param:JsonFormat` | 역직렬화(요청) | 생성자 파라미터 입력 포맷 |
| `@get:JsonFormat` | 직렬화(응답) | getter 출력 포맷 |
| `@field:JsonFormat` | 양방향 | 공통 포맷 |

## 7. 예외와 외부 호출

- 예상 가능한 실패(검증·미존재·잘못된 상태·권한)는 명확한 도메인 예외로 표현하고, 변환은 `GlobalExceptionHandler` 가 맡는다 (`api-format.md`). controller 에서 try/catch 하지 않는다.
- 외부 IO 의 실패를 호출 지점에서 흡수해야 할 때는 `runCatching { ... }.getOrElse { ... }` 패턴으로 fallback 을 명시한다. 실패를 삼켰으면 로그를 남긴다 (람다 형식, `logging.md`).
- 회복 탄력성(CircuitBreaker·DLQ·재시도)의 큰 그림은 `docs/adr/ADR-0015-resilience-strategy.md` 를 따른다. 트랜잭션 안에서 외부 IO 를 호출하지 않는다 (`transactional-usage.md`).

```kotlin
val price = runCatching { pricingPort.fetch(productId) }
    .getOrElse { e ->
        log.warn(e) { "pricing fetch failed, fallback to base price: productId=$productId" }
        basePrice
    }
```

단, 비즈니스 규칙 위반까지 `runCatching` 으로 삼키지 않는다 — 도메인 예외는 전파한다. fallback 은 외부 의존성이 불안정해도 자체 흐름은 유지해야 할 때에 한해 사용한다.

## 8. 코드 스멜과 리팩터링

코드를 수정·리뷰할 때 아래 신호를 찾고, 발견하면 보이스카우트 규칙(§1)에 따라 손댄 범위 안에서 정리한다.

| 코드 스멜 | 신호 | 대응 |
|---|---|---|
| Long function | 로직 20줄 초과 | Extract Method |
| Large class | 200줄 초과 / 책임 둘 이상 | Extract Class · 위임 |
| Duplicated code | 같은 결정이 여러 곳 | 함수/extension 으로 추출 |
| Primitive obsession | `String`/`Long` 이 도메인 의미를 떠안음 | Value Object 도입 (`Money`, `OrderNo` 등) |
| Feature envy | 메서드가 남의 데이터만 다룸 | 데이터 소유 클래스로 로직 이동 |
| Inappropriate intimacy | 두 클래스가 서로 내부를 너무 앎 | 결합 축소, 경계 명확화 |
| 비관용적 Kotlin | 자바식 null 체크·루프·getter | §3·§4 관용구로 치환 |
| 불필요한 가변 상태 | 변경되지 않는 `var` | `val` 로 |
| 과도한 주석 | "무엇" 을 설명하는 주석 | 이름·구조로 표현, 주석 제거 |

주석은 "무엇" 이 아니라 "왜" 를 설명할 때만 남긴다.

## 9. 리팩터링 시 동작 보존

리팩터링은 동작을 바꾸지 않는다. 다음을 위반하면 리팩터링이 아니라 기능 변경이다.

- API 계약(엔드포인트·요청/응답 shape)을 바꾸지 않는다.
- 에러 처리·fallback·resilience 경로를 제거하지 않는다.
- 레이어 의존 방향을 위반하지 않는다 (domain 은 infrastructure 를 import 하지 않는다).
- named Bean 이름을 바꾸지 않는다.
- 정리 후 해당 모듈 테스트로 확인한다: `./gradlew :{service}:app:test` / `:{service}:domain:test`.

## References

- 레이어 네이밍 / DI 방향 / 도메인 패턴: `docs/conventions/code-convention.md`
- 영속성 규칙: `docs/conventions/jpa-persistence.md`
- 로깅 규칙: `docs/conventions/logging.md`
- API 응답 포맷: `docs/conventions/api-format.md`
- 트랜잭션 사용 규칙: `docs/conventions/transactional-usage.md`
- Clean Architecture 원칙: `docs/architecture/00.clean-architecture.md`
- 본 컨벤션의 거버넌스: ADR-0026 docs taxonomy
