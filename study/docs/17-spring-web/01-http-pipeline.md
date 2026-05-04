---
parent: 17-spring-web
seq: 01
title: HTTP 요청-응답 파이프라인 8단계
type: deep
created: 2026-05-01
---

# 01. HTTP 요청-응답 파이프라인 8단계

> 이 파일은 17번 학습 전체의 좌표축이다. 이후 모든 파일이 "이 그림의 어느 단계인가" 를 가리키며 진행한다.

## 1. 전체 그림

```
 [Client]
    │  TCP/TLS handshake
    ▼
 ┌──────────────────────────────────────────────┐
 │ ① Reverse Proxy / Ingress                    │
 │   - Nginx Ingress / Envoy / CloudFront        │
 │   - TLS termination                          │
 │   - L7 routing (host/path)                   │
 │   - gzip/br 압축 1순위 위치                   │
 └─────────────────────┬────────────────────────┘
                       │ HTTP/1.1 or HTTP/2 (cleartext or mTLS)
                       ▼
 ┌──────────────────────────────────────────────┐
 │ ② Servlet Container                          │
 │   - Tomcat (Coyote → Catalina) / Reactor Netty│
 │   - HTTP 파싱, ServletRequest 인스턴스 생성   │
 │   - Connector → Engine → Host → Context       │
 └─────────────────────┬────────────────────────┘
                       │ jakarta.servlet.ServletRequest
                       ▼
 ┌──────────────────────────────────────────────┐
 │ ③ Servlet Filter Chain                       │
 │   - Order 작은 순서대로 순차 실행             │
 │   - DelegatingFilterProxy("springSecurityFilterChain")│
 │       └─ FilterChainProxy                    │
 │            └─ SecurityFilterChain[]          │
 │                  └─ 13개 SecurityFilter      │
 │   - 일반 @Component Filter (FilterRegistrationBean)│
 └─────────────────────┬────────────────────────┘
                       ▼
 ┌──────────────────────────────────────────────┐
 │ ④ DispatcherServlet                          │
 │   - HandlerMapping → HandlerExecutionChain   │
 │       (Handler + Interceptor[])              │
 │   - HandlerAdapter.handle(...)                │
 └─────────────────────┬────────────────────────┘
                       ▼
 ┌──────────────────────────────────────────────┐
 │ ⑤ HandlerInterceptor.preHandle (역순으로 push)│
 │   - 등록된 모든 인터셉터의 preHandle 순차 호출│
 │   - false 반환 시 즉시 종료                   │
 └─────────────────────┬────────────────────────┘
                       ▼
 ┌──────────────────────────────────────────────┐
 │ ⑥ Controller (proxy chain)                   │
 │   - @ControllerAdvice / ArgumentResolver      │
 │   - AOP proxy → Service → Repository proxy   │
 │   - @Transactional / @Async / @Cacheable      │
 └─────────────────────┬────────────────────────┘
                       ▼
 ┌──────────────────────────────────────────────┐
 │ ⑦ ReturnValueHandler / ResponseBodyAdvice    │
 │   - HandlerInterceptor.postHandle             │
 │     (View 단계, @ResponseBody는 영향 없음)    │
 │   - HttpMessageConverter 선택 (Accept 헤더)   │
 │   - MappingJackson2HttpMessageConverter 가    │
 │     ObjectMapper 로 직렬화                    │
 └─────────────────────┬────────────────────────┘
                       ▼
 ┌──────────────────────────────────────────────┐
 │ ⑧ Filter chain (response 측)                 │
 │   - HandlerInterceptor.afterCompletion        │
 │   - Filter 가 ServletResponse 후처리           │
 │   - Tomcat 의 CompressionFilter (선택적)      │
 │   - 다시 Reverse Proxy 로 송출                │
 └──────────────────────────────────────────────┘
                       ▼
 [Client] (gzip decompress, render)
```

## 2. 단계별 책임

### ① Reverse Proxy / Ingress

- **책임**: TLS (Transport Layer Security, 전송 계층 보안) 종단, L7 라우팅, Rate limiting, gzip/br 압축, mTLS (mutual TLS, 양방향 TLS) 검증
- **msa 위치**: `k8s/base/gateway/ingress.yaml` 의 ingress-nginx, prod 에서는 cert-manager + Let's Encrypt
- **핵심 결정**: gzip/br 을 여기서 끝낸다 → 애플리케이션은 raw JSON 만 신경 쓴다
- **TLS terminate 후** 에는 평문 → mTLS 가 아니면 클러스터 내부는 평문이라는 점 의식

