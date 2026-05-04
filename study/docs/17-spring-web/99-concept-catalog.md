---
parent: 17-spring-web
seq: 99
title: Spring Web 처리 개념 카탈로그 — Filter · Interceptor · AOP · Jackson · gzip
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
sources:
  - https://docs.spring.io/spring-framework/reference/web/webmvc.html
  - https://docs.spring.io/spring-framework/reference/web/webflux.html
  - https://github.com/FasterXML/jackson
  - https://docs.spring.io/spring-boot/docs/current/reference/html/web.html
---

# 99. Spring Web 처리 개념 카탈로그

> **목적** — 17-spring-web 의 20+ deep file + Spring Framework 6.x / Spring Boot 3.x / Jackson / Servlet spec 기준 빠진 영역 발굴 (Problem Details RFC 7807, HandlerMethodArgumentResolver, ResponseBodyAdvice, ContentNegotiation, HTTP/2 + Servlet 6, ConfigurableServletWebServerFactory, GraalVM Native, Spring Boot Actuator endpoints 등).

---

## 1. 기존 커버 매트릭스

| 카테고리 | 핵심 | 상태 |
|---|---|---|
| Filter chain | Servlet Filter / Spring filter order | ✅ |
| Interceptor | HandlerInterceptor (preHandle/postHandle/afterCompletion) | ✅ |
| AOP | proxy, JDK vs CGLIB, ProxyFactory | ✅ |
| Jackson | ObjectMapper, modules, custom serializer | ✅ |
| gzip | Tomcat 설정 / nginx 비교 | ✅ |
| Exception handler | @ControllerAdvice, ResponseEntityExceptionHandler | ✅ |
| 트랜잭션 (#5 cross) | TX 흐름 | ✅ |
| MVC vs WebFlux | sync vs reactive | ✅ |
| msa 적용 | gateway / 서비스 web 계층 | ✅ |

### 1-A. 갭 진단

1. **Problem Details (RFC 7807)** — `application/problem+json` 표준 — Spring 6 의 ProblemDetail
2. **HandlerMethodArgumentResolver** — custom @PathVariable / @RequestParam
3. **HandlerMethodReturnValueHandler** — custom return type
4. **ResponseBodyAdvice / RequestBodyAdvice** — body 가공
5. **HttpMessageConverter** — Jackson / Protobuf / XML / form
6. **ContentNegotiation** — Accept header / parameter / pathExt
7. **AsyncHandlerInterceptor + DeferredResult / Callable / WebAsyncTask** — async MVC
8. **Servlet 6.x async + non-blocking IO**
9. **HTTP/2 on Tomcat** — `server.http2.enabled`
10. **HTTP/3 / QUIC** — Spring 미지원 (Netty incubator)
11. **WebSocket / STOMP** — sub-protocol
12. **Server-Sent Events (SSE)** — MediaType.TEXT_EVENT_STREAM
13. **Reactive WebFlux 의 두 모델** (annotation / functional routing)
14. **WebFilter / WebHandler / DispatcherHandler (WebFlux)**
15. **WebClient** (RestTemplate 후속)
16. **RestClient (Spring 6+)** — 동기 fluent client
17. **HTTP Interface clients (@HttpExchange)** — Feign-like 내장
18. **`@RestControllerAdvice` + Sentry/error tracking 연결**
19. **CORS** — @CrossOrigin / WebMvcConfigurer / GlobalCorsConfiguration
20. **CSRF** — Spring Security CSRF token
21. **Compression** — gzip / brotli (Tomcat 11+) / zstd (외부)
22. **HTTP caching** — ETag / Cache-Control / Last-Modified / Vary
23. **Conditional GET** — `@RequestMapping` + `@LastModified` + `@ETag`
24. **HandlerExceptionResolver chain**
25. **MethodValidator** — @Valid / Bean Validation 3
26. **Bean Validation 3 (Jakarta)** + ConstraintValidator
27. **Locale resolver / LocaleChangeInterceptor**
28. **Theme resolver** (deprecated)
29. **MultipartResolver (Standard / Commons)**
30. **Static resources + ResourceHandlerRegistry + Versioned URL**
31. **Tomcat / Jetty / Undertow / Reactor Netty 비교**
32. **GraalVM Native Image** — Spring Boot 3 native
33. **Spring Boot Actuator endpoints (health/info/metrics/loggers/heapdump/threaddump/env)** + custom endpoint
34. **Micrometer integration** — auto metric (#10 cross)
35. **Observability autoconfig** — Spring Boot 3 의 ObservationRegistry
36. **Tracing autoconfig** (Micrometer Tracing) — OTel / Brave
37. **Web AsyncSupportConfigurer / RequestContextHolder 동작**
38. **Method Security (@PreAuthorize / @PostAuthorize) + AOP**
39. **Async TaskExecutor 표준 (TaskExecutor / VirtualThreadTaskExecutor) + Loom 통합**
40. **Spring Cloud Gateway (Reactor 기반) vs MVC API Gateway**
41. **HiddenHttpMethodFilter / FormContentFilter / OrderedRequestContextFilter** 등 Spring 표준 filter 들
42. **HTTP message logging filter (CommonsRequestLoggingFilter)**
43. **OncePerRequestFilter** 권장
44. **ShallowEtagHeaderFilter** — body 해시 → ETag

---

## 2. 카테고리별 개념 트리

### A. Servlet Filter / Spring Filter

| 개념 | 정의 | 상태 |
|---|---|---|
| javax.servlet.Filter (Jakarta servlet) | Servlet spec | ✅ |
| **OncePerRequestFilter** (Spring 권장) | dispatcher 중복 호출 회피 | ✅ |
| FilterRegistrationBean (order, urlPatterns) | 등록 | ✅ |
| Spring 표준 filter — HiddenHttpMethodFilter / FormContentFilter / RequestContextFilter / ForwardedHeaderFilter / ShallowEtagHeaderFilter / CharacterEncodingFilter | 빌트인 | ★ 신규 |
| Filter vs Interceptor | Servlet vs Spring level | ✅ |
| Spring Security FilterChain | 별도 chain | 🟡 |

### B. Interceptor / Argument 처리

| 개념 | 정의 | 상태 |
|---|---|---|
| HandlerInterceptor (preHandle / postHandle / afterCompletion) | 3 hook | ✅ |
| **AsyncHandlerInterceptor** (afterConcurrentHandlingStarted) | async 지원 | ★ 신규 |
| **HandlerMethodArgumentResolver** | custom @AnnotatedParam | ★ 신규 |
| **HandlerMethodReturnValueHandler** | custom return | ★ 신규 |
| **RequestBodyAdvice / ResponseBodyAdvice** | body 가공 | ★ 신규 |

### C. Exception 처리 / Problem Details

| 개념 | 정의 | 상태 |
|---|---|---|
| @ControllerAdvice / @RestControllerAdvice | 전역 핸들러 | ✅ |
| ResponseEntityExceptionHandler (Spring 표준) | 기본 매핑 | ✅ |
| HandlerExceptionResolver chain | 단계 처리 | 🟡 |
| **ProblemDetail (RFC 7807)** | Spring 6 표준 | ★ 신규 |
| Validation 예외 (MethodArgumentNotValidException / ConstraintViolationException) | 매핑 | 🟡 |

### D. 메시지 변환 / Jackson

| 개념 | 정의 | 상태 |
|---|---|---|
| HttpMessageConverter (Jackson, Protobuf, XML, Form, ByteArray, String, Resource) | 변환 chain | ✅ |
| ObjectMapper 설정 (Modules: JavaTime, Kotlin, ParameterNames) | 모듈 | ✅ |
| Custom Serializer / Deserializer | 직렬화 커스텀 | ✅ |
| @JsonView / @JsonInclude / @JsonProperty | 어노테이션 | ✅ |
| **MixIn** | 외부 클래스에 Jackson 어노테이션 주입 | ★ 신규 |
| **Streaming API (JsonParser/Generator)** | 대용량 | ★ 신규 |
| **Polymorphism** (@JsonTypeInfo / @JsonSubTypes / @JsonTypeId) | type 다형 | ★ 신규 |
| **ContentNegotiation** | Accept header → converter | ★ 신규 |

### E. HTTP / 캐싱 / 압축

| 개념 | 정의 | 상태 |
|---|---|---|
| **Caching headers** (ETag / Cache-Control / Last-Modified / Vary) | conditional GET | ★ 신규 |
| **ShallowEtagHeaderFilter** | body 해시 ETag | ★ 신규 |
| **Compression** (gzip / brotli / zstd) | Tomcat / nginx | ✅ |
| **HTTP/2 on Tomcat** | `server.http2.enabled=true` | ★ 신규 |
| HTTP/3 (QUIC) | Spring 미지원 (Netty incubator) | ★ 신규 |
| WebSocket / STOMP | sub-protocol | 🟡 |
| **SSE** (text/event-stream) | streaming | ★ 신규 |

### F. WebFlux / Reactive

| 개념 | 정의 | 상태 |
|---|---|---|
| Annotation model (DispatcherHandler) | @Controller | ✅ |
| Functional model (RouterFunctions / HandlerFunction) | router DSL | ✅ |
| WebFilter | reactive filter | ✅ |
| **WebClient** (RestTemplate 후속) | non-blocking | ✅ |
| **RestClient** (Spring 6+ sync fluent) | RestTemplate 후속 (sync) | ★ 신규 |
| **HTTP Interface clients (@HttpExchange)** | Feign-like 내장 | ★ 신규 |
| Reactor Netty internals | 기본 server | 🟡 |

### G. Async / Loom

| 개념 | 정의 | 상태 |
|---|---|---|
| @Async + AsyncConfigurer | proxy 기반 비동기 | ✅ |
| DeferredResult / Callable / WebAsyncTask | async MVC | 🟡 |
| WebAsyncSupportConfigurer | timeout / executor | 🟡 |
| **VirtualThreadTaskExecutor** (Boot 3.2+) | Loom + Tomcat | ★ 신규 |
| Tomcat 11 + Virtual Threads | thread-per-request 의 부활 | ★ 신규 |

### H. 보안 / CORS / CSRF

| 개념 | 정의 | 상태 |
|---|---|---|
| CORS — @CrossOrigin / WebMvcConfigurer / GlobalCorsConfiguration | preflight + actual | 🟡 |
| CSRF (Spring Security) — token in cookie/header | session 기반 / SPA 패턴 | 🟡 |
| Method Security (@PreAuthorize) | AOP 보안 | 🟡 |
| Bean Validation 3 (Jakarta) — @Valid / @Validated / Custom ConstraintValidator | 검증 | ✅ |

### I. Web Server / Native

| 개념 | 정의 | 상태 |
|---|---|---|
| Tomcat / Jetty / Undertow / Reactor Netty | 4 server | ✅ |
| **GraalVM Native Image** (Boot 3) | AOT compile | ★ 신규 |
| Configurable*WebServerFactory | 커스텀 | 🟡 |
| **Multipart Resolver** | file upload | 🟡 |

### J. Actuator / Observability

| 개념 | 정의 | 상태 |
|---|---|---|
| Endpoints — health / info / metrics / loggers / threaddump / heapdump / env / mappings / beans / configprops | 빌트인 | ✅ |
| **Custom Endpoint (@Endpoint)** | 신규 endpoint | ★ 신규 |
| Micrometer integration | metric 자동 | ✅ |
| **ObservationRegistry (Boot 3)** | observation API | ★ 신규 |
| **Micrometer Tracing** (OTel / Brave) | trace autoconfig | ★ 신규 |

---

## 3. 우선 심화 후보 Top-10

| 우선 | 주제 | 왜 |
|---|---|---|
| 1 | **VirtualThreadTaskExecutor + Tomcat 11 + Loom** | 새 표준 — async 코드 줄임 |
| 2 | **ProblemDetail (RFC 7807)** | error 응답 표준화 |
| 3 | **HandlerMethodArgumentResolver / RequestBodyAdvice / ResponseBodyAdvice** | API 가공 표준 패턴 |
| 4 | **HTTP Interface clients (@HttpExchange)** | Feign 대체 — 내장 |
| 5 | **HTTP caching (ETag + Cache-Control + ShallowEtagHeaderFilter)** | 캐시 친화 응답 |
| 6 | **ObservationRegistry + Micrometer Tracing** (#10 cross) | 새 observability autoconfig |
| 7 | **GraalVM Native Image** | startup 절감 |
| 8 | **Bean Validation 3 + 커스텀 ConstraintValidator** | 검증 표준 |
| 9 | **WebClient / RestClient + ReactorContext + propagation** | reactive HTTP 표준 |
| 10 | **Compression — gzip/brotli/zstd 비교** + nginx vs Tomcat | 비용/응답 size |

---

## 4. 표준 심화 스터디 템플릿

`19/99 §4` 사용. Spring Web 특화:
- §3 → "DispatcherServlet/DispatcherHandler 흐름" 다이어그램
- §6 → "MVC vs WebFlux" 표
- §7 → Actuator metric / endpoint 매핑

---

## 5. 참고 자료

- Spring Web MVC: https://docs.spring.io/spring-framework/reference/web/webmvc.html
- Spring WebFlux: https://docs.spring.io/spring-framework/reference/web/webflux.html
- Spring Boot Web: https://docs.spring.io/spring-boot/docs/current/reference/html/web.html
- Jackson: https://github.com/FasterXML/jackson
- "Spring in Action 6th"
- "Pro Spring Boot 3" (Felipe Gutierrez)
- ProblemDetail (RFC 7807): https://datatracker.ietf.org/doc/html/rfc7807
