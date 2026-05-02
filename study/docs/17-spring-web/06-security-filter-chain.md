---
parent: 17-spring-web
seq: 06
title: Spring Security FilterChainProxy
type: deep
created: 2026-05-01
---

# 06. Spring Security FilterChainProxy

> "Spring Security 의 Filter 들은 어떻게 일반 Servlet Filter chain 에 박히나요?" 가 면접 단골이다. 답은 **DelegatingFilterProxy → FilterChainProxy → SecurityFilterChain[]** 의 3층 구조.

## 1. 큰 그림

```
Servlet Container (Tomcat) Filter chain
   │
   ├─ CharacterEncodingFilter
   ├─ ...
   ├─ DelegatingFilterProxy (이름: "springSecurityFilterChain")
   │      │  실제로는 ApplicationContext 에서 같은 이름의 빈을 lookup 해서 위임
   │      ▼
   │   FilterChainProxy  (Spring 빈)
   │      │
   │      ├─ SecurityFilterChain[0]  match: /admin/**
   │      │     └─ 13개 Security Filter 들
   │      ├─ SecurityFilterChain[1]  match: /api/**
   │      │     └─ ...
   │      └─ SecurityFilterChain[N]  match: /**  (catch-all)
   │
   ├─ ApplicationFilterChain.doFilter(...)
   │
   └─ DispatcherServlet
```

## 2. 왜 이렇게 복잡한가

- **Servlet Filter chain** 은 Servlet 컨테이너가 관리. Filter 빈을 거기에 박으려면 컨테이너 표준 hook 이 필요.
- **DelegatingFilterProxy** 는 컨테이너 입장에선 평범한 Filter 1개. 호출되면 Spring `ApplicationContext` 에서 자기 이름과 같은 빈을 찾아 그쪽으로 `doFilter` 위임 → "표준 Servlet Filter 인 척하면서 Spring 빈을 사용" 가능.
- **FilterChainProxy** 는 그 위임을 받은 Spring 빈. 내부에 `SecurityFilterChain[]` 을 들고 있고, 매칭되는 chain 의 Filter 들을 순회.
- **SecurityFilterChain** 은 보통 `HttpSecurity` DSL 로 구성하는 13개 안팎의 Filter 묶음.

## 3. 표준 Security Filter 13개 (대략 순서)

WebMVC 에서 `EnableWebSecurity` + 기본 설정 시 등록되는 핵심 Filter 들:

| # | 이름 | 책임 |
|---|---|---|
| 1 | `DisableEncodeUrlFilter` | URL 인코딩 비활성 (세션 토큰 누출 방지) |
| 2 | `WebAsyncManagerIntegrationFilter` | async 요청에 SecurityContext 전파 |
| 3 | `SecurityContextHolderFilter` | 요청별 SecurityContext load/save (이전엔 `SecurityContextPersistenceFilter`) |
| 4 | `HeaderWriterFilter` | XFO/CSP 등 보안 헤더 주입 |
| 5 | `CorsFilter` | CORS 처리 (Spring Security 가 통합) |
| 6 | `CsrfFilter` | CSRF 토큰 검증 (REST 면 보통 disable) |
| 7 | `LogoutFilter` | 로그아웃 처리 |
| 8 | `OAuth2AuthorizationRequestRedirectFilter` | OAuth2 클라이언트 흐름 |
| 9 | `UsernamePasswordAuthenticationFilter` | form 로그인 처리 |
| 10 | `DefaultLoginPageGeneratingFilter` | 로그인 페이지 자동 생성 |
| 11 | `BasicAuthenticationFilter` | HTTP Basic 처리 |
| 12 | `RequestCacheAwareFilter` | 인증 후 원래 URL 복귀 |
| 13 | `SecurityContextHolderAwareRequestFilter` | `HttpServletRequest` 에 보안 wrapper |
| 14 | `AnonymousAuthenticationFilter` | 미인증 시 anonymous 토큰 |
| 15 | `SessionManagementFilter` (Spring Security 6 에선 권장 안 함) | 세션 fixation 등 |
| 16 | `ExceptionTranslationFilter` | 인증/인가 예외 → HTTP status 변환 |
| 17 | `AuthorizationFilter` | 권한 체크 (이전 `FilterSecurityInterceptor` 대체) |

⚠️ Spring Security 6 부터 일부 Filter 명칭/구성 바뀜. 시험 답변 시 "버전마다 조금씩 다릅니다" 라고 단서 달기.

## 4. JWT Stateless 인증 시 흔한 변형

**Authorization 헤더 → JWT 검증 → SecurityContext 설정** 까지가 표준 패턴:

```kotlin
class JwtAuthenticationFilter(
    private val jwtUtil: JwtUtil
) : OncePerRequestFilter() {

    override fun doFilterInternal(req, res, chain) {
        val token = req.getHeader("Authorization")?.removePrefix("Bearer ")
        if (token != null) {
            val claims = runCatching { jwtUtil.validate(token) }.getOrNull()
            if (claims != null) {
                val auth = UsernamePasswordAuthenticationToken(
                    claims["userId"],
                    null,
                    (claims["roles"] as List<*>).map { SimpleGrantedAuthority(it.toString()) }
                )
                SecurityContextHolder.getContext().authentication = auth
            }
        }
        chain.doFilter(req, res)
    }
}

@Configuration
@EnableWebSecurity
class SecurityConfig {

    @Bean
    fun chain(http: HttpSecurity, jwtFilter: JwtAuthenticationFilter): SecurityFilterChain =
        http
            .csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(STATELESS) }
            .authorizeHttpRequests { auth ->
                auth.requestMatchers("/api/auth/**").permitAll()
                    .anyRequest().authenticated()
            }
            // UsernamePasswordAuthenticationFilter 자리에 우리 JWT Filter 를 박음
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter::class.java)
            .build()
}
```

