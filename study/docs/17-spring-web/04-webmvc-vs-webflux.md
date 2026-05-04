---
parent: 17-spring-web
seq: 04
title: WebMVC vs WebFlux 의 Filter 모델
type: deep
created: 2026-05-01
---

# 04. WebMVC vs WebFlux 의 Filter 모델

> msa 에서 **gateway 만 WebFlux**, 나머지는 WebMVC. 따라서 같은 "Filter" 라는 단어를 두 가지 다른 인터페이스로 써야 한다. 이 파일은 그 차이를 정리한다.

## 1. 한 장 비교

| 항목 | WebMVC (Tomcat) | WebFlux (Reactor Netty) |
|---|---|---|
| 표준 | Servlet API (`jakarta.servlet`) | Reactive Streams + Spring WebFlux |
| 컨테이너 | Tomcat / Jetty / Undertow | Reactor Netty (default), Undertow, Tomcat (rare) |
| 스레드 모델 | thread-per-request (또는 가상 스레드) | event-loop + NIO |
| 진입점 Servlet | `DispatcherServlet` | (Servlet 없음) `DispatcherHandler` |
| 요청 객체 | `HttpServletRequest` | `ServerHttpRequest` / `ServerWebExchange` |
| Filter 인터페이스 | `jakarta.servlet.Filter` | `org.springframework.web.server.WebFilter` |
| Filter 시그니처 | `doFilter(req, res, chain)` | `filter(exchange, chain): Mono<Void>` |
| Spring Cloud Gateway 추가 인터페이스 | (해당 없음) | `GlobalFilter`, `GatewayFilter` |
| Interceptor | `HandlerInterceptor` | `HandlerFilterFunction` (functional) / 별도 Interceptor 없음 |
| 응답 직렬화 | `HttpMessageConverter` (`MappingJackson2HttpMessageConverter`) | `HttpMessageWriter` (`Jackson2JsonEncoder`) |
| 블로킹 IO | OK (가상 스레드면 더더욱) | **금지** — 이벤트 루프 점유 |
| msa 채택 | product, order, search, gifticon, ... 전부 | **gateway 만** |

## 2. 같은 일을 두 모델에서 비교

### 인증 헤더 검증 Filter

**WebMVC**:

```kotlin
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
class JwtAuthFilter(private val validator: JwtTokenValidator) : OncePerRequestFilter() {

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        chain: FilterChain
    ) {
        val token = request.getHeader("Authorization")?.removePrefix("Bearer ")
        val claims = token?.let { validator.validate(it) }
        if (claims == null) {
            response.status = 401
            return
        }
        // 여기서 SecurityContext 등에 저장 가능
        chain.doFilter(request, response)
    }
}
```

**WebFlux** (msa gateway 의 `AuthenticationGatewayFilter` 와 같은 구조):

```kotlin
@Component
class JwtAuthFilter(private val validator: JwtTokenValidator) : WebFilter {

    override fun filter(exchange: ServerWebExchange, chain: WebFilterChain): Mono<Void> {
        val token = exchange.request.headers
            .getFirst(HttpHeaders.AUTHORIZATION)
            ?.removePrefix("Bearer ")

        val claims = token?.let { validator.validate(it) }
        if (claims == null) {
            exchange.response.statusCode = HttpStatus.UNAUTHORIZED
            return exchange.response.setComplete()  // Mono<Void>
        }
        return chain.filter(exchange)
    }
}
```

### 차이점 정리

- WebMVC: `OncePerRequestFilter` 를 상속 → 같은 요청이 forward 되어도 한 번만 실행 (forward/include 시 중복 방지)
- WebFlux: `WebFilter` 는 본질적으로 비동기. `Mono<Void>` 반환이 의무
- WebFlux 에서 동기적으로 "차단" 하려면 chain 호출 안 하고 즉시 `setComplete()` 또는 에러 Mono 반환
- 응답 본문 캐싱은 WebFlux 가 훨씬 까다로움 — `DataBuffer` 단위로 처리해야 하고, 누수 방지를 위해 `DataBufferUtils.release` 가 필수

## 3. Spring Cloud Gateway 의 Filter 종류

msa gateway 가 사용하는 Spring Cloud Gateway 는 WebFlux 위에 추가 추상을 얹는다:

| 종류 | 정체 | 사용처 |
|---|---|---|
| `GlobalFilter` | 모든 라우트에 자동 적용. `Ordered` 인터페이스로 순서 결정 | msa: `VisitorIdFilter`, `RequestLoggingFilter`, `ExperimentAssignmentFilter` |
| `GatewayFilter` | 특정 라우트에만 적용. `RouteLocatorBuilder` 로 endpoint-별 매핑 | msa: `AuthenticationGatewayFilter` (라우트마다 다른 Config 로 적용) |
| `GatewayFilterFactory` | `GatewayFilter` 를 양산하는 factory. `AbstractGatewayFilterFactory<Config>` 상속 | msa: `AuthenticationGatewayFilter` 가 이 패턴 |
| `WebFilter` | Spring WebFlux 표준. Gateway 와도 호환 | (msa 직접 사용 안 함) |

### `GlobalFilter` 예시 (msa `VisitorIdFilter` 발췌)

