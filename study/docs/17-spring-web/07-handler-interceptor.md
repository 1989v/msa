---
parent: 17-spring-web
seq: 07
title: HandlerInterceptor 상세
type: deep
created: 2026-05-01
---

# 07. HandlerInterceptor 상세

## 1. 인터페이스

```kotlin
package org.springframework.web.servlet

interface HandlerInterceptor {

    // Controller 호출 전. false 반환 시 즉시 종료(이후 흐름 모두 skip).
    fun preHandle(
        request: HttpServletRequest,
        response: HttpServletResponse,
        handler: Any
    ): Boolean = true

    // Controller 호출 후, View 렌더링 전.
    // @ResponseBody 는 이미 Converter 가 응답 본문을 쓰는 중이라 ModelAndView 는 null.
    fun postHandle(
        request: HttpServletRequest,
        response: HttpServletResponse,
        handler: Any,
        modelAndView: ModelAndView?
    ) {}

    // 응답 완료 후. 예외 발생 여부와 무관하게 호출.
    fun afterCompletion(
        request: HttpServletRequest,
        response: HttpServletResponse,
        handler: Any,
        ex: Exception?
    ) {}
}
```

3 메소드의 의미:

| 메소드 | 호출 시점 | 적합 작업 |
|---|---|---|
| `preHandle` | Controller 진입 직전 | 권한 후처리, MDC trace ID 보강, 토큰 갱신 시간 검증 |
| `postHandle` | Controller 정상 반환 직후, View 렌더링 전 | (REST 면 거의 안 씀 — `ResponseBodyAdvice` 쓸 것) |
| `afterCompletion` | 응답 완료 시점 (예외 포함) | MDC 정리, 자원 close, 메트릭 기록 |

## 2. 등록 — `WebMvcConfigurer`

```kotlin
@Configuration
class WebConfig(
    private val traceIdInterceptor: TraceIdInterceptor,
    private val rateLimitInterceptor: RateLimitInterceptor
) : WebMvcConfigurer {

    override fun addInterceptors(registry: InterceptorRegistry) {
        registry.addInterceptor(traceIdInterceptor)
            .addPathPatterns("/api/**")
            .order(0)

        registry.addInterceptor(rateLimitInterceptor)
            .addPathPatterns("/api/orders/**")
            .excludePathPatterns("/api/orders/_health")
            .order(10)
    }
}
```

- `addPathPatterns` / `excludePathPatterns` 로 URL 매칭
- `order(int)` 로 순서 명시 — 작을수록 먼저
- Interceptor 빈을 만든 뒤 등록 단계에서 path 와 순서를 다시 정해주는 구조

## 3. Filter vs Interceptor 차이 — 다시 한 번 정확히

| 차원 | Filter | Interceptor |
|---|---|---|
| 실행 시점 | Servlet 레벨, DispatcherServlet **밖** | Spring MVC, **HandlerMapping 매칭 후** |
| Handler 정보 | 없음 | `HandlerMethod` 직접 접근 — 어노테이션 검사 가능 |
| Request 교체 | 가능 (`HttpServletRequestWrapper`) | 사실상 불가 (이미 매칭됨) |
| Response wrapping | 가능 | 불가 (응답 작성 중) |
| 예외 → ControllerAdvice 도달 | ❌ | ✅ (`preHandle` 예외는 Resolver 통과) |
| 메서드 단위 | URL 패턴 | URL + Handler 어노테이션 |
| 비동기 응답 본문 후처리 | 가능 | 어려움 |
| 사용 비유 | "건물 출입구 스캐너" | "사무실 안내데스크" |

## 4. 실전 패턴 4가지

### 4.1. trace ID + MDC

이 패턴은 **Filter 가 더 적합** 하지만 (모든 로그가 보게), Interceptor 로 구현 가능:

```kotlin
@Component
class TraceIdInterceptor : HandlerInterceptor {

    override fun preHandle(req: HttpServletRequest, res: HttpServletResponse, handler: Any): Boolean {
        val traceId = req.getHeader("X-Trace-Id") ?: UUID.randomUUID().toString()
        MDC.put("traceId", traceId)
        res.setHeader("X-Trace-Id", traceId)
        return true
    }

    override fun afterCompletion(req: HttpServletRequest, res: HttpServletResponse, handler: Any, ex: Exception?) {
        MDC.remove("traceId")  // 누수 방지 — Tomcat 가상 스레드 / pool 환경 모두 필수
    }
}
```

⚠️ MDC 정리는 **반드시 `afterCompletion`** — `postHandle` 에 두면 Controller 예외 시 정리 안 됨.

### 4.2. HandlerMethod 어노테이션 기반 분기

Filter 는 못 하는 일:

