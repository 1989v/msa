---
parent: 17-spring-web
seq: 05
title: Servlet Filter 상세
type: deep
created: 2026-05-01
---

# 05. Servlet Filter 상세

## 1. 인터페이스

```java
package jakarta.servlet;

public interface Filter {
    default void init(FilterConfig filterConfig) {}

    void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
        throws IOException, ServletException;

    default void destroy() {}
}
```

- 메소드 단 하나 (`doFilter`) — `chain.doFilter(...)` 호출 **전후** 가 hook 지점
- `init`/`destroy` 는 컨테이너 lifecycle, Spring Boot 환경에선 거의 무시
- HTTP 전용으로 다룰 땐 `HttpServletRequest`/`HttpServletResponse` 로 캐스트

## 2. Spring Boot 의 `OncePerRequestFilter`

표준 `Filter` 를 직접 구현하면 같은 요청이 forward/include 될 때 중복 실행될 수 있다. Spring 이 보호용 베이스 클래스를 제공:

```kotlin
package org.springframework.web.filter

abstract class OncePerRequestFilter : GenericFilterBean() {
    final override fun doFilter(request: ServletRequest, response: ServletResponse, chain: FilterChain) {
        // already-filtered 속성 검사 → 한 요청에서 단 1회만 doFilterInternal
        if (skipDispatch(request) || hasAlreadyFilteredAttribute(request)) {
            chain.doFilter(request, response)
            return
        }
        markAsFiltered(request)
        try {
            doFilterInternal(request as HttpServletRequest, response as HttpServletResponse, chain)
        } finally {
            removeFilteredAttribute(request)
        }
    }

    abstract fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    )
}
```

→ msa 에서 새 Filter 만들 때는 **항상 `OncePerRequestFilter`** 상속 권장.

## 3. 등록 방법 3가지

### 3.1. `@Component` 자동 등록

```kotlin
@Component
class TraceIdFilter : OncePerRequestFilter() {
    override fun doFilterInternal(req, res, chain) { ... }
}
```

- Spring Boot 가 모든 Filter 빈을 자동으로 `FilterRegistrationBean` 으로 감싸 등록
- URL 패턴: `/*` (모든 경로)
- 순서: `@Order` 또는 `Ordered` 인터페이스로 제어 — 명시 안 하면 임의

### 3.2. `FilterRegistrationBean` 명시 등록 (권장)

```kotlin
@Configuration
class FilterConfig {

    @Bean
    fun traceIdFilterRegistration(filter: TraceIdFilter): FilterRegistrationBean<TraceIdFilter> {
        val reg = FilterRegistrationBean(filter)
        reg.urlPatterns = listOf("/api/*")
        reg.order = Ordered.HIGHEST_PRECEDENCE   // 가장 먼저
        reg.setName("traceIdFilter")
        return reg
    }
}
```

- URL 패턴 / 순서 / 이름 / dispatcher type 명시 가능
- `@Order` 보다 **이 방법이 항상 우선**
- msa 표준 패턴으로 권장 — 의도가 코드에 보임

### 3.3. `WebFilter` 어노테이션 (Servlet 3 표준)

`@WebFilter(urlPatterns = ["/api/*"])` 도 가능하지만 Spring Boot 에선 `@ServletComponentScan` 추가가 필요해 거의 안 씀.

## 4. 순서 제어 — 면접 단골

### 우선순위 상수

```kotlin
Ordered.HIGHEST_PRECEDENCE  // = Integer.MIN_VALUE   먼저 실행
Ordered.LOWEST_PRECEDENCE   // = Integer.MAX_VALUE   나중 실행
```

### 권장 순서 (msa 가정)

```
1. RequestLogging / TraceIdFilter        order = HIGHEST_PRECEDENCE      (-2,147,483,648)
2. CharacterEncodingFilter               order = -100                    (Spring 자동 등록)
3. CorsFilter                            order = 0
4. SecurityFilterChain (DelegatingFilterProxy)  order = -100 (정확히는 SecurityProperties.DEFAULT_FILTER_ORDER = -100)
5. 커스텀 인증/권한 Filter                  order = 100
6. RequestBodyCachingFilter               order = 200
7. (DispatcherServlet 진입)
```

⚠️ **함정**: 일반 Filter 의 order 와 SecurityFilterChain 안의 SecurityFilter 들의 order 는 **다른 차원** 이다. SecurityFilterChain 자체는 일반 Filter 1개로 등록되고, 그 안에서 자체 순서가 있다 ([06](06-security-filter-chain.md)).

## 5. Request/Response wrapping (대표 패턴)

### 5.1. ContentCachingRequestWrapper / ContentCachingResponseWrapper

요청 본문을 한 번 읽으면 InputStream 이 소진된다. Filter 에서 본문 로깅 후 Controller 가 다시 읽으려면 캐싱 wrapper 필요:

