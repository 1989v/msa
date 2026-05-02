---
parent: 17-spring-web
seq: 02
title: Filter vs Interceptor vs AOP — 결정 트리
type: deep
created: 2026-05-01
---

# 02. Filter vs Interceptor vs AOP — 어디서 할까

> 면접 1순위 질문: **"Filter 와 Interceptor 의 차이는 무엇이고, 언제 어느 걸 쓰나요?"**
>
> 본 파일은 한 장의 결정표 + 30초 답변용 차트로 정리한다.

## 1. 한 줄 정의

| 도구 | 위치 | 단위 | 정체 |
|---|---|---|---|
| **Servlet Filter** | DispatcherServlet 밖 (Servlet 레벨) | URL 패턴 | `jakarta.servlet.Filter` — 컨테이너 표준 API |
| **HandlerInterceptor** | DispatcherServlet 안, Controller 호출 전후 | URL/Handler | Spring MVC 인터페이스 |
| **Spring AOP** | 빈 메소드 호출 단위 | 메소드 시그니처 (포인트컷) | Proxy(`@Aspect`) 또는 AspectJ weaving |

## 2. 비교 표

| 비교 항목 | Servlet Filter | HandlerInterceptor | Spring AOP |
|---|---|---|---|
| 표준 | `jakarta.servlet.Filter` | Spring MVC 전용 | Spring AOP (proxy) / AspectJ |
| 적용 범위 | URL 패턴 (`/*`, `/api/*`) | URL + HandlerMethod | Pointcut expression (메소드 시그니처) |
| Handler 정보 | 없음 (`HttpServletRequest` 만) | `HandlerMethod` 받음 → 어노테이션 접근 | `JoinPoint` (target, args, signature) |
| Spring 빈 주입 | 가능 (단, 생성자 시점 주의) | 자유로움 (Spring 빈) | 자유로움 (Spring 빈) |
| Request/Response 교체 | **가능** (`HttpServletRequestWrapper`) | 불가 (이미 매칭됨) | 무관 (HTTP 레이어 아님) |
| Body 캐싱 | 가능 (필요시 wrapper 직접 구현) | 까다로움 | 불가 |
| 예외 처리 | try/catch 직접 — `@ControllerAdvice` 도달 못 함 | preHandle 예외는 `HandlerExceptionResolver` 통과 | `@AfterThrowing` / try/catch |
| 비동기/스트리밍 | OK (단, 응답 wrapper 주의) | 어려움 (postHandle 시 응답 이미 시작됨) | 무관 |
| WebFlux 지원 | ❌ Servlet API 전용 | ❌ Servlet MVC 전용 | ✅ AOP 자체는 동일 |
| 적용 비용 | 낮음 — `@Component` + `@Order` | 낮음 — `WebMvcConfigurer.addInterceptors` | 중간 — `@EnableAspectJAutoProxy` 필요할 수 있음 |
| 비유 | "건물 출입구의 보안 검색대" | "각 사무실 문 앞 안내데스크" | "각 직원 책상의 비서 (call 가로채기)" |

## 3. 결정 트리

```
시작: 무엇을 가로챌 것인가?

Q1. HTTP 요청/응답 자체를 다루는가?
    └ NO → AOP (메소드 단위 cross-cutting: timing, retry, audit)
    └ YES → Q2

Q2. Spring 의 @Controller/@RequestMapping 매칭 정보가 필요한가?
    └ NO  → Servlet Filter
              (인증 헤더 검사, CORS, MDC trace ID, body 캐싱, 압축)
    └ YES → Q3

Q3. Controller 의 어노테이션(@PreAuthorize 같은) 또는 HandlerMethod 메타데이터 기반 분기?
    └ YES → HandlerInterceptor
    └ NO  → 다시 Filter 도 가능 (선호: Filter 가 단순)

특수 케이스:
- 권한 검사: Spring Security 의 SecurityFilter 가 1순위 (Filter 의 일종)
- 트랜잭션: AOP @Transactional (절대 Interceptor/Filter 에서 시작하지 말 것)
- 외부 API latency: AOP @Around 로 timing
- 응답 본문 후가공(ApiResponse 래핑): ResponseBodyAdvice (Interceptor 아님)
```

## 4. "같은 일을 어디서나 할 수 있어 보이는데?"

### 예: 인증 토큰 검증

| 위치 | 가능? | 권장? | 이유 |
|---|---|---|---|
| Reverse Proxy (Lua/OPA) | ✅ | 단일 게이트웨이라면 ◯ | TLS 종단과 같이 처리 |
| Servlet Filter (커스텀) | ✅ | 단순 검증이면 ◯ | Spring Security 없이도 가능 |
| Spring Security Filter | ✅ | **표준** | 인가, 세션, CSRF 등과 통합 |
| HandlerInterceptor | ✅ | △ | Handler 어노테이션 기반 분기는 가능하지만 SecurityFilter 가 먼저 잡는 게 맞음 |
| Controller AOP | ✅ | ✗ | 너무 늦다. 비즈니스 로직 진입 후 거부는 비효율 |

