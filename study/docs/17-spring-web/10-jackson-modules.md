---
parent: 17-spring-web
seq: 10
title: Jackson Module / MixIn / Annotation
type: deep
created: 2026-05-01
---

# 10. Jackson Module / MixIn / Annotation

## 1. Module 시스템

`Module` 은 Jackson 에 새로운 직렬화/역직렬화 능력을 plug-in 하는 단위. 등록 한 번으로 새 타입 지원, 어노테이션 인식, 커스텀 Serializer 등을 한꺼번에 적용.

```kotlin
mapper.registerModule(KotlinModule.Builder().build())
mapper.registerModule(JavaTimeModule())
```

### 자주 쓰는 표준 모듈

| 모듈 | 의존성 | 효과 |
|---|---|---|
| `KotlinModule` | `jackson-module-kotlin` | data class, sealed class, default value, nullable 처리 |
| `JavaTimeModule` | `jackson-datatype-jsr310` | `LocalDateTime`, `Instant`, `Duration` ISO-8601 직렬화 |
| `Jdk8Module` | `jackson-datatype-jdk8` | `Optional`, `OptionalInt` 등 |
| `ParameterNamesModule` | `jackson-module-parameter-names` | 생성자 파라미터 이름 인식 (`-parameters` flag) |
| `BlackbirdModule` | `jackson-module-blackbird` | 런타임 코드 생성으로 reflection 비용 절감 |
| `Afterburner` | `jackson-module-afterburner` | (deprecated, Blackbird 권장) |

### Spring Boot 의 자동 등록

`spring-boot-starter-web` 은 classpath 에 있는 모듈을 자동 등록:

```
META-INF/services/com.fasterxml.jackson.databind.Module
```

→ classpath 에 `jackson-module-kotlin` 만 두면 자동으로 KotlinModule 등록됨. msa 도 그렇게 동작 — *그런데 `CommonJacksonAutoConfiguration` 이 `ObjectMapper()` 를 직접 만들어 fallback 으로 등록하는 경로는 자동 module 적용 단계를 우회* 할 수 있다는 점 주의 ([18](18-msa-common-patterns.md) 에서 다룸).

### 명시 등록 — 권장 (msa 적용 후보)

```kotlin
@Bean
fun objectMapper(): ObjectMapper = jacksonObjectMapper().apply {
    registerModule(JavaTimeModule())
    disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
    setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
    setSerializationInclusion(JsonInclude.Include.NON_NULL)
    findAndRegisterModules()  // 다른 모듈도 자동 발견
}
```

## 2. Jackson 어노테이션 자주 쓰는 것

### 직렬화/역직렬화 제어

```kotlin
data class UserDto(
    @JsonProperty("user_id")                       // 필드명 매핑
    val id: Long,

    @JsonIgnore                                    // 직렬화 제외
    val passwordHash: String,

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    val createdAt: LocalDateTime,                  // 응답에만 포함, 요청 무시

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    val rawSecret: String? = null,                 // 요청에만 포함, 응답 무시

    @JsonInclude(JsonInclude.Include.NON_NULL)
    val nickname: String? = null,                  // null 이면 응답에서 생략

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    val updatedAt: LocalDateTime,                  // 포맷 강제

    @JsonAlias("user_email", "email_address")
    val email: String                              // 다양한 이름으로 입력 받기
)
```

### Class 단위

```kotlin
@JsonInclude(JsonInclude.Include.NON_DEFAULT)      // 디폴트 값이면 생략
@JsonIgnoreProperties(ignoreUnknown = true)        // 모르는 필드 무시
data class OrderDto(...)
```

### 생성자 매핑

```kotlin
data class TransferRequest @JsonCreator constructor(
    @JsonProperty("from") val from: String,
    @JsonProperty("to") val to: String,
    @JsonProperty("amount") val amount: BigDecimal
)
```

→ Kotlin 은 `KotlinModule + ParameterNamesModule` 가 있으면 `@JsonCreator/@JsonProperty` 없이도 매핑됨. 명시는 안전망.

## 3. MixIn — 소유하지 않은 클래스에 어노테이션 추가

외부 라이브러리의 클래스를 직렬화할 때 해당 소스를 수정할 수 없으므로 별도 "Mix-in" 클래스 정의:

```kotlin
// 외부 라이브러리의 클래스라 어노테이션 추가 불가
// class ThirdPartyMoney(val amount: BigDecimal, val currency: Currency, val internalId: String)

// MixIn 정의
abstract class ThirdPartyMoneyMixIn {
    @JsonIgnore
    abstract fun getInternalId(): String

    @JsonProperty("currency_code")
    abstract fun getCurrency(): Currency
}

// 등록
mapper.addMixIn(ThirdPartyMoney::class.java, ThirdPartyMoneyMixIn::class.java)
```

→ **단방향**: target 클래스의 동작을 mixin 의 어노테이션으로 덮어씀. 라이브러리 코드 안 건드리고 직렬화 정책 변경 가능.

### MixIn 활용 사례

- 외부 SDK DTO (Data Transfer Object, 데이터 전송 객체) 의 민감 필드 마스킹
- Java 의 enum 직렬화 변경
- 외부 클래스에 `@JsonIgnoreProperties` 일괄 적용

## 4. Custom Serializer / Deserializer

Module 이 빌딩 블록이라면, Serializer/Deserializer 는 실제 변환 로직.

