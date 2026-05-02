---
parent: 17-spring-web
seq: 13
title: snake_case + KotlinModule + 성능 (Blackbird)
type: deep
created: 2026-05-01
---

# 13. snake_case + KotlinModule + 성능

## 1. PropertyNamingStrategy

### 옵션

| 전략 | 결과 |
|---|---|
| `LOWER_CAMEL_CASE` (default) | `userId` → `userId` |
| `SNAKE_CASE` | `userId` → `user_id` |
| `UPPER_CAMEL_CASE` | `userId` → `UserId` |
| `KEBAB_CASE` | `userId` → `user-id` |
| `LOWER_DOT_CASE` | `userId` → `user.id` |
| `UPPER_SNAKE_CASE` | `userId` → `USER_ID` |

### 적용

```kotlin
@Bean
fun objectMapper(): ObjectMapper = jacksonObjectMapper().apply {
    setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
}
```

또는 `application.yml`:

```yaml
spring:
  jackson:
    property-naming-strategy: SNAKE_CASE
```

### 적용 후 결과

```kotlin
data class UserDto(val userId: Long, val nickName: String)

mapper.writeValueAsString(UserDto(1, "tom"))
// → {"user_id":1,"nick_name":"tom"}

mapper.readValue("""{"user_id":1,"nick_name":"tom"}""", UserDto::class)
// → UserDto(userId=1, nickName="tom")
```

### 함정 — 한 응답만 다른 컨벤션으로

```kotlin
data class WeirdDto(
    @JsonProperty("user-id")     // 이건 그대로 dash 로
    val userId: Long
)
```

→ `@JsonProperty` 가 `PropertyNamingStrategy` 보다 우선.

## 2. snake_case 결정 기준

### snake_case 가 적합한 경우

- 외부 공개 API (Twitter, GitHub, Stripe 표준)
- Python/Ruby 클라이언트가 자연스럽게 받음
- 모바일 앱 (iOS/Android) 둘 다 변환 코드 추가 필요는 같음

### camelCase 유지가 적합한 경우

- 내부 Service-to-Service API (Kotlin/Java/JS 모두 native)
- BFF 가 변환을 흡수
- 이미 camelCase 로 굳어진 레거시

### msa 의 현재 상태

`grep` 결과 `spring.jackson.property-naming-strategy` 사용 없음 → **모든 서비스 camelCase**.

→ 외부 노출 API 가 늘면(B2B SDK 같은) snake_case 전환 필요. 결정은 ADR 필요 ([19](19-improvements.md)).

## 3. KotlinModule strictNullChecks

```kotlin
val mapper = jacksonObjectMapper().apply {
    registerModule(
        KotlinModule.Builder()
            .configure(KotlinFeature.StrictNullChecks, true)   // null 안전성
            .configure(KotlinFeature.NullToEmptyCollection, true)  // null → emptyList
            .configure(KotlinFeature.NullToEmptyMap, true)
            .configure(KotlinFeature.NullIsSameAsDefault, true)  // null 입력 시 default 사용
            .configure(KotlinFeature.SingletonSupport, true)
            .build()
    )
}
```

### 각 옵션의 효과

| 옵션 | 효과 | 권장 |
|---|---|---|
| `StrictNullChecks` | non-nullable 필드에 null 입력 시 즉시 예외. 기본 false | ✅ 추천 — 데이터 무결성 |
| `NullToEmptyCollection` | `List<X>` non-null 인데 null 입력 → `emptyList()` 로 변환 | △ — 의도 불명확 |
| `NullToEmptyMap` | 동일 | △ |
| `NullIsSameAsDefault` | `val x: String = "a"` non-null + 기본값 있을 때 null → 기본값 | ✅ Kotlin idiom |
| `SingletonSupport` | `object Foo` 직렬화 시 인스턴스 보존 | ✅ |

### StrictNullChecks 가 무엇을 잡나

```kotlin
data class User(val id: Long, val nickname: String)  // 모두 non-null

// StrictNullChecks=false (default)
mapper.readValue("""{"id":1,"nickname":null}""", User::class)
// → User(id=1, nickname=null)  ← non-null 인데 null 들어감 (Kotlin null-safety 깨짐)

// StrictNullChecks=true
mapper.readValue("""{"id":1,"nickname":null}""", User::class)
// → MissingKotlinParameterException
```

→ **운영 시 strictNullChecks=true 강력 권장**. 안 그러면 도메인 깊숙이 null 이 침투해 NPE.

## 4. 성능 — Blackbird module

### 문제

Jackson 기본 직렬화는 **reflection** 기반. 매 호출마다 setter/getter 를 reflective 호출 → JIT 최적화 어려움.

### Blackbird

`jackson-module-blackbird` 는 런타임에 **invokedynamic + LambdaMetafactory** 로 setter/getter 를 동적 코드 생성. JIT 친화적.

```kotlin
implementation("com.fasterxml.jackson.module:jackson-module-blackbird:2.16.0")

mapper.registerModule(BlackbirdModule())
```

### 효과 (대략)

| 비교 | 직렬화 throughput |
|---|---|
| 기본 Jackson | 100% (baseline) |
| Blackbird | ~120-130% |
| Afterburner (deprecated) | ~115% |