### 예: 외부 API 호출 시간 측정

| 위치 | 가능? | 권장? |
|---|---|---|
| Filter | ✅ | ✗ — 메소드 단위가 아님 |
| Interceptor | △ | △ — Controller 단위까지만, 내부 호출은 못 봄 |
| **AOP `@Around`** | ✅ | **◯** — 메소드 시그니처 기반, 가장 자연스러움 |
| Micrometer `@Timed` | ✅ | ◯ — AOP 의 한 형태, Prometheus 와 자동 연동 |

### 예: trace ID(MDC) 주입

| 위치 | 가능? | 권장? |
|---|---|---|
| **Servlet Filter** | ✅ | **◯** — 모든 후속 단계의 로그에 보이게 |
| Interceptor | ✅ | △ — Filter 에서 발생한 로그에는 안 찍힘 |
| AOP | ✗ | — |
| `@Async` + `TaskDecorator` | 별도 필요 | — Async 에 MDC 전파는 추가 작업 |

## 5. 매끄럽게 외울 문장

> **"Filter 는 Servlet 표준이라 DispatcherServlet 밖에서, URL 패턴으로, request 자체를 wrapping 하면서 일한다. Interceptor 는 Spring MVC 에서, Handler 매칭 후, HandlerMethod 정보를 받아서 일한다. AOP 는 HTTP 와 무관하게 메소드 단위로, 포인트컷에 매칭된 빈 호출을 가로챈다."**

## 6. msa 적용 매핑

| 작업 | msa 적용 위치 | 예시 |
|---|---|---|
| Visitor ID 쿠키 발급 | gateway `VisitorIdFilter` (`GlobalFilter`) | `gateway/src/main/kotlin/com/kgd/gateway/filter/VisitorIdFilter.kt` |
| 요청 로깅(method/uri/status/duration) | gateway `RequestLoggingFilter` | `gateway/src/main/kotlin/com/kgd/gateway/filter/RequestLoggingFilter.kt` |
| JWT 검증 + 블랙리스트 | gateway `AuthenticationGatewayFilter` | `gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt` |
| Tenant ID 인자 매핑 | quant `TenantIdHeaderArgumentResolver` (Interceptor 아님) | `WebMvcConfig.addArgumentResolvers` |
| 전역 예외 → ApiResponse | common `GlobalExceptionHandler` (`@RestControllerAdvice`) | `common/exception/` |
| AOP 사용처 | **현재 운영 코드에 없음** (template `io-snapshot-aspect.kt` 만) | [18](18-msa-common-patterns.md) 에서 표준 제안 |

## 7. 자주 묻는 함정 5

1. **"Filter 에서 Spring 빈 주입이 안 되나요?"** → 됩니다. 단, Filter 가 Spring 컨테이너 시작 직후 init 되는데 일부 빈이 lazy 라면 NPE. `@Lazy` 또는 `ObjectProvider<T>` 패턴 권장.
2. **"Interceptor 에서 응답 본문을 바꿀 수 있나요?"** → `@ResponseBody` 면 사실상 불가. `ResponseBodyAdvice` 사용.
3. **"AOP 가 같은 클래스 안에서 호출하면 왜 안 먹나요?"** → 프록시 객체가 가로채는 구조라 self-invocation 은 프록시를 거치지 않음. [08](08-spring-aop.md) 에서 상세.
4. **"Filter 순서를 안 정해도 되나요?"** → `@Component` 만 붙이면 임의 순서. 인증/로깅 같은 의미 있는 Filter 는 반드시 `FilterRegistrationBean` + `setOrder(...)` 또는 `@Order` 로 명시.
5. **"WebFlux gateway 에 Servlet Filter 를 등록할 수 있나요?"** → 못 합니다. `WebFilter` 또는 `GlobalFilter`/`GatewayFilter` 만. 본 msa 에서도 gateway 만 WebFlux.

## 8. 면접 30초 답변

> "Filter 는 DispatcherServlet 진입 전에 동작하는 Servlet 표준이라 URL 패턴 단위로 request/response 를 wrapping 하며 인증/CORS/로깅 같은 횡단 처리에 적합합니다. Interceptor 는 Spring MVC 가 HandlerMapping 매칭 이후에 호출하는 인터페이스라 HandlerMethod 정보까지 보고 권한 후처리, MDC 정리 같은 작업에 좋습니다. AOP 는 HTTP 와 무관하게 메소드 호출을 가로채니 외부 API 시간 측정, retry, 트랜잭션처럼 비즈니스 메소드 단위 cross-cutting 에 씁니다. 정리하면 Filter < Interceptor < Controller < AOP advised method 순으로 안쪽으로 들어갑니다."

## 다음 학습

- [03-dispatcher-servlet.md](03-dispatcher-servlet.md) — DispatcherServlet 내부
- [05-servlet-filter.md](05-servlet-filter.md) — Filter 상세
- [07-handler-interceptor.md](07-handler-interceptor.md) — Interceptor 상세
- [08-spring-aop.md](08-spring-aop.md) — AOP 상세
