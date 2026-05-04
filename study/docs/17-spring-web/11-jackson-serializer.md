---
parent: 17-spring-web
seq: 11
title: Custom Serializer / Deserializer + Polymorphic
type: deep
created: 2026-05-01
---

# 11. Custom Serializer / Deserializer + Polymorphic

## 1. Custom Serializer 작성

### 기본 패턴

```kotlin
class MoneySerializer : StdSerializer<Money>(Money::class.java) {
    override fun serialize(value: Money, gen: JsonGenerator, provider: SerializerProvider) {
        gen.writeStartObject()
        gen.writeStringField("amount", value.amount.toPlainString())
        gen.writeStringField("currency", value.currency.code)
        gen.writeEndObject()
    }
}

class MoneyDeserializer : StdDeserializer<Money>(Money::class.java) {
    override fun deserialize(p: JsonParser, ctx: DeserializationContext): Money {
        val node = p.codec.readTree<JsonNode>(p)
        return Money(
            amount = BigDecimal(node["amount"].asText()),
            currency = Currency.of(node["currency"].asText())
        )
    }
}
```

### 등록 방법 비교

| 방법 | 코드 | 트레이드오프 |
|---|---|---|
| `SimpleModule` 에 추가 후 ObjectMapper 등록 | `module.addSerializer(...).addDeserializer(...)` | 적용 범위 = 같은 ObjectMapper 의 모든 사용처. 일관성 ↑ |
| 클래스 어노테이션 | `@JsonSerialize(using = ...)` / `@JsonDeserialize(using = ...)` | 도메인 클래스에 Jackson 의존성 침투. 권장 X (Clean Architecture 위반) |
| 빈 등록 후 어노테이션 | `@Component class MoneySerializer ...` | 어노테이션 + DI 주입이 필요한 경우 (드뭄) |

→ msa 의 Clean Architecture 원칙 ("domain 에 framework 의존 금지") 상 **SimpleModule 등록 + 어노테이션 미사용** 이 정공.

### Decimal / Money 직렬화의 함정

```kotlin
// 안티패턴
gen.writeNumberField("amount", value.amount)   // BigDecimal 그대로 → 0.10 이 0.1 로 손실 가능

// 정공
gen.writeStringField("amount", value.amount.toPlainString())  // 문자열로 정밀도 보존
```

→ 회계/결제는 **항상 문자열 직렬화** + 클라이언트에서 BigDecimal 로 파싱.

### Null / Missing 차이 처리 (Deserializer)

```kotlin
override fun deserialize(p: JsonParser, ctx: DeserializationContext): Money {
    val node = p.codec.readTree<JsonNode>(p)
    val amountNode = node["amount"]
    val amount = when {
        amountNode == null -> throw ctx.weirdStringException("amount", Money::class.java, "missing")
        amountNode.isNull -> BigDecimal.ZERO  // null 은 0 처리
        else -> BigDecimal(amountNode.asText())
    }
    ...
}
```

→ "missing" 과 "null" 의 의미를 도메인이 구별하면 명시적으로 처리.

## 2. Polymorphic 직렬화/역직렬화

### 문제

```kotlin
sealed class Event {
    data class OrderPlaced(val orderId: Long, val total: BigDecimal) : Event()
    data class OrderCancelled(val orderId: Long, val reason: String) : Event()
}

// 직렬화 OK: { "orderId":1, "total":"100" } 또는 { "orderId":1, "reason":"X" }
// 역직렬화 ❌: Jackson 은 "이건 OrderPlaced 인지 OrderCancelled 인지" 판단 불가
```

### 해결: `@JsonTypeInfo` + `@JsonSubTypes`