```kotlin
class MoneySerializer : StdSerializer<Money>(Money::class.java) {
    override fun serialize(value: Money, gen: JsonGenerator, provider: SerializerProvider) {
        gen.writeStartObject()
        gen.writeNumberField("amount", value.amount)
        gen.writeStringField("currency", value.currency.code)
        gen.writeEndObject()
    }
}

class MoneyDeserializer : StdDeserializer<Money>(Money::class.java) {
    override fun deserialize(p: JsonParser, ctx: DeserializationContext): Money {
        val node = p.codec.readTree<JsonNode>(p)
        return Money(
            amount = node["amount"].decimalValue(),
            currency = Currency.of(node["currency"].textValue())
        )
    }
}
```

### 등록

```kotlin
val module = SimpleModule()
    .addSerializer(Money::class.java, MoneySerializer())
    .addDeserializer(Money::class.java, MoneyDeserializer())

mapper.registerModule(module)
```

또는 어노테이션 방식:

```kotlin
@JsonSerialize(using = MoneySerializer::class)
@JsonDeserialize(using = MoneyDeserializer::class)
data class Money(...)
```

## 5. 시나리오별 결정표

| 요구사항 | 도구 |
|---|---|
| `LocalDateTime` 을 `2026-05-01T12:00:00` 으로 | `JavaTimeModule` + `disable(WRITE_DATES_AS_TIMESTAMPS)` |
| `Instant` 를 epoch ms 로 | `JavaTimeModule` + `enable(WRITE_DATES_AS_TIMESTAMPS)` 또는 별도 Serializer |
| API 응답에 `null` 필드 빼기 | `setSerializationInclusion(NON_NULL)` 또는 `@JsonInclude` |
| API 요청에서 모르는 필드 무시 | `disable(FAIL_ON_UNKNOWN_PROPERTIES)` 또는 `@JsonIgnoreProperties(ignoreUnknown=true)` |
| 외부 SDK 클래스의 직렬화 변경 | MixIn |
| 도메인 ValueObject (Money, Email) 의 형식 통제 | Custom Serializer/Deserializer |
| 응답 필드 view 별 노출 제어 (admin vs user) | `@JsonView` |
| 카멜케이스 ↔ 스네이크케이스 변환 | `setPropertyNamingStrategy(SNAKE_CASE)` ([13](13-jackson-naming-perf.md)) |

## 6. 흔한 함정

### 6.1. Kotlin data class + 기본값 + 모듈 누락

```kotlin
data class Foo(val name: String = "anonymous", val age: Int = 0)

// KotlinModule 없으면 기본값 무시되고
// 입력에 name 만 있을 때 age 매핑 시도 → 0(primitive default) 으로 채워짐
// nullable 처리도 일관성 없음
```

→ **항상 KotlinModule 등록** 필수.

### 6.2. `@JsonCreator` 없이 다중 생성자

Kotlin 의 보조 생성자가 있으면 Jackson 이 어느 것을 쓸지 헷갈림. `@JsonCreator` 로 명시.

### 6.3. enum 직렬화

```kotlin
enum class Status { ACTIVE, INACTIVE }
// 기본: "ACTIVE" 문자열로 직렬화
// 소문자로 받고 싶다면:
mapper.enable(MapperFeature.ACCEPT_CASE_INSENSITIVE_ENUMS)
// 또는 @JsonProperty 또는 @JsonValue 사용
```

### 6.4. `BigDecimal` 정밀도

```kotlin
mapper.enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
// → 0.1 + 0.2 같은 정밀도 손실 방지
```

→ 결제/회계 시스템에서 필수.

### 6.5. 날짜 timezone

```kotlin
mapper.setTimeZone(TimeZone.getTimeZone("Asia/Seoul"))
// 또는 Instant 만 쓰고 timezone 은 표시 시점에서 결정
```

→ msa 가 멀티 timezone 이라면 **항상 Instant 로 직렬화** 후 클라이언트에서 변환이 정공.

## 7. msa 적용 권장 모듈 + 설정

```kotlin
@AutoConfiguration
@ConditionalOnClass(ObjectMapper::class)
class CommonJacksonAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(ObjectMapper::class)
    fun objectMapper(): ObjectMapper = jacksonObjectMapper().apply {
        // 1. Time
        registerModule(JavaTimeModule())
        disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)

        // 2. null 응답 최소화
        setSerializationInclusion(JsonInclude.Include.NON_NULL)

        // 3. 알 수 없는 필드 무시 (forward-compat)
        disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)

        // 4. 정밀도
        enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)

        // 5. enum
        enable(MapperFeature.ACCEPT_CASE_INSENSITIVE_ENUMS)

        // 6. snake_case  (msa API 컨벤션 결정 후)
        // setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
    }
}
```

→ 서비스마다 자체 ObjectMapper 빈을 등록하면 그쪽이 우선 (`@ConditionalOnMissingBean`).

## 8. 면접 한 줄 답변

> "Jackson 의 Module 은 Kotlin/JavaTime/Jdk8 같은 새 타입 지원을 한꺼번에 plug-in 하는 단위이고, MixIn 은 소유 안 한 외부 클래스에 어노테이션을 외부에서 덮어씌우는 패턴, Custom Serializer/Deserializer 는 도메인 ValueObject (Money, Email) 의 직렬화 형식을 코드로 통제할 때 씁니다. Spring Boot 가 classpath 의 Module 을 자동 등록해주지만, 명시 등록이 의도가 코드에 보여 운영상 더 안전합니다."

## 다음 학습

- [11-jackson-serializer.md](11-jackson-serializer.md) — Custom + Polymorphic
- [13-jackson-naming-perf.md](13-jackson-naming-perf.md) — snake_case + 성능
