---
parent: 17-spring-web
seq: 17
title: msa gateway Filter chain 실제 구조 분석
type: deep
created: 2026-05-01
---

# 17. msa gateway Filter chain 실제 구조 분석

> 본 파일은 msa 의 실제 gateway 코드를 읽으며 [04](04-webmvc-vs-webflux.md)/[06](06-security-filter-chain.md) 에서 다룬 개념이 어떻게 구체화됐는지 확인한다.

## 1. gateway 의 Filter 풍경

```
[Client]
    │
    ▼
┌──────────────────────────────────────────────┐
│  ingress-nginx (k8s)                         │
│  - TLS terminate                             │
│  - L7 라우팅: host/path                       │
│  - (현재 gzip 미설정)                          │
└──────────────────┬───────────────────────────┘
                   ▼
┌──────────────────────────────────────────────┐
│  gateway pod (Reactor Netty + WebFlux)       │
│                                              │
│  GlobalFilter chain (Spring Cloud Gateway):  │
│   ┌──────────────────────────────────────┐   │
│   │ RequestLoggingFilter                  │   │
│   │   order = HIGHEST_PRECEDENCE          │   │
│   │   - 진입 시간 기록                     │   │
│   │   - chain.filter(...).doFinally {     │   │
│   │       응답 status + duration 로깅      │   │
│   │     }                                  │   │
│   └──────────────────────────────────────┘   │
│                  ▼                            │
│   ┌──────────────────────────────────────┐   │
│   │ VisitorIdFilter                       │   │
│   │   order = -10                         │   │
│   │   - vid 쿠키 → X-Visitor-Id 헤더       │   │
│   │   - 신규 방문자면 쿠키 set              │   │
│   └──────────────────────────────────────┘   │
│                  ▼                            │
│   ┌──────────────────────────────────────┐   │
│   │ ExperimentAssignmentFilter            │   │
│   │   - A/B 테스트 bucket 할당              │   │
│   │   - X-Experiment-* 헤더 주입            │   │
│   └──────────────────────────────────────┘   │
│                  ▼                            │
│   ┌──────────────────────────────────────┐   │
│   │ AuthenticationGatewayFilter           │   │
│   │   (GatewayFilterFactory)              │   │
│   │   - 라우트별 requiredRoles Config       │   │
│   │   - JWT 검증 + Redis 블랙리스트         │   │
│   │   - X-User-Id, X-User-Roles 헤더 주입   │   │
│   │   - Fail-Open: Redis 장애 시 통과       │   │
│   └──────────────────────────────────────┘   │
│                  ▼                            │
│   ┌──────────────────────────────────────┐   │
│   │ Spring Cloud Gateway Built-in Filters │   │
│   │   - StripPrefix(0)                    │   │
│   │   - RedisRateLimiter (특정 라우트)      │   │
│   └──────────────────────────────────────┘   │
│                  ▼                            │
│   ┌──────────────────────────────────────┐   │
│   │ NettyRoutingFilter                    │   │
│   │   - downstream URI 로 HTTP 호출         │   │
│   └──────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
                   ▼
            (downstream 서비스)
```

## 2. 각 Filter 코드 리뷰

### 2.1. RequestLoggingFilter

```kotlin
// gateway/src/main/kotlin/com/kgd/gateway/filter/RequestLoggingFilter.kt
@Component
class RequestLoggingFilter : GlobalFilter, Ordered {

    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val start = Instant.now()
        val request = exchange.request
        val method = request.method
        val uri = request.uri

        return chain.filter(exchange).doFinally {
            val duration = Duration.between(start, Instant.now()).toMillis()
            val statusCode = exchange.response.statusCode?.value() ?: 0
            log.info("[$method] $uri → $statusCode (${duration}ms)")
        }
    }
}
```

**평가**:

- ✅ `HIGHEST_PRECEDENCE` — 다른 모든 Filter 의 시간을 포함
- ✅ `doFinally` 사용 — Mono 의 라이프사이클 따라 정확한 종료 시점에 측정
- △ trace ID 미주입 — 분산 추적이 어려움 ([19](19-improvements.md) 후보)
- △ MDC 사용 안 함 — Reactor 의 Context 로 trace 전파 패턴이 별도 필요