```kotlin
@JsonTypeInfo(
    use = JsonTypeInfo.Id.NAME,
    include = JsonTypeInfo.As.PROPERTY,
    property = "type"
)
@JsonSubTypes(
    JsonSubTypes.Type(value = Event.OrderPlaced::class, name = "ORDER_PLACED"),
    JsonSubTypes.Type(value = Event.OrderCancelled::class, name = "ORDER_CANCELLED")
)
sealed class Event {
    data class OrderPlaced(val orderId: Long, val total: BigDecimal) : Event()
    data class OrderCancelled(val orderId: Long, val reason: String) : Event()
}
```

### 결과 JSON

```json
{ "type": "ORDER_PLACED", "orderId": 1, "total": "100" }
{ "type": "ORDER_CANCELLED", "orderId": 2, "reason": "PAYMENT_FAILED" }
```

### 옵션 선택

| 항목 | 옵션 | 권장 |
|---|---|---|
| `use` | `Id.NAME` (논리 이름) / `Id.CLASS` (FQCN) / `Id.MINIMAL_CLASS` | **`Id.NAME`** — `Id.CLASS` 는 FQCN 노출 + RCE 위험 |
| `include` | `As.PROPERTY` (별도 필드) / `As.WRAPPER_OBJECT` / `As.WRAPPER_ARRAY` / `As.EXISTING_PROPERTY` | **`As.PROPERTY`** — 가장 흔함 |
| `property` | 식별 필드명 | "type" 관례 |

### `Id.CLASS` 의 보안 위험

```kotlin
@JsonTypeInfo(use = JsonTypeInfo.Id.CLASS)  // ❌ 위험
sealed class Event { ... }
```

→ JSON 의 `"@class": "com.evil.Gadget"` 으로 임의 클래스 인스턴스화 가능 → RCE.
→ [12](12-jackson-default-typing.md) 의 Default Typing 과 같은 부류 위험.

→ **항상 `Id.NAME` + 명시 allow-list (`@JsonSubTypes`) 사용**.

## 3. Kafka 이벤트 직렬화 패턴 (msa 적용)

msa 의 Kafka 이벤트는 보통 envelope 로 감싼다:

```kotlin
data class EventEnvelope(
    val eventId: UUID,
    val occurredAt: Instant,
    val type: String,         // "ORDER_PLACED"
    val payload: JsonNode     // 실제 페이로드
)
```

또는 sealed class polymorphic:

```kotlin
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(value = OrderPlacedEvent::class, name = "ORDER_PLACED"),
    JsonSubTypes.Type(value = OrderCancelledEvent::class, name = "ORDER_CANCELLED")
)
sealed class OrderEvent { ... }
```

### Trade-off

| 패턴 | 장점 | 단점 |
|---|---|---|
| Envelope + JsonNode payload | 동적 — 새 이벤트 추가 시 consumer 영향 적음 | 컴파일 타임 type-safety 없음 |
| Sealed class polymorphic | 컴파일 타임 검증 | 새 이벤트 추가 시 모든 consumer 재배포 필요 |

→ **느슨한 결합** (마이크로서비스간) → envelope, **strict 한 도메인 이벤트** → sealed class.

## 4. `@JsonView`

응답 view 별 필드 노출 제어:

```kotlin
class UserView {
    interface Summary
    interface Detail : Summary
    interface Admin : Detail
}

data class User(
    @JsonView(UserView.Summary::class)
    val id: Long,

    @JsonView(UserView.Summary::class)
    val nickname: String,

    @JsonView(UserView.Detail::class)
    val email: String,

    @JsonView(UserView.Admin::class)
    val internalRiskScore: Int
)

@RestController
class UserController {
    @JsonView(UserView.Summary::class)
    @GetMapping("/api/users/{id}/summary")
    fun summary(@PathVariable id: Long): User = ...

    @JsonView(UserView.Detail::class)
    @GetMapping("/api/users/{id}")
    fun detail(@PathVariable id: Long): User = ...

    @JsonView(UserView.Admin::class)
    @GetMapping("/api/users/{id}/admin")
    fun admin(@PathVariable id: Long): User = ...
}
```

### 트레이드오프