```kotlin
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 100)
class RequestResponseLoggingFilter : OncePerRequestFilter() {

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        chain: FilterChain
    ) {
        val cachedReq = ContentCachingRequestWrapper(request)
        val cachedRes = ContentCachingResponseWrapper(response)

        try {
            chain.doFilter(cachedReq, cachedRes)
        } finally {
            // chain 후에 본문 접근 가능 — 이미 한 번 읽혀서 buffer 에 저장됨
            val reqBody = String(cachedReq.contentAsByteArray, Charsets.UTF_8)
            val resBody = String(cachedRes.contentAsByteArray, Charsets.UTF_8)
            log.info("REQ {} {} | RES {} {}",
                request.method, request.requestURI,
                response.status, resBody.take(500))

            // 중요: 응답 본문은 cached wrapper 가 buffer 에 갖고 있으므로
            // 실제 응답으로 흘려보내야 한다.
            cachedRes.copyBodyToResponse()
        }
    }
}
```

### 5.2. 직접 wrapping 한 예: 헤더 추가

```kotlin
class TenantHeaderInjectingWrapper(req: HttpServletRequest, private val tenantId: String) :
    HttpServletRequestWrapper(req) {

    override fun getHeader(name: String): String? {
        if ("X-Tenant-Id".equals(name, ignoreCase = true)) return tenantId
        return super.getHeader(name)
    }

    override fun getHeaderNames(): Enumeration<String> {
        val original = super.getHeaderNames().toList()
        return Collections.enumeration(original + "X-Tenant-Id")
    }
}
```

## 6. Filter 가 죽이는 공격들 (실무 빈도순)

| 위협 | 방어 패턴 |
|---|---|
| 인증 헤더 누락 호출 | JWT Filter 에서 401 반환 |
| 거대한 body 로 메모리 폭탄 | `MaxUploadSizeExceededException` (Multipart Filter) + 별도 size 검증 Filter |
| trace 누락으로 로그 추적 불가 | 최상위 Order 의 TraceIdFilter 가 MDC 주입 + afterCompletion 정리 |
| 잘못된 charset → 한글 깨짐 | `CharacterEncodingFilter` (Spring Boot 자동) |
| CORS 잘못 응답 | `CorsFilter` 등록 + Security 와 순서 정렬 (Security 보다 먼저) |

## 7. 안티패턴

```kotlin
// ❌ 본문을 chain.doFilter 전에 읽으면 Controller 가 빈 본문을 받음
override fun doFilterInternal(...) {
    val body = request.inputStream.readBytes()  // 한 번 읽으면 끝
    log.info(String(body))
    chain.doFilter(request, response)            // request 의 InputStream 은 이미 EOF
}
```

→ **반드시** `ContentCachingRequestWrapper` 사용.

```kotlin
// ❌ Filter 안에서 트랜잭션 시작
@Transactional  // 무용지물 — Filter 빈은 보통 AOP proxy 적용 안 함
override fun doFilterInternal(...) { ... }
```

→ Filter 에는 트랜잭션 두지 말 것. 비즈니스 로직은 Service 로 위임.

```kotlin
// ❌ 예외를 그냥 던지고 ControllerAdvice 가 잡아주길 기대
override fun doFilterInternal(...) {
    if (notAuthenticated) throw BusinessException(...)  // ControllerAdvice 도달 못 함
}
```

→ Filter 에서는 직접 `response.status = 401; response.writer.write(...)` 로 응답 작성.

## 8. msa 코드 매핑

msa 는 gateway 가 WebFlux 라 `jakarta.servlet.Filter` 직접 사용처는 거의 없다:

- gateway: `WebFilter`/`GlobalFilter` 사용 ([04](04-webmvc-vs-webflux.md))
- 다른 서비스: 현재 커스텀 Servlet Filter 없음. 인증은 gateway 가 다 했다고 가정 (`X-User-Id` 헤더만 받음)
- `common` 의 `GlobalExceptionHandler` 는 WebMVC 전용 (`@RestControllerAdvice`)

→ 다운스트림 서비스에 직접 호출(테스트, 인터널 콜)이 들어올 가능성 있다면 가벼운 `OncePerRequestFilter` 로 `X-User-Id` 헤더 존재 검증을 추가할 수 있음 ([19](19-improvements.md) 후보).

## 9. 면접 한 줄 답변

> "Servlet Filter 는 `jakarta.servlet.Filter#doFilter` 한 메소드로 chain 전후를 모두 처리합니다. Spring Boot 에서는 `OncePerRequestFilter` 를 상속해 forward 중복 실행을 막고, `FilterRegistrationBean` 으로 url-pattern 과 order 를 명시하는 게 표준입니다. 본문 로깅이 필요하면 `ContentCachingRequestWrapper` 를 써야 Controller 가 본문을 다시 읽을 수 있고, Filter 안 예외는 `@ControllerAdvice` 에 도달하지 않으니 직접 처리해야 합니다."

## 다음 학습

- [06-security-filter-chain.md](06-security-filter-chain.md) — Spring Security Filter 가 어떻게 일반 Filter chain 안에 박히나
- [07-handler-interceptor.md](07-handler-interceptor.md) — Filter 가 못 하는 일을 Interceptor 가 어떻게 하는가