### ② Servlet Container (Tomcat)

- **책임**: HTTP 파싱, NIO (Non-blocking I/O, 비차단 입출력) /AIO (Asynchronous I/O, 비동기 입출력) 기반 connector, thread-per-request → 가상 스레드 (Boot 3.2+)
- **클래스 흐름**: `Connector` → `CoyoteAdapter.service()` → `ApplicationFilterChain.doFilter()`
- **Spring Boot 4 기본**: `server.tomcat.threads.max=200`, 가상 스레드 enable 시 thread pool 무시
- **Reactor Netty(WebFlux)** 와 차이: 이벤트 루프 + Mono/Flux. msa 의 gateway 가 이쪽

### ③ Servlet Filter Chain

- **인터페이스**: `jakarta.servlet.Filter#doFilter(req, res, chain)`
- **위치**: DispatcherServlet **이전**. URL 패턴(`/*`)으로 매칭. Handler 정보 없음.
- **등록 방법**:
  - `@Component` + Spring Boot 자동 등록 (모든 URL 매핑)
  - `FilterRegistrationBean` 으로 명시적 url-pattern / order 제어 (권장)
- **순서 제어**: `setOrder(int)` — 작은 값이 먼저. 음수도 가능 (`Ordered.HIGHEST_PRECEDENCE`).
- **Spring Security 진입**: `springSecurityFilterChain` 이름의 단일 Filter 빈이 `DelegatingFilterProxy` 로 등록되고 안에 `FilterChainProxy` → `SecurityFilterChain[]` 가 있음. 자세한 건 [06](06-security-filter-chain.md)

### ④ DispatcherServlet

- **유일한 Servlet**: Spring MVC 는 사실 Servlet 1개에 모든 매핑이 박힌 구조
- **핵심 컴포넌트**:
  - `HandlerMapping` — URL → `HandlerMethod` 매핑 (`RequestMappingHandlerMapping` 등)
  - `HandlerAdapter` — 실제 호출 (`RequestMappingHandlerAdapter` 가 `@Controller` 처리)
  - `HandlerMethodArgumentResolver` — `@RequestParam`/`@PathVariable`/커스텀 (예: msa `TenantIdHeaderArgumentResolver`)
  - `HandlerMethodReturnValueHandler` — 반환값 → 응답 (`@ResponseBody` 면 `RequestResponseBodyMethodProcessor`)
  - `HandlerExceptionResolver` — `@ControllerAdvice` 매핑 (msa `GlobalExceptionHandler`)

### ⑤ HandlerInterceptor

- **인터페이스**: `org.springframework.web.servlet.HandlerInterceptor`
- **3 메소드**:
  - `preHandle(req, res, handler): Boolean` — Controller 호출 **전**
  - `postHandle(req, res, handler, modelAndView)` — Controller 호출 **후 / View 렌더링 전**. `@ResponseBody` 면 의미 없음.
  - `afterCompletion(req, res, handler, ex)` — 응답 완료 후 (예외 발생 여부 포함). MDC 정리/로깅 적합.
- **Filter 와 차이**: `HandlerMethod` 정보 직접 받음 → 메소드/어노테이션 기반 분기 가능. Spring 빈 자유롭게 주입.

### ⑥ Controller (proxy chain)

- **AOP (Aspect-Oriented Programming, 관점 지향 프로그래밍) 프록시**: `@Controller` 빈 자체가 프록시일 수도 있고 (advice 가 있으면), Service 호출 시점에 Service 의 프록시를 통과
- **트랜잭션 경계**: `@Transactional` 이 첫 적용되는 지점은 보통 Service. Controller 에서는 권장 안 됨 (외부 IO (Input/Output, 입출력) 분리, ADR (Architecture Decision Record, 아키텍처 결정 기록) -0020)
- **Argument resolution**: 헤더 → DTO (Data Transfer Object, 데이터 전송 객체) 매핑 시 Jackson 의 `ObjectReader` 가 호출됨 → ObjectMapper 영향
- **반환**: 도메인 객체 또는 `ResponseEntity<T>` → 다음 단계로

### ⑦ ReturnValueHandler / Converter / ResponseBodyAdvice