### 2.2. VisitorIdFilter

```kotlin
// gateway/src/main/kotlin/com/kgd/gateway/filter/VisitorIdFilter.kt
@Component
class VisitorIdFilter : GlobalFilter, Ordered {

    companion object {
        const val VISITOR_COOKIE = "vid"
        const val VISITOR_HEADER = "X-Visitor-Id"
    }

    override fun getOrder(): Int = -10  // Run before auth filter

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val existingCookie = exchange.request.cookies[VISITOR_COOKIE]?.firstOrNull()?.value
        val visitorId = existingCookie ?: UUID.randomUUID().toString()

        val mutatedRequest = exchange.request.mutate()
            .header(VISITOR_HEADER, visitorId)
            .build()
        val mutatedExchange = exchange.mutate().request(mutatedRequest).build()

        if (existingCookie == null) {
            mutatedExchange.response.addCookie(
                ResponseCookie.from(VISITOR_COOKIE, visitorId)
                    .path("/").maxAge(Duration.ofDays(365)).httpOnly(true).build()
            )
        }
        return chain.filter(mutatedExchange)
    }
}
```

**평가**:

- ✅ `httpOnly` — JS 접근 차단
- ✅ 365일 maxAge — 트래킹 일관성
- △ `secure` 빠짐 — 프로덕션 HTTPS 환경이면 `secure(true)` 추가 권장
- △ `sameSite` 빠짐 — `Strict` 또는 `Lax` 명시 권장 (CSRF 방어)
- △ 익명 트래킹 — GDPR/PIPA 관점에서 정책 명시 필요 (cookie banner)

### 2.3. AuthenticationGatewayFilter

```kotlin
// gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt
@Component
class AuthenticationGatewayFilter(
    private val jwtTokenValidator: JwtTokenValidator,
    private val redisTemplate: ReactiveRedisTemplate<String, Any>
) : AbstractGatewayFilterFactory<AuthenticationGatewayFilter.Config>(Config::class.java) {

    data class Config(val requiredRoles: List<String> = emptyList())

    override fun apply(config: Config): GatewayFilter = GatewayFilter { exchange, chain ->
        val request = exchange.request
        val authHeader = request.headers.getFirst(HttpHeaders.AUTHORIZATION)
        val token = jwtTokenValidator.extractFromHeader(authHeader)

        if (token == null) {
            log.warn("Missing or invalid Authorization header: {}", request.uri)
            exchange.response.statusCode = HttpStatus.UNAUTHORIZED
            return@GatewayFilter exchange.response.setComplete()
        }

        // JWT 블랙리스트 체크 (Fail-Open: Redis 장애 시 허용)
        redisTemplate.hasKey("blacklist:$token")
            .onErrorReturn(false)
            .flatMap { isBlacklisted ->
                if (isBlacklisted) {
                    exchange.response.statusCode = HttpStatus.UNAUTHORIZED
                    exchange.response.setComplete()
                } else {
                    val claims = jwtTokenValidator.validateAndExtract(token)
                    if (claims == null) {
                        exchange.response.statusCode = HttpStatus.UNAUTHORIZED
                        exchange.response.setComplete()
                    } else {
                        val userId = claims.get("userId", String::class.java) ?: ""
                        @Suppress("UNCHECKED_CAST")
                        val roles = (claims.get("roles", List::class.java) as? List<*>)
                            ?.map { it.toString() } ?: emptyList()

                        if (config.requiredRoles.isNotEmpty() &&
                            !hasRequiredRole(roles, config.requiredRoles)
                        ) {
                            exchange.response.statusCode = HttpStatus.FORBIDDEN
                            return@flatMap exchange.response.setComplete()
                        }

                        val mutatedRequest = request.mutate()
                            .header("X-User-Id", userId)
                            .header("X-User-Roles", roles.joinToString(","))
                            .build()
                        chain.filter(exchange.mutate().request(mutatedRequest).build())
                    }
                }
            }
    }
    // ...
}
```

