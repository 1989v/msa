---
parent: 17-spring-web
seq: 18
title: common AOP / ObjectMapper / gzip 활성화 위치 결정
type: deep
created: 2026-05-01
---

# 18. msa common 패턴 결정

> 본 파일은 msa 의 `common/` 모듈에 어떤 표준을 추가할지 결정한다. 19번 (improvements) 의 입력이 된다.

## 1. 현재 상태 정리

### 1.1. ObjectMapper

`common/src/main/kotlin/com/kgd/common/jackson/CommonJacksonAutoConfiguration.kt`:

```kotlin
@AutoConfiguration
@ConditionalOnClass(ObjectMapper::class)
class CommonJacksonAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean(ObjectMapper::class)
    fun legacyObjectMapper(): ObjectMapper = ObjectMapper()    // 모듈 미등록!
}
```

**문제**:

- `KotlinModule` 미등록 → Kotlin data class default value, nullable 처리 안 됨
- `JavaTimeModule` 미등록 → `LocalDateTime` 역직렬화 시 `Cannot construct instance` 에러 (실제 Spring Boot 자동 모듈 발견 덕에 살아있을 가능성)
- 실제로는 Spring Boot 의 자동 발견(`findAndRegisterModules` equivalent) 이 동작하지만, **명시되지 않은 동작에 의존** 하는 것은 운영 리스크

**의도**: Spring Boot 4 의 Jackson 3 (`tools.jackson.*`) 와 코드의 Jackson 2 (`com.fasterxml.jackson.*`) 사이 bridge.

### 1.2. AOP

```bash
$ grep -r "@Aspect" /Users/.../msa/src --include="*.kt"
# (운영 코드에 0건. template 1개)
```

**현재 AOP (Aspect-Oriented Programming, 관점 지향 프로그래밍) 사용 0건**. Resilience4j 가 내부 AOP 를 쓰지만 사용자 코드 측엔 없음.

### 1.3. gzip / compression

```bash
$ grep -r "compression\|gzip" /Users/.../msa --include="*.yml"
# (모든 application.yml 에 server.compression 미설정)

$ grep -r "use-gzip\|gzip on" /Users/.../msa/k8s
# (ingress 어디에도 압축 미설정)
```

**압축 0%**. 모든 응답이 raw 로 송출.

## 2. 결정 #1 — ObjectMapper 통일

### 안 A. 현 상태 유지 (`ObjectMapper()` fallback)

| 항목 | 평가 |
|---|---|
| 운영 안정성 | △ — Spring Boot 자동 모듈 발견에 묵시적 의존 |
| 일관성 | ✗ — agent-viewer 만 자체 빈 → 응답 포맷 미세 다를 가능 |
| 추후 표준화 비용 | ↑ — 서비스가 늘수록 비용 증가 |

### 안 B. common 에서 표준 ObjectMapper 등록

```kotlin
@AutoConfiguration
@ConditionalOnClass(ObjectMapper::class)
class CommonJacksonAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(ObjectMapper::class)
    fun objectMapper(): ObjectMapper = jacksonObjectMapper().apply {
        // Modules
        registerModule(JavaTimeModule())
        registerModule(
            KotlinModule.Builder()
                .configure(KotlinFeature.StrictNullChecks, true)
                .configure(KotlinFeature.NullIsSameAsDefault, true)
                .configure(KotlinFeature.SingletonSupport, true)
                .build()
        )

        // Time
        disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)

        // Null
        setSerializationInclusion(JsonInclude.Include.NON_NULL)

        // Forward-compat
        disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)

        // Numbers
        enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)

        // Enum
        enable(MapperFeature.ACCEPT_CASE_INSENSITIVE_ENUMS)

        // Naming: 기본 camelCase. snake_case 적용은 외부 API ADR 결정 후 추가
        // setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)

        // Security
        factory.streamReadConstraints = StreamReadConstraints.builder()
            .maxNestingDepth(100)
            .maxStringLength(10_000_000)
            .maxNumberLength(1000)
            .build()
    }
}
```

| 항목 | 평가 |
|---|---|
| 운영 안정성 | ◯ — 모든 동작 명시 |
| 일관성 | ◯ — 전 서비스 동일 정책 |
| 영향도 | L3 — common 빌드 → 전 서비스 재빌드 |
| 위험 | strictNullChecks=true 로 옛 응답 파싱 실패할 수 있음 (감추던 데이터 무결성 문제 발견) |