- **`@ResponseBody`** 면 `RequestResponseBodyMethodProcessor` 가 작업
- 그 안에서 `HttpMessageConverter` 후보 중 `Accept` 헤더와 매칭되는 것 선택
- 보통 `MappingJackson2HttpMessageConverter` → 내부 `ObjectMapper.writeValue(...)`
- `ResponseBodyAdvice` 가 있으면 **직렬화 직전** 에 hook 가능 (전 응답 ApiResponse 래핑 패턴 등)
- `HandlerInterceptor.postHandle` 은 `@ResponseBody` 와 거의 무용 — 이미 Converter 가 응답 본문을 쓰는 중이라 `ModelAndView` 가 null

### ⑧ Filter chain (response 측) / 송출

- Filter 의 `chain.doFilter()` 호출 **이후 코드**가 응답 직후 실행 — 응답 본문 로깅, 헤더 추가, 압축 등
- `HandlerInterceptor.afterCompletion` 도 이 단계에서 실행 (역순)
- Tomcat 자체 `CompressionFilter` 또는 `server.compression.enabled=true` 가 켜져 있으면 여기서 gzip
- 그리고 다시 ② Tomcat → ① Reverse Proxy → 클라이언트

## 3. msa 의 실제 매핑

| 단계 | msa 컴포넌트 |
|---|---|
| ① | `k8s/base/gateway/ingress.yaml` (ingress-nginx) |
| ② | gateway: Reactor Netty (WebFlux) / 그 외 서비스: Tomcat |
| ③ | gateway: `VisitorIdFilter`, `RequestLoggingFilter`, `AuthenticationGatewayFilter` (모두 WebFilter/GatewayFilter) |
| ④ | 각 서비스의 DispatcherServlet (Spring Boot 자동) |
| ⑤ | 현재 별도 HandlerInterceptor 없음 (`quant` 의 `WebMvcConfig` 는 `ArgumentResolver` 만 등록) |
| ⑥ | `@Controller` → `@Service` (proxy) → JPA Repository (proxy) |
| ⑦ | `common/exception/GlobalExceptionHandler` (`@RestControllerAdvice`) + `MappingJackson2HttpMessageConverter` |
| ⑧ | 현재 응답 압축은 미설정 — [16](16-gzip-breach.md), [18](18-msa-common-patterns.md) 에서 결정 |

## 4. 자주 헷갈리는 5가지

1. **Filter 와 Interceptor 가 모두 `preHandle` 같은 게 있다?** → 아니다. Filter 는 `doFilter` 한 메소드에서 chain 전후 처리, Interceptor 는 3 메소드.
2. **`@ResponseBody` 라도 `postHandle` 이 호출되긴 하나?** → 호출은 되지만 `modelAndView` 가 null. 응답 본문은 이미 Converter 가 쓰고 있으므로 본문 수정 불가.
3. **`@RestControllerAdvice` 의 `@ExceptionHandler` 는 어디서 잡히나?** → `HandlerExceptionResolver` 가 ⑥-⑦ 사이에서 catch. Filter 에서 던진 예외는 못 잡음 — Filter 자체에서 try/catch 필요.
4. **Spring Security 의 인증 예외(`AccessDeniedException`)** → `ExceptionTranslationFilter` 가 Security Filter chain 안에서 처리. `@RestControllerAdvice` 까지 도달하지 않을 수 있음.
5. **gateway(WebFlux) 에는 Filter 가 없다?** → 있다. 다만 `jakarta.servlet.Filter` 가 아니라 `org.springframework.web.server.WebFilter` 또는 Spring Cloud Gateway 의 `GlobalFilter`/`GatewayFilter`. [04](04-webmvc-vs-webflux.md) 참고.

## 5. 면접 한 줄 답변

> "HTTP 한 통은 Reverse Proxy → Tomcat → Servlet Filter chain → DispatcherServlet → HandlerInterceptor → Controller(+AOP proxy) → MessageConverter → 다시 Filter 응답측 → Tomcat → Reverse Proxy 순으로 흐릅니다. Filter 는 DispatcherServlet 밖, Interceptor 는 안, AOP 는 메소드 단위 cross-cutting 이라는 게 위치 차이입니다."

## 다음 학습

- [02-filter-vs-interceptor-vs-aop.md](02-filter-vs-interceptor-vs-aop.md) — 같은 일을 어디서 할지 결정 트리
- [03-dispatcher-servlet.md](03-dispatcher-servlet.md) — ④ 내부 더 깊이