### 핵심 포인트

- `addFilterBefore`/`addFilterAfter`/`addFilterAt` 가 SecurityFilterChain 안에 끼워 넣는 hook
- **Servlet 의 일반 Filter chain 이 아니라** `FilterChainProxy` 안의 `SecurityFilterChain` 안에 들어감
- 즉, "JWT Filter 의 order" 는 `FilterRegistrationBean.order` 가 아니라 **SecurityFilterChain DSL 의 위치** 로 결정

## 5. msa 의 현재 상태 (gateway WebFlux)

msa 의 gateway 는 WebMVC 가 아니라 **WebFlux + Spring Cloud Gateway** 라 위 13 Filter 모델이 그대로 적용되지 않는다. 대신:

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

- WebFlux 버전: `SecurityWebFilterChain` (`Filter` → `WebFilter` 로 변경)
- 현재 msa 는 **모든 요청을 permitAll** 하고, 인증은 `AuthenticationGatewayFilter` (커스텀 GatewayFilter) 가 라우트별로 적용
- 즉 Spring Security 의 13개 Filter 는 **거의 활용 안 함** — msa 는 WebFlux Security 를 "껍데기" 만 등록한 상태

### 이게 문제인가?

| 관점 | 평가 |
|---|---|
| 단순성 | ◯ — 인증 로직이 1개 Filter 안에 모여있음 |
| 표준 호환성 | △ — Spring Security 의 OAuth2 client / JWT decoder 같은 표준 컴포넌트와 단절 |
| RBAC 통합 | △ — `@PreAuthorize` 는 다운스트림 서비스에서 따로 등록해야 |
| 외부 IdP 연동 | ✗ — Cognito/Keycloak 도입 시 다 다시 짜야 |

→ 단기 운영엔 OK, 중장기 IdP 도입 시 이 결정 재검토 필요 ([19](19-improvements.md)).

## 6. `DelegatingFilterProxy` 동작 단계

```
1. ServletContainer 가 web.xml/AnnotationConfig 시점에
   "DelegatingFilterProxy" 를 일반 Filter 로 등록
   (Spring Boot 는 SecurityFilterAutoConfiguration 이 자동 등록)

2. 요청이 들어오면 ServletContainer 가 doFilter() 호출

3. DelegatingFilterProxy.doFilter() 안에서
   - 첫 호출 시 ApplicationContext 에서 빈 lookup
   - 빈 이름은 기본 "springSecurityFilterChain" (= 등록 시 부여한 이름)

4. 찾은 빈은 FilterChainProxy 인스턴스. 거기에 위임.

5. FilterChainProxy.doFilter() 가
   - 등록된 SecurityFilterChain[] 중 매칭되는 첫 번째 chain 선택
   - chain.getFilters() 순회하며 doFilter 호출

6. 모든 Security Filter 통과 후 chain.doFilter(req, res) → 다음 일반 Filter
```

이 구조 덕에 Spring Security 는 **컨테이너에 직접 결합되지 않고**, 빈만 교체해 동작 변경 가능.

## 7. 면접 함정

### Q. "Security Filter 의 순서를 `@Order` 로 바꿀 수 있나요?"

❌ — `SecurityFilterChain` 안의 Filter 순서는 Spring Security 가 내부 enum 으로 강제한다 (`SecurityFilters` 필터 enum). DSL 의 `addFilterBefore`/`After`/`At` 만이 공식 hook.

### Q. "한 애플리케이션에 SecurityFilterChain 을 여러 개 둘 수 있나요?"

✅ — 빈을 여러 개 등록하면 `FilterChainProxy` 가 매칭 순서대로 본다. URL 패턴별로 chain 을 분리하는 게 일반적인 패턴 (관리자 / API / 공개).

```kotlin
@Bean
@Order(1)
fun adminChain(http: HttpSecurity): SecurityFilterChain =
    http.securityMatcher("/admin/**").authorizeHttpRequests { ... }.build()

@Bean
@Order(2)
fun apiChain(http: HttpSecurity): SecurityFilterChain =
    http.securityMatcher("/api/**").authorizeHttpRequests { ... }.build()
```

### Q. "Filter 안에서 throw 한 `AuthenticationException` 은 누가 잡나요?"

`ExceptionTranslationFilter` — Security Filter chain 안에서 catch 후 `AuthenticationEntryPoint` 또는 `AccessDeniedHandler` 호출. 일반 `@RestControllerAdvice` 까지 가지 않음.

## 8. 면접 한 줄 답변

> "Spring Security 의 Filter 들은 `DelegatingFilterProxy` 라는 일반 Servlet Filter 1개 안에서 실행됩니다. 컨테이너는 그 한 개의 프록시만 알고, 안에서 `FilterChainProxy` 가 등록된 `SecurityFilterChain[]` 중 매칭되는 chain 을 골라 13개 안팎의 Security Filter (`SecurityContextHolderFilter`, `HeaderWriterFilter`, `AuthorizationFilter`, ...) 를 순회합니다. JWT 같은 커스텀 Filter 는 `addFilterBefore` 로 `UsernamePasswordAuthenticationFilter` 자리쯤에 끼워 넣고, 거기서 `SecurityContext` 를 채워주는 게 표준 패턴입니다."

## 다음 학습

- [07-handler-interceptor.md](07-handler-interceptor.md) — Filter 와 짝을 이루는 다른 hook
- [17-msa-gateway-filter.md](17-msa-gateway-filter.md) — msa gateway 의 실제 Filter 순서