### 결정 (제안)

→ **안 B 채택**, 단 `strictNullChecks` 만 phase 별 (1단계 false 로 시작 → 모니터링 후 2단계 true). [19](19-improvements.md) 에 단계적 적용 계획 명시.

## 3. 결정 #2 — AOP 표준 패턴

현재 0건 → 도입 시 어떤 패턴을 표준으로?

### 안 A. Micrometer `@Timed` 만 사용

```kotlin
import io.micrometer.core.annotation.Timed

@Service
class ExternalApiClient(...) {

    @Timed(value = "external.api.duration", extraTags = ["api", "bithumb"])
    fun fetchPrice(symbol: String): Price = ...
}
```

| 항목 | 평가 |
|---|---|
| 도입 비용 | ◯ — 라이브러리만 추가 |
| 학습 곡선 | ◯ — Micrometer 표준 |
| 확장성 | △ — timing 외 작업은 별도 Aspect 필요 |

### 안 B. common 에 표준 Aspect 등록

```kotlin
// common/src/main/kotlin/com/kgd/common/aop/

@Target(AnnotationTarget.FUNCTION, AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
annotation class ExternalCall(val name: String)

@Aspect
@Component
class ExternalCallAspect(
    private val registry: MeterRegistry
) {

    @Around("@annotation(externalCall)")
    fun around(pjp: ProceedingJoinPoint, externalCall: ExternalCall): Any? {
        val timer = Timer.builder("external.call")
            .tag("name", externalCall.name)
            .register(registry)

        val sample = Timer.start(registry)
        return try {
            val result = pjp.proceed()
            // Mono / Flux 반환 감지
            when (result) {
                is Mono<*> -> result.doFinally { sample.stop(timer.tag("status", "ok")) }
                is Flux<*> -> result.doFinally { sample.stop(timer.tag("status", "ok")) }
                else -> { sample.stop(timer.tag("status", "ok")); result }
            }
        } catch (e: Exception) {
            sample.stop(timer.tag("status", "error"))
            throw e
        }
    }
}
```

```kotlin
// 사용처
@Service
class BithumbClient(...) {
    @ExternalCall(name = "bithumb.ticker")
    suspend fun getTicker(symbol: String): Ticker = ...
}
```

| 항목 | 평가 |
|---|---|
| 도입 비용 | 중간 — Aspect + AutoConfig + 의존성 |
| 학습 곡선 | △ — 팀 표준 학습 필요 |
| 확장성 | ◯ — 어노테이션 추가만으로 새 cross-cutting |
| Mono/Flux 호환 | ◯ — 명시 처리 |
| Latency Budget (ADR-0025) 와 정합 | ◯ — 외부 호출 시간 자동 메트릭 |

### 결정 (제안)

→ **안 A (Micrometer @Timed) 1단계 + 안 B 2단계**. 표준 메트릭은 Micrometer 로 충분. 서비스 간 일관된 메트릭 이름이 필요해지면 그때 common 에 Aspect 등록.

추가 후보 Aspect:

- **`@Auditable`** — order, payment, gifticon 의 감사 로그 자동 기록 (ADR (Architecture Decision Record, 아키텍처 결정 기록) -0026 audit-log immutability 와 연결)
- **`@TenantBoundary`** — quant 의 tenantId 자동 검증 (현재 ArgumentResolver 로 처리)

## 4. 결정 #3 — gzip 활성화 위치

### 안 A. 각 서비스의 application.yml

```yaml
server:
  compression:
    enabled: true
    mime-types: application/json,...
    min-response-size: 1024
```

| 항목 | 평가 |
|---|---|
| 일관성 | ✗ — 서비스마다 다르게 설정될 위험 |
| 운영 | ✗ — 12+ 서비스 yml 변경 |
| CPU 부담 | ✗ — 서비스 노드 |
| 단순성 | △ |

### 안 B. ingress-nginx ConfigMap (Helm values)

```yaml
# k8s/infra/local/ingress-nginx/values.yaml
controller:
  config:
    use-gzip: "true"
    gzip-level: "6"
    gzip-min-length: "1024"
    gzip-types: "application/json text/plain application/xml application/javascript text/css"
```