→ JSON heavy 한 서비스 (analytics, charting) 에서 의미 있는 차이. 일반 CRUD 에선 마이크로 최적화.

### Afterburner vs Blackbird

- **Afterburner** 는 Java 8 baseline 이라 ASM 기반 바이트코드 생성. JDK 17+ 의 모듈 시스템 + sealed class 와 충돌 케이스
- **Blackbird** 는 JDK 11+ 의 LambdaMetafactory 활용. Afterburner 의 후속
- **Spring Boot 3+ JDK 17+ 환경 = Blackbird 권장**

## 5. ParameterNamesModule

생성자 파라미터 이름을 reflection 으로 읽으려면 컴파일 옵션 필요:

```kotlin
// build.gradle.kts
tasks.withType<KotlinCompile> {
    kotlinOptions {
        javaParameters = true   // 파라미터 이름 보존
    }
}
```

```kotlin
mapper.registerModule(ParameterNamesModule())
```

→ Kotlin + KotlinModule 이면 대부분 자동 처리. Java 코드와 섞이면 명시 필요.

## 6. 성능 측정 표준

### 측정 방법

```kotlin
// JMH 기준
@Benchmark
fun serialize(): String = mapper.writeValueAsString(largeOrder)

@Benchmark
fun deserialize(): Order = mapper.readValue(largeOrderJson, Order::class.java)
```

### 측정 시 함정

- **첫 직렬화** 는 BeanSerializer 빌드 비용 포함 → warmup 필요
- **String 길이/depth** 가 같아야 비교 의미
- ObjectMapper 는 한 번 만들고 재사용 (테스트마다 new 면 noise)
- JIT compilation 영향 → JMH 의 `@Warmup`/`@Measurement` 신경

### Spring Boot 4 의 Jackson 3 (`tools.jackson.*`)

- 패키지 변경: `com.fasterxml.jackson.*` → `tools.jackson.*`
- Builder 패턴 강화: `JsonMapper.builder()...build()`
- 일부 deprecated API 제거 (예: `enableDefaultTyping` 완전 삭제)
- 성능 ~5-10% 개선 (런타임 환경마다 다름)

→ msa 가 Jackson 2 + 3 hybrid 인 현재 상태에서 [18](18-msa-common-patterns.md) / [19](19-improvements.md) 에서 정리 필요.

## 7. 종합 권장 ObjectMapper

```kotlin
@Bean
fun objectMapper(): ObjectMapper = jacksonObjectMapper().apply {
    // Modules
    registerModule(JavaTimeModule())
    registerModule(BlackbirdModule())                           // 성능
    registerModule(
        KotlinModule.Builder()
            .configure(KotlinFeature.StrictNullChecks, true)    // null 안전성
            .configure(KotlinFeature.NullIsSameAsDefault, true)
            .configure(KotlinFeature.SingletonSupport, true)
            .build()
    )

    // Time
    disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)

    // Null
    setSerializationInclusion(JsonInclude.Include.NON_NULL)

    // Numbers
    enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)

    // Forward-compat
    disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)

    // Enum
    enable(MapperFeature.ACCEPT_CASE_INSENSITIVE_ENUMS)

    // Naming (외부 API 결정 후 활성화)
    // setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)

    // Security: depth/length 제한
    factory.streamReadConstraints = StreamReadConstraints.builder()
        .maxNestingDepth(100)
        .maxStringLength(10_000_000)
        .maxNumberLength(1000)
        .build()
}
```

## 8. 면접 답변

### Q. snake_case 변환을 카멜케이스 모델로 받으려면?

> "ObjectMapper 에 `setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)` 또는 `application.yml` 의 `spring.jackson.property-naming-strategy: SNAKE_CASE` 한 줄로 양방향 변환됩니다. 한 필드만 다른 컨벤션이 필요하면 그 필드만 `@JsonProperty` 로 명시하고요. msa 는 외부 노출 API 컨벤션이 정해지면 ADR 로 일괄 적용할 계획입니다."

### Q. KotlinModule 의 strictNullChecks 가 왜 필요한가요?

> "기본 KotlinModule 은 non-null 필드에 null 입력이 들어와도 그대로 통과시킵니다. Kotlin 의 null-safety 가 깨지면서 도메인 깊숙이 null 이 침투해 NPE 가 늦게 터지죠. strictNullChecks=true 로 두면 역직렬화 시점에 `MissingKotlinParameterException` 으로 fail-fast 됩니다. 운영에서 무조건 켜는 옵션입니다."

### Q. Blackbird vs Afterburner?

> "둘 다 reflection 비용을 줄이려고 동적 코드 생성을 합니다. Afterburner 는 ASM 으로 바이트코드를 짜는 옛 방식이고, Blackbird 는 JDK 11+ 의 invokedynamic + LambdaMetafactory 를 쓰는 후속 모듈입니다. JDK 17+ 의 module system 과 sealed class 호환성 때문에 Blackbird 가 표준이고, Afterburner 는 deprecated 입니다. Spring Boot 4 + Kotlin 환경이면 자연스럽게 Blackbird 선택입니다."

## 다음 학습

- [14-gzip-layers.md](14-gzip-layers.md) — 응답 직렬화 다음 단계: 압축
- [18-msa-common-patterns.md](18-msa-common-patterns.md) — msa ObjectMapper 통일안
