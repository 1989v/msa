---
parent: 17-spring-web
seq: 09
title: ObjectMapper lifecycle + thread-safety
type: deep
created: 2026-05-01
---

# 09. ObjectMapper lifecycle + thread-safety

> 면접 단골: **"ObjectMapper 가 thread-safe 한가요? 왜 싱글톤?"**
>
> 답의 핵심은 *configuration 시점의 mutable 한 구간* 과 *직렬화 시점의 immutable 한 사용* 의 분리.

## 1. `ObjectMapper` 의 정체

- 풀네임: `com.fasterxml.jackson.databind.ObjectMapper`
- Jackson 2.x 의 entry point. 직렬화/역직렬화의 모든 path 가 통과하는 객체.
- 내부 구조 (단순화):

```
ObjectMapper
  ├── SerializerFactory  (직렬화 path)
  ├── DeserializerFactory (역직렬화 path)
  ├── SerializationConfig (immutable 한 직렬화 정책)
  ├── DeserializationConfig (immutable)
  ├── _serializerCache : SerializerCache  ← thread-safe ConcurrentHashMap
  ├── _deserializerCache : DeserializerCache
  └── ... (Module 등록 시 Factory 변경)
```

- 비싼 부분: **Module 등록, 어노테이션 인트로스펙션, BeanSerializer 캐시 빌드**
- 싼 부분: **이미 캐시된 타입의 read/write**

## 2. Thread-safety 분석

### 결론

| 단계 | thread-safe? |
|---|---|
| 생성 + Module 등록 + 설정 (`registerModule`, `enable`, `disable`) | ❌ 한 스레드에서 끝낼 것 |
| `readValue` / `writeValue` 등 변환 호출 | ✅ thread-safe |

### 왜?

- 설정 단계는 내부 Factory 들을 교체. 멀티 스레드가 동시에 만지면 race
- 직렬화 호출 시점에는 `SerializationConfig`/`DeserializationConfig` 가 frozen, cache 는 ConcurrentHashMap
- Jackson 공식 문서 명시: **"After configuration, ObjectMapper instances are immutable from the perspective of thread-safety."**

### 표준 패턴

```kotlin
// ❌ 매 요청마다 new — 비싼 비용 + GC 압력
fun toJson(obj: Any): String = ObjectMapper().writeValueAsString(obj)

// ✅ 싱글톤
@Component
class JsonSerializer(private val mapper: ObjectMapper) {
    fun toJson(obj: Any): String = mapper.writeValueAsString(obj)
}
```

## 3. 비용 측정 — 왜 "비싼" 가

대략적인 측정 (단일 스레드, 간단 POJO 기준, 환경마다 다름):

| 작업 | 시간 |
|---|---|
| `new ObjectMapper()` (모듈 없이) | ~10ms |
| Module 등록 (Kotlin + JavaTime) | +5~20ms |
| 첫 직렬화 (BeanSerializer 빌드 + 캐시) | ~1ms~수십ms |
| 캐시 hit 직렬화 | ~수 μs |

→ 매 요청마다 새로 만들면 latency 가 ms 단위로 폭발. 더 큰 문제는 **캐시 미스가 누적** 되어 메모리 효율도 나빠짐.

## 4. `ObjectReader` / `ObjectWriter` — 더 빠른 path

```kotlin
private val orderReader: ObjectReader = mapper.readerFor(Order::class.java)
private val orderWriter: ObjectWriter = mapper.writerFor(Order::class.java)

fun parse(json: String): Order = orderReader.readValue(json)
fun write(o: Order): String = orderWriter.writeValueAsString(o)
```

- `ObjectReader`/`ObjectWriter` 는 immutable, fully thread-safe
- 특정 타입에 바인딩 → ObjectMapper 마다 매번 dispatch 하는 비용 절감
- Hot path 에서 최적화하고 싶을 때 사용

## 5. 두 가지 ObjectMapper 가 공존하는 이유 (msa 의 함정)

### Spring Boot 4 의 변화

> 인용: msa `common/src/main/kotlin/com/kgd/common/jackson/CommonJacksonAutoConfiguration.kt`
>
> "Spring Boot 4.0 ships Jackson 3 (`tools.jackson.*`) as the auto-configured JSON stack, but a lot of the platform code still imports the Jackson 2 type `com.fasterxml.jackson.databind.ObjectMapper`."

- **Spring Boot 4 = Jackson 3 (`tools.jackson.databind.ObjectMapper`)** 가 auto-configured 빈
- Jackson 3 는 패키지 자체가 `tools.jackson.*` 으로 변경 (incompatible API)
- 기존 Jackson 2 (`com.fasterxml.jackson.databind.ObjectMapper`) 가 import 된 코드는 빈 매칭 실패 → 시작 실패
- msa 의 우회: `CommonJacksonAutoConfiguration` 이 Jackson 2 빈을 **빈자리 채우기 용도** 로 등록

### 현재 msa 코드