| 항목 | 평가 |
|---|---|
| 일관성 | ◯ — 한 곳 |
| 운영 | ◯ — 한 번 설정 |
| CPU 부담 | ◯ — ingress controller 노드 (별도 pool 권장) |
| 단순성 | ◯ |
| BREACH 대응 | △ — path 별 분리 필요 시 별도 ingress 또는 annotation |

### 안 C. CDN (CloudFront)

| 항목 | 평가 |
|---|---|
| 일관성 | ◯ |
| 운영 | ◯ — 콘솔 한 줄 |
| CPU 부담 | 0 |
| 적용 시점 | CDN 도입 후 (msa 는 아직 미도입) |

### 결정 (제안)

→ **안 B (ingress) 1순위**. CDN 도입되면 거기서도 자동 압축 (안 C 보강).

추가 정책:

| Path | gzip | Cache-Control |
|---|---|---|
| `/api/products`, `/api/search` (공개 GET) | ◯ | `public, max-age=60` (있으면) |
| `/api/v1/strategies/*/paper/sse` (SSE) | **✗** | (no-cache) |
| `/api/auth/**`, `/api/members/me/**` | △ | `private, no-store` (BREACH 위험 path 면 ✗) |
| 이미지/비디오 | ✗ | (이미 압축됨) |

→ ingress configuration-snippet 또는 별도 ingress 분리.

## 5. 결정 #4 — trace ID 표준

현재 분산 추적 헤더 미사용. msa 의 멀티 서비스 호출에서 한 요청을 끝까지 따라가기 어려움.

### 안: common Filter (서비스 측) + gateway WebFilter

#### 5.1. gateway 의 WebFilter

```kotlin
// gateway/.../filter/TraceIdFilter.kt (신규)
@Component
class TraceIdFilter : GlobalFilter, Ordered {
    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE - 1

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val traceId = exchange.request.headers.getFirst(TRACE_HEADER)
            ?: UUID.randomUUID().toString()

        val mutatedRequest = exchange.request.mutate()
            .header(TRACE_HEADER, traceId)
            .build()
        exchange.response.headers.set(TRACE_HEADER, traceId)

        return chain.filter(exchange.mutate().request(mutatedRequest).build())
    }

    companion object { const val TRACE_HEADER = "X-Trace-Id" }
}
```

#### 5.2. common 의 Servlet Filter (모든 서비스 적용)

```kotlin
// common/src/main/kotlin/com/kgd/common/web/TraceIdFilter.kt (신규)
class TraceIdFilter : OncePerRequestFilter() {

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        chain: FilterChain
    ) {
        val traceId = request.getHeader(TRACE_HEADER) ?: UUID.randomUUID().toString()
        MDC.put(MDC_KEY, traceId)
        response.setHeader(TRACE_HEADER, traceId)
        try {
            chain.doFilter(request, response)
        } finally {
            MDC.remove(MDC_KEY)
        }
    }

    companion object {
        const val TRACE_HEADER = "X-Trace-Id"
        const val MDC_KEY = "traceId"
    }
}

@AutoConfiguration
@ConditionalOnClass(OncePerRequestFilter::class)
class CommonWebAutoConfiguration {

    @Bean
    fun traceIdFilterRegistration(): FilterRegistrationBean<TraceIdFilter> {
        val reg = FilterRegistrationBean(TraceIdFilter())
        reg.urlPatterns = listOf("/*")
        reg.order = Ordered.HIGHEST_PRECEDENCE
        return reg
    }
}
```

#### 5.3. logback 패턴 추가

```xml
<pattern>%d{HH:mm:ss.SSS} [%thread] [%X{traceId:-}] %-5level %logger - %msg%n</pattern>
```

→ 모든 로그에 `[trace-id]` 가 자동 출력 → ELK/Loki 에서 한 요청 검색 가능.

### Reactor 에서의 MDC 한계

WebFlux 는 thread-per-request 가 아니라서 MDC 가 자연스럽게 전파 안 됨. 별도 처리 필요:

```kotlin
// gateway 의 logging
return chain.filter(exchange)
    .contextWrite { it.put("traceId", traceId) }
// + io.micrometer.context.ContextRegistry 또는 reactor-extra 의 MDC 헬퍼
```

→ Reactor MDC 전파는 별도 학습 필요 (이번 17번 범위 외). 1단계는 gateway 로그에만 traceId 직접 출력하고, MDC 자동 전파는 추후.