**평가**:

- ✅ `GatewayFilterFactory` 패턴 — 라우트별 Config 주입 ([04](04-webmvc-vs-webflux.md))
- ✅ Fail-Open — Redis 장애로 전 사용자 인증 거부 사태 방지
- ✅ X-User-Id / X-User-Roles 다운스트림 전파
- ⚠️ **다운스트림이 헤더를 신뢰** — 외부 직접 호출 가능하면 위조 위험 ([19](19-improvements.md), 13번 mTLS 학습 연결)
- △ kid/iss/aud claim 검증 안 함 — JWT 표준 클레임 보강 후보 (이미 13번 19-improvements 의 1순위)
- △ 인증 path 화이트리스트 (`/api/auth/login`) 가 SecurityConfig 가 아닌 GatewayRouteConfig 에서 분기 — Spring Security 표준 어긋남

### 2.4. SecurityConfig (skeleton)

```kotlin
// gateway/src/main/kotlin/com/kgd/gateway/config/SecurityConfig.kt
@Configuration
@EnableWebFluxSecurity
class SecurityConfig {
    @Bean
    fun securityWebFilterChain(http: ServerHttpSecurity): SecurityWebFilterChain =
        http
            .csrf { it.disable() }
            .authorizeExchange { exchanges -> exchanges.anyExchange().permitAll() }
            .build()
}
```

**평가**:

- WebFlux Security 의 13개 Filter 가 등록되긴 하지만 **모두 permitAll** 로 인증 위임
- 실제 인증은 `AuthenticationGatewayFilter` 가 라우트별로 처리
- **trade-off**: Spring Security 의 OAuth2 client / JWT decoder / `@PreAuthorize` 같은 표준 컴포넌트 모두 미사용

→ 외부 IdP 도입 시 (Cognito/Keycloak) 이 구조를 ServerHttpSecurity 의 OAuth2 + JWT decoder 표준 구성으로 이전하는 게 자연스러움. **장기 ADR 후보**.

### 2.5. RateLimiterConfig

```kotlin
// gateway/src/main/kotlin/com/kgd/gateway/config/RateLimiterConfig.kt
@Configuration
class RateLimiterConfig {

    @Bean
    @Primary
    fun userKeyResolver(): KeyResolver = KeyResolver { exchange ->
        Mono.just(
            exchange.request.headers.getFirst("X-User-Id")
                ?: exchange.request.remoteAddress?.address?.hostAddress
                ?: "unknown"
        )
    }

    @Bean
    fun redisRateLimiter(): RedisRateLimiter =
        RedisRateLimiter(100, 200, 1)
}
```

**평가**:

- ✅ Token Bucket 알고리즘 — 100 token/sec replenish, 200 burst capacity
- ✅ KeyResolver 가 X-User-Id fallback to IP — 미인증 호출도 식별 가능
- △ `RedisRateLimiter(100, 200, 1)` 가 모든 라우트 동일 — Flash Sale 같은 예외 라우트는 별도 limiter 필요
- △ 환경변수로 조절 안 됨 — burst 시 재시작 필요. 운영 hot-tuning 어려움

## 3. Filter 순서 검증

`@Order` / `Ordered.getOrder()` 값:

| 위치 | Filter | order | 의도 |
|---|---|---|---|
| 1 | RequestLoggingFilter | `Integer.MIN_VALUE` (HIGHEST_PRECEDENCE) | 모든 시간 측정 포함 |
| 2 | VisitorIdFilter | `-10` | 인증 전 vid 헤더 |
| 3 | ExperimentAssignmentFilter | (확인 필요) | A/B bucket 할당 |
| 4 | AuthenticationGatewayFilter | (라우트마다 명시) | 인증 |
| 5 | RedisRateLimiter | (Spring Cloud Gateway 내부) | 인증된 user 기준 limit |
| 6 | NettyRoutingFilter | `Ordered.LOWEST_PRECEDENCE` | downstream forward |