```kotlin
// common/src/main/kotlin/com/kgd/common/jackson/CommonJacksonAutoConfiguration.kt
@AutoConfiguration
@ConditionalOnClass(ObjectMapper::class)
class CommonJacksonAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(ObjectMapper::class)
    fun legacyObjectMapper(): ObjectMapper = ObjectMapper()
}
```

- **기본 `ObjectMapper()` 만 등록** — `KotlinModule`, `JavaTimeModule` 미적용
- 즉, msa 에서 `ObjectMapper` 를 주입 받은 곳들은 **`LocalDateTime` / Kotlin data class default value** 가 의도와 다르게 동작할 수 있음
- 이 상태가 의도된 minimum 인지, 모듈 추가가 누락된 건지 [19](19-improvements.md) 에서 후보로 다룸

### 한 서비스의 직접 등록 (참고)

```kotlin
// agent-viewer/api/src/main/kotlin/com/kgd/agentviewer/config/JacksonConfig.kt
@Configuration
class JacksonConfig {
    @Bean
    fun objectMapper(): ObjectMapper = jacksonObjectMapper().apply {
        registerModule(JavaTimeModule())
        disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
    }
}
```

→ `agent-viewer` 만 자체 ObjectMapper 등록. 다른 서비스는 `CommonJacksonAutoConfiguration` 의 default 를 그대로 사용.

→ 표준화 후보: **common 의 ObjectMapper 빈에 KotlinModule + JavaTimeModule 기본 등록**

## 6. ObjectMapper 의 mutation 안전 패턴

런타임에 한 빈을 여러 컨텍스트에서 다르게 쓰고 싶다면:

```kotlin
@Bean
fun mapper(): ObjectMapper = jacksonObjectMapper().apply {
    registerModule(JavaTimeModule())
    disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
    setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
}

// 다른 곳에서 한 번 더 변형이 필요하면 — copy() 로 복사 후 변형
fun camelCaseMapper(): ObjectMapper =
    mapper().copy().setPropertyNamingStrategy(PropertyNamingStrategies.LOWER_CAMEL_CASE)
```

- `mapper.copy()` 는 deep copy. 원본 변경 없이 변형 가능
- 단, `copy()` 자체도 비싸므로 한 번 만들고 재사용

## 7. 직렬화 경로의 정확한 흐름

```
@RestController 메소드 반환
   ↓
RequestResponseBodyMethodProcessor.handleReturnValue()
   ↓
ResponseBodyAdvice.beforeBodyWrite()  (있으면)
   ↓
HttpMessageConverter 후보 중 Accept: application/json 매칭 → MappingJackson2HttpMessageConverter
   ↓
internal: ObjectMapper.writeValue(OutputStream, value)
   ↓
SerializerFactory → BeanSerializer (캐시) → JsonGenerator → 바이트 스트림
   ↓
ServletOutputStream → Tomcat → Reverse Proxy → Client
```

→ 모든 응답이 **단 하나의 ObjectMapper** 를 통과한다는 사실이 중요. 표준화 못 하면 서비스마다 응답 포맷 미세하게 다를 수 있음.

## 8. 면접 답변

### Q1. ObjectMapper 가 thread-safe 한가요? 왜 싱글톤?

> "Module 등록과 설정이 끝난 뒤에는 thread-safe 합니다. 내부 Serializer/Deserializer 캐시가 ConcurrentHashMap 이고, SerializationConfig 는 frozen 이라 동시 접근에 안전합니다. 다만 생성과 모듈 등록은 비싼 작업 (BeanSerializer 빌드, 어노테이션 인트로스펙션) 이라 매 요청마다 만들면 ms 단위 latency 가 누적됩니다. 그래서 싱글톤으로 등록하고, 특정 타입의 hot path 면 `readerFor/writerFor` 로 immutable Reader/Writer 를 따로 만들어 씁니다."

### Q2. ObjectMapper 를 두 종류로 쓰고 싶을 때는?

> "`mapper.copy()` 로 deep copy 한 뒤 한쪽만 설정 변경합니다. 원본은 그대로 두고 새 인스턴스를 또 다른 빈으로 등록합니다. 매 요청마다 mutate 하는 건 race 조건이라 절대 금물입니다."

### Q3. Spring Boot 4 의 Jackson 3 전환은?

> "Spring Boot 4 부터는 `tools.jackson.databind.ObjectMapper` 가 auto-configured 빈입니다. 기존 Jackson 2 import 코드가 많으면 호환성 위해 별도 `ObjectMapper` 빈을 직접 등록하거나, msa 처럼 auto-configuration 으로 bridge 빈을 만들어줘야 합니다. 장기적으로는 `tools.jackson.*` 으로 전환이 정공이지만 마이그레이션 비용이 있어 단계적으로 가는 게 일반적입니다."

## 다음 학습

- [10-jackson-modules.md](10-jackson-modules.md) — Module / MixIn / Annotation 활용
- [18-msa-common-patterns.md](18-msa-common-patterns.md) — msa 의 ObjectMapper 표준안