```kotlin
@Component
class VisitorIdFilter : GlobalFilter, Ordered {

    override fun getOrder(): Int = -10  // Auth 보다 먼저 실행

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val existingCookie = exchange.request.cookies["vid"]?.firstOrNull()?.value
        val visitorId = existingCookie ?: UUID.randomUUID().toString()
        val mutated = exchange.request.mutate()
            .header("X-Visitor-Id", visitorId)
            .build()
        return chain.filter(exchange.mutate().request(mutated).build())
    }
}
```

### `GatewayFilterFactory` 예시 (msa `AuthenticationGatewayFilter` 핵심)

```kotlin
@Component
class AuthenticationGatewayFilter(
    private val jwtTokenValidator: JwtTokenValidator,
    private val redisTemplate: ReactiveRedisTemplate<String, Any>
) : AbstractGatewayFilterFactory<AuthenticationGatewayFilter.Config>(Config::class.java) {

    data class Config(val requiredRoles: List<String> = emptyList())

    override fun apply(config: Config): GatewayFilter = GatewayFilter { exchange, chain ->
        // ... JWT 검증 + 블랙리스트 + role 체크 + 헤더 mutate ...
    }
}
```

→ `GatewayRouteConfig.kt` 에서 라우트별 `requiredRoles` 가 다른 Config 로 주입.

## 4. 같은 코드베이스에 둘이 공존하면?

**msa 의 흥미로운 점**: gateway 만 WebFlux, 나머지는 WebMVC. 같은 `common` 라이브러리를 양쪽이 쓰려면:

| common 컴포넌트 | WebFlux 호환? | 비고 |
|---|---|---|
| `BusinessException` / `ErrorCode` | ✅ | POJO |
| `ApiResponse<T>` | ✅ | POJO |
| `JwtUtil` | ✅ | static-style |
| `GlobalExceptionHandler` (`@RestControllerAdvice`) | ❌ | WebMVC 전용 — gateway 에선 안 먹힘 |
| `CommonJacksonAutoConfiguration` (legacy ObjectMapper) | ✅ | type 만 같으면 OK |
| 가상의 `RequestLoggingFilter` (`OncePerRequestFilter`) | ❌ | gateway 에선 `WebFilter` 별도 작성 필요 |

→ msa 가 gateway 에 별도 `RequestLoggingFilter`, `AuthenticationGatewayFilter` 를 둔 이유.

## 5. AOP 는 둘 다 동일

AOP (Aspect-Oriented Programming, 관점 지향 프로그래밍) 는 HTTP 레이어가 아니라 **메소드 호출 가로채기** 라서 WebMVC/WebFlux 무관:

```kotlin
@Aspect
@Component
class TimingAspect {
    @Around("@annotation(io.micrometer.core.annotation.Timed)")
    fun time(pjp: ProceedingJoinPoint): Any? {
        val start = System.nanoTime()
        try {
            return pjp.proceed()  // 반환이 Mono<T> 라도 그대로 통과
        } finally {
            val elapsed = (System.nanoTime() - start) / 1_000_000
            log.info("$elapsed ms")
        }
    }
}
```

⚠️ **주의**: WebFlux 메소드가 `Mono<T>` 를 반환할 때 `proceed()` 직후의 시간은 "Mono 를 만든 시간" 이지 "구독 완료까지의 시간" 이 아니다. WebFlux 에서 latency 를 정확히 측정하려면:

```kotlin
@Around("@annotation(...)")
fun time(pjp: ProceedingJoinPoint): Any? {
    val start = System.nanoTime()
    val result = pjp.proceed()
    return when (result) {
        is Mono<*> -> result.doFinally { record(start) }
        is Flux<*> -> result.doFinally { record(start) }
        else -> { record(start); result }
    }
}
```

## 6. msa 의 결정

- **gateway** = WebFlux (Spring Cloud Gateway 표준)
- **모든 다른 서비스** = WebMVC + 가상 스레드 (Spring Boot 4 / Tomcat / `spring.threads.virtual.enabled`)
- 이 결정은 ADR (Architecture Decision Record, 아키텍처 결정 기록) -0002 에 있음 — "gateway 만 reactive, 나머지는 blocking + 가상 스레드"

## 7. 면접 한 줄 답변

> "WebMVC 의 Filter 는 `jakarta.servlet.Filter` 라 동기 doFilter, WebFlux 의 Filter 는 `WebFilter` 또는 Spring Cloud Gateway 의 `GlobalFilter`/`GatewayFilter` 라 `Mono<Void>` 비동기입니다. msa 는 gateway 만 WebFlux 라 거기엔 `WebFilter` 계열만 쓸 수 있고, 나머지 서비스에선 표준 Servlet Filter 를 씁니다. AOP 는 메소드 호출 단위라 양쪽 동일하게 동작하지만, Mono 반환 시 시간 측정은 doFinally 로 구독 완료 후를 기준 잡아야 정확합니다."

## 다음 학습

- [05-servlet-filter.md](05-servlet-filter.md) — WebMVC 쪽 Servlet Filter 깊이
- [17-msa-gateway-filter.md](17-msa-gateway-filter.md) — gateway 의 WebFlux filter 체인 분석