```kotlin
@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.RUNTIME)
annotation class RequiresFreshLogin(val maxAgeSeconds: Long = 300)

@Component
class FreshLoginInterceptor(private val sessionService: SessionService) : HandlerInterceptor {

    override fun preHandle(req: HttpServletRequest, res: HttpServletResponse, handler: Any): Boolean {
        if (handler !is HandlerMethod) return true
        val annotation = handler.getMethodAnnotation(RequiresFreshLogin::class.java) ?: return true

        val token = req.getHeader("Authorization") ?: return false.also { res.status = 401 }
        val ageSec = sessionService.tokenAgeSeconds(token)
        if (ageSec > annotation.maxAgeSeconds) {
            res.status = 401
            res.writer.write("""{"error":"REAUTH_REQUIRED"}""")
            return false
        }
        return true
    }
}

// Controller
@PostMapping("/api/payments/{id}/cancel")
@RequiresFreshLogin(maxAgeSeconds = 60)
fun cancel(@PathVariable id: Long): Response = ...
```

→ "결제 취소처럼 민감한 API 는 1분 이내 재로그인 필요" 같은 정책을 어노테이션 한 줄로.

### 4.3. 메트릭 기록

```kotlin
@Component
class MetricsInterceptor(private val registry: MeterRegistry) : HandlerInterceptor {

    private val START = "metric.start"

    override fun preHandle(req, res, handler): Boolean {
        req.setAttribute(START, System.nanoTime())
        return true
    }

    override fun afterCompletion(req, res, handler, ex: Exception?) {
        val start = req.getAttribute(START) as? Long ?: return
        val durationMs = (System.nanoTime() - start) / 1_000_000

        if (handler is HandlerMethod) {
            val tag = "${handler.beanType.simpleName}.${handler.method.name}"
            registry.timer("http.handler.duration", "handler", tag, "status", res.status.toString())
                .record(durationMs, TimeUnit.MILLISECONDS)
        }
    }
}
```

→ Micrometer `@Timed` 가 더 표준이지만, Controller 단위 측정은 Interceptor 가 자연스러움.

### 4.4. CSRF 후처리, locale resolver 보조

→ 보통 Spring Security 또는 Spring 표준이 다 처리. 직접 구현 드뭄.

## 5. `postHandle` 의 의외성

```kotlin
override fun postHandle(req, res, handler, mv: ModelAndView?) {
    // @ResponseBody 컨트롤러면 mv == null
    // 응답 본문은 이미 MessageConverter 가 쓰는 중일 수 있어 변경 불가
    // 헤더 추가는 가능하지만, 응답이 commit 됐으면 IllegalStateException
}
```

**규칙**:

- 응답 본문 후처리: **`ResponseBodyAdvice`** 만 사용
- 응답 헤더 추가: `preHandle` 또는 Filter 가 안전 (commit 전)
- 메소드 매칭된 Handler 정보를 보고 싶다면 `preHandle` 또는 `afterCompletion` 으로 충분

## 6. msa 에서의 활용 후보

현재 msa 에는 HandlerInterceptor 사용처가 **없다** (`quant` 의 `WebMvcConfig` 도 Interceptor 가 아닌 ArgumentResolver 등록 용도). 도입할 만한 후보:

| 후보 | 위치 | 효과 |
|---|---|---|
| TraceIdInterceptor | common 권장 (또는 Filter) | gateway 에서 받은 `X-Trace-Id` 를 MDC 에 매번 넣기 |
| MetricsInterceptor | common | 모든 서비스에 통일된 `http.handler.duration` 메트릭 |
| AuditInterceptor | 권한 민감 서비스 (order, payment, gifticon) | `@Auditable` 어노테이션 + audit log |

→ [18](18-msa-common-patterns.md) 에서 표준안 제안.

## 7. 안티패턴

- ❌ 비즈니스 로직을 Interceptor 에 넣기 → 결합 증가, 테스트 어려움
- ❌ `postHandle` 에서 `response.getWriter().write(...)` → 응답 commit 후 예외
- ❌ MDC put 만 하고 `afterCompletion` 에서 remove 안 함 → 가상 스레드 + 스레드풀 재사용 시 누수
- ❌ `HandlerMethod` 캐스트 안 하고 `handler` 직접 참조 → static resource 요청 등에선 `HandlerMethod` 가 아님

## 8. 면접 한 줄 답변

> "HandlerInterceptor 는 Spring MVC 가 HandlerMapping 으로 매칭한 후 호출하는 인터페이스로 `preHandle`/`postHandle`/`afterCompletion` 3 단계가 있습니다. Filter 와 달리 `HandlerMethod` 를 받아 어노테이션 기반 정책을 적용하기 좋고, MDC 같은 ThreadLocal 정리는 반드시 `afterCompletion` 에서 해야 합니다. `@ResponseBody` 라면 `postHandle` 의 ModelAndView 는 null 이고 본문 수정은 불가하니 응답 본문 후처리는 `ResponseBodyAdvice` 가 정답입니다."

## 다음 학습

- [08-spring-aop.md](08-spring-aop.md) — 메소드 단위로 더 안쪽
- [18-msa-common-patterns.md](18-msa-common-patterns.md) — msa 의 trace ID 표준안