- ✅ DTO 클래스 1개로 여러 view 처리
- ❌ 어노테이션 산발 → 도메인 클래스에 view 정책이 들러붙음
- 대안: **응답 DTO 를 view 별로 분리** (예: UserSummaryDto, UserDetailDto) — 보일러플레이트 ↑ 이지만 명확

→ msa 에선 **DTO (Data Transfer Object, 데이터 전송 객체) 분리** 가 표준이라 `@JsonView` 거의 안 씀.

## 5. ResponseBodyAdvice — 한 단계 더 위에서 후처리

직렬화 전에 응답 본문을 일괄 가공:

```kotlin
@RestControllerAdvice
class ApiResponseWrapper : ResponseBodyAdvice<Any> {

    override fun supports(returnType: MethodParameter, converterType: Class<out HttpMessageConverter<*>>): Boolean =
        // ApiResponse 가 아닌 모든 응답을 래핑
        ApiResponse::class.java != returnType.parameterType

    override fun beforeBodyWrite(
        body: Any?,
        returnType: MethodParameter,
        contentType: MediaType,
        converterType: Class<out HttpMessageConverter<*>>,
        request: ServerHttpRequest,
        response: ServerHttpResponse
    ): Any? = ApiResponse.success(body)
}
```

→ msa 의 `ApiResponse<T>` 통일 패턴을 **모든 컨트롤러가 명시** 하지 않아도 자동 적용 가능 ([19](19-improvements.md) 후보).

### 함정

- `String` 반환 시 `StringHttpMessageConverter` 가 우선 → ApiResponse wrapping 안 됨 (별도 처리 필요)
- 이미 ApiResponse 인 응답까지 또 감싸지 않게 `supports` 에서 분기
- 예외 응답(`@ExceptionHandler` 가 만든 ApiResponse.error) 도 거치는지 확인

## 6. 면접 답변

### Q. Polymorphic 직렬화 시 `Id.CLASS` 와 `Id.NAME` 중 무엇을 쓰나요?

> "항상 `Id.NAME` 과 `@JsonSubTypes` 의 allow-list 조합입니다. `Id.CLASS` 는 JSON 의 `@class` 필드에 임의 FQCN 을 넣어 클래스 로딩 → 인스턴스화를 유도할 수 있어 RCE 위험이 있습니다. CVE-2017-7525 부터 시작된 Jackson Default Typing 사고들이 모두 같은 root cause 입니다. 도메인 이벤트는 `Id.NAME` + 'ORDER_PLACED' 같은 논리 이름으로 직렬화하고, 새 타입 추가 시 `@JsonSubTypes` 에 명시적으로 등록합니다."

### Q. Custom Serializer 를 도메인 클래스 어노테이션으로 등록 vs Module 등록 중 무엇을 선호하나요?

> "Module 등록을 선호합니다. 이유는 Clean Architecture 원칙 — 도메인 클래스에 Jackson 의존성을 침투시키지 않아야 application 레이어 교체 시 영향이 없습니다. 또 Module 은 ObjectMapper 단위로 적용 범위가 명확해 같은 도메인을 다른 직렬화 정책으로 다룰 때도 (예: 외부 API 응답 vs Kafka 이벤트) 분리 가능합니다."

### Q. `@JsonView` vs DTO 분리?

> "DTO 분리를 선호합니다. `@JsonView` 는 도메인/응답 클래스 한 군데에 view 정책이 모이지만, 어노테이션 분산으로 가독성이 떨어지고 view 추가 시 누락 위험이 있습니다. DTO 별도 클래스는 보일러플레이트가 늘지만 명시적이라 운영 안전성이 더 높습니다."

## 다음 학습

- [12-jackson-default-typing.md](12-jackson-default-typing.md) — 폴리모픽이 갈 수 있는 가장 위험한 길
- [13-jackson-naming-perf.md](13-jackson-naming-perf.md) — snake_case + KotlinModule