### 결정 (제안)

→ **gateway WebFilter + common Servlet Filter 둘 다 도입**. logback 패턴 추가 동반.

## 6. ResponseBodyAdvice — ApiResponse 자동 래핑

현재 컨트롤러가 `ApiResponse.success(...)` 명시 호출. 자동 래핑하면 보일러플레이트 ↓.

### 안

```kotlin
// common/src/main/kotlin/com/kgd/common/web/ApiResponseAdvice.kt
@RestControllerAdvice
class ApiResponseAdvice : ResponseBodyAdvice<Any> {

    override fun supports(returnType: MethodParameter, converterType: Class<out HttpMessageConverter<*>>) =
        returnType.parameterType != ApiResponse::class.java &&
        returnType.parameterType != ResponseEntity::class.java

    override fun beforeBodyWrite(
        body: Any?,
        returnType: MethodParameter,
        contentType: MediaType,
        converterType: Class<out HttpMessageConverter<*>>,
        request: ServerHttpRequest,
        response: ServerHttpResponse
    ): Any? {
        // 이미 ApiResponse 인 응답은 그대로
        if (body is ApiResponse<*>) return body
        return ApiResponse.success(body)
    }
}
```

| 항목 | 평가 |
|---|---|
| 보일러플레이트 절감 | ◯ |
| 명시성 | △ — 컨트롤러 코드만 보면 응답 구조 안 보임 |
| 마이그레이션 비용 | △ — 기존 코드의 명시 호출 제거 단계 필요 |

### 결정 (제안)

→ **선택사항**. 새 서비스에 우선 도입 후 효과 확인. 기존 서비스 일괄 변경은 L3 라 신중.

## 7. 종합 — 본 학습 결과 [19](19-improvements.md) 입력

| # | 결정 | 우선순위 | ADR 필요 | 영향도 |
|---|---|---|---|---|
| 1 | common ObjectMapper 모듈/설정 보강 | **높음** | Y (마이너) | L3 |
| 2 | gzip 활성화: ingress-nginx 한 곳 | **높음** | Y | L2 |
| 3 | trace ID Filter (gateway WebFilter + common Servlet Filter) | **높음** | Y (마이너) | L2 |
| 4 | Micrometer @Timed 활용 가이드 + common @ExternalCall Aspect (장기) | 중간 | Y (장기) | L2 |
| 5 | ApiResponseAdvice 자동 래핑 | 낮음 | N (선택) | L2 |
| 6 | BREACH 대응: 민감 path gzip 분리 | 낮음 | Y (gzip ADR 안에 포함) | L2 |
| 7 | gateway → 다운스트림 mTLS / NetworkPolicy | 낮음 (장기) | Y (L3) | 매우 높음 |

상세는 [19](19-improvements.md).

## 8. 면접 답변

### Q. msa 의 ObjectMapper 표준화는 어떻게 했나요?

> "common 모듈의 `CommonJacksonAutoConfiguration` 에서 `@ConditionalOnMissingBean` 으로 표준 ObjectMapper 빈을 등록합니다. KotlinModule (strictNullChecks 점진 적용), JavaTimeModule, NON_NULL inclusion, FAIL_ON_UNKNOWN_PROPERTIES disable, BigDecimal float 처리, snake_case 정책 (외부 API 결정 후), 그리고 maxNestingDepth/maxStringLength 같은 보안 limit 까지 명시합니다. 서비스가 자체 빈을 등록하면 그쪽이 우선이라 cherry-pick 도 가능하죠."

### Q. msa 의 gzip 은 어디서 켜요?

> "ingress-nginx ConfigMap 한 곳에서 켭니다. 백엔드 서비스 yml 에 server.compression 을 안 두는 이유는 (1) 일관성 — 서비스마다 다르게 설정될 위험 차단, (2) CPU 비용 — 앱 노드 부담 외주, (3) 운영 — 한 곳 변경. 단, BREACH 대응을 위해 인증 응답 path 는 별도 ingress 또는 annotation 으로 gzip off, SSE 라우트는 gzip_types 에서 text/event-stream 제외합니다."

## 다음 학습

- [19-improvements.md](19-improvements.md) — 본 결정의 우선순위/체크리스트
- [20-interview-qa.md](20-interview-qa.md) — 면접 회독