→ 순서 자체는 합리적. **명시 안 된 순서가 우연 의존이지 않게 모두 `Ordered` 명시 권장** ([19](19-improvements.md)).

## 4. 다운스트림 측의 가정

gateway 다음 단계 (예: product, order) 는 다음을 가정:

- `X-User-Id` 가 있으면 인증된 사용자
- `X-User-Roles` 가 콤마 구분 role 리스트
- `X-Visitor-Id` 가 있으면 트래킹 가능

⚠️ 위험: 누군가 gateway 우회해서 다운스트림 직접 호출하면 `X-User-Id: anything` 위조 가능.

### 방어 후보

| 패턴 | 효과 | 비용 |
|---|---|---|
| K8s NetworkPolicy | gateway pod 만 다운스트림 호출 가능 | 운영 ↑ |
| mTLS (Istio/Linkerd) | gateway 의 cert 검증 | 서비스 메시 도입 |
| 다운스트림에 별도 Filter | "X-Internal-Auth" secret 검증 | 약함 (secret 노출 시 무력) |

→ 13번 학습 (#13 ADR-0019) 의 mTLS / 서비스 메시 도입과 직결.

## 5. WebFlux 의 함정 — 본문 다루기

gateway 의 Filter 는 거의 **헤더만** 다룬다. 본문(request body) 을 보고 싶다면:

```kotlin
// 이렇게 하면 안 됨
val body = exchange.request.body
    .map { it.asInputStream().bufferedReader().readText() }
    .blockFirst()  // ❌ 이벤트 루프 블로킹

// 정공: ModifyRequestBodyGatewayFilterFactory 또는 RequestBodyDecodingFilter
```

→ msa 는 현재 gateway 에서 본문을 다루지 않음 (인증 헤더 + 라우팅만). 본문 검증/변형은 다운스트림 책임.

## 6. trace ID 추가하려면? (제안)

```kotlin
@Component
class TraceIdFilter : GlobalFilter, Ordered {
    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE - 1   // RequestLoggingFilter 보다도 먼저

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val traceId = exchange.request.headers.getFirst("X-Trace-Id")
            ?: UUID.randomUUID().toString()

        val mutatedRequest = exchange.request.mutate()
            .header("X-Trace-Id", traceId)
            .build()

        exchange.response.headers.set("X-Trace-Id", traceId)

        return chain.filter(exchange.mutate().request(mutatedRequest).build())
            .contextWrite { it.put("traceId", traceId) }   // Reactor Context 로 전파
    }
}
```

→ 다운스트림 서비스(WebMVC)에선 받은 `X-Trace-Id` 를 Filter/Interceptor 에서 MDC 에 put.

## 7. 면접 답변 — "msa gateway 의 Filter 구조를 설명해줘요"

> "msa 의 gateway 는 Spring Cloud Gateway (WebFlux) 라 `GlobalFilter` 와 `GatewayFilter` 두 종류를 씁니다. 모든 라우트 공통은 `GlobalFilter` — `RequestLoggingFilter` 가 HIGHEST_PRECEDENCE 로 진입/종료 시간을 측정하고, `VisitorIdFilter` 가 익명 vid 쿠키와 헤더를 주입합니다. 인증은 `AuthenticationGatewayFilter` 가 `GatewayFilterFactory` 패턴으로 라우트별 requiredRoles Config 를 받아 JWT 검증 + Redis 블랙리스트 체크 + 다운스트림에 X-User-Id / X-User-Roles 헤더 주입을 담당합니다. Redis 가 죽으면 fail-open 으로 통과시켜 인증 인프라 단일 장애가 전 서비스 마비로 이어지지 않게 했고, 라우트별 RedisRateLimiter 가 100 token/sec / 200 burst 로 보호합니다. 향후 외부 IdP 도입 시 ServerHttpSecurity 표준 OAuth2/JWT decoder 로 이전하는 게 자연스러운 다음 단계입니다."

## 다음 학습

- [18-msa-common-patterns.md](18-msa-common-patterns.md) — common 모듈의 ObjectMapper / AOP / gzip 결정
- [19-improvements.md](19-improvements.md) — 표준화 후보 종합
