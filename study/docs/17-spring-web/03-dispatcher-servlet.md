---
parent: 17-spring-web
seq: 03
title: DispatcherServlet 내부 흐름
type: deep
created: 2026-05-01
---

# 03. DispatcherServlet 내부 흐름

> 01 의 4단계를 한 번 더 확대한다. 면접에서 "DispatcherServlet 이 받은 요청은 어떤 컴포넌트들을 거치나요?" 가 나오면 이 그림을 그릴 수 있어야 한다.

## 1. 클래스 다이어그램 (요점)

```
DispatcherServlet (extends FrameworkServlet → HttpServletBean → HttpServlet)
   │
   ├─ HandlerMapping[]               # URL → HandlerExecutionChain
   │   └─ RequestMappingHandlerMapping (가장 흔함)
   │   └─ BeanNameUrlHandlerMapping
   │   └─ SimpleUrlHandlerMapping
   │
   ├─ HandlerAdapter[]               # 실제 호출
   │   └─ RequestMappingHandlerAdapter (@Controller 처리)
   │   └─ HttpRequestHandlerAdapter
   │   └─ SimpleControllerHandlerAdapter
   │
   ├─ HandlerExceptionResolver[]     # 예외 → 응답
   │   └─ ExceptionHandlerExceptionResolver (@ControllerAdvice)
   │   └─ ResponseStatusExceptionResolver (@ResponseStatus)
   │   └─ DefaultHandlerExceptionResolver (Spring 표준 예외)
   │
   ├─ ViewResolver[]                 # 논리 뷰명 → View
   │   (REST API 에서는 거의 미사용)
   │
   ├─ LocaleResolver / ThemeResolver
   │
   └─ MultipartResolver              # multipart/form-data 처리
       └─ StandardServletMultipartResolver
```

## 2. `doDispatch()` 의 9단계 (단순화)

`DispatcherServlet#doDispatch(req, res)` 는 대략 이렇게 동작한다:

```kotlin
// 의사 코드 — 실제 구현은 더 길지만 핵심만
fun doDispatch(req: HttpServletRequest, res: HttpServletResponse) {
    // 1. multipart 여부 확인
    val processedRequest = checkMultipart(req)

    // 2. HandlerMapping 으로 HandlerExecutionChain 조회
    val mappedHandler: HandlerExecutionChain = getHandler(processedRequest)
        ?: run { noHandlerFound(processedRequest, res); return }

    // 3. 적합한 HandlerAdapter 선택
    val ha: HandlerAdapter = getHandlerAdapter(mappedHandler.handler)

    // 4. Interceptor.preHandle (false 반환 시 즉시 종료)
    if (!mappedHandler.applyPreHandle(processedRequest, res)) return

    var mv: ModelAndView? = null
    var dispatchException: Exception? = null
    try {
        // 5. Handler 실제 호출 (Controller 메소드 실행)
        mv = ha.handle(processedRequest, res, mappedHandler.handler)

        // 6. View 이름 보정 (REST 면 패스)
        applyDefaultViewName(processedRequest, mv)

        // 7. Interceptor.postHandle
        mappedHandler.applyPostHandle(processedRequest, res, mv)
    } catch (ex: Exception) {
        dispatchException = ex
    }

    // 8. 결과 처리: 예외 처리 + View rendering / 응답 직렬화
    processDispatchResult(processedRequest, res, mappedHandler, mv, dispatchException)

    // 9. Interceptor.afterCompletion (역순)
    mappedHandler.triggerAfterCompletion(processedRequest, res, dispatchException)
}
```

## 3. 단계별 핵심

### 2단계 — HandlerMapping

- `RequestMappingHandlerMapping` 이 `@RequestMapping`/`@GetMapping`/... 를 스캔해 `Map<RequestMappingInfo, HandlerMethod>` 로 보유
- 매칭 결과는 `HandlerMethod` (= 컨트롤러 빈 + Method) + `Interceptor[]`
- 이 시점에 **어떤 `HandlerInterceptor` 들이 적용될지 결정** 됨 (path pattern 으로 필터링)

### 3단계 — HandlerAdapter 선택

- `RequestMappingHandlerAdapter` 가 `HandlerMethod` 처리 담당
- 내부에 `HandlerMethodArgumentResolverComposite`, `HandlerMethodReturnValueHandlerComposite` 보유
- **인자 매핑**: `@RequestParam`, `@PathVariable`, `@RequestBody`(→ Jackson), `@RequestHeader`, 커스텀 resolver
- **반환값 매핑**: `@ResponseBody` → `RequestResponseBodyMethodProcessor` → MessageConverter

### 5단계 — Handler 호출 (실제 비즈니스 진입)

- `InvocableHandlerMethod#invokeForRequest` 가 reflection 으로 호출
- 예외 발생 시 즉시 `dispatchException` 에 잡힘
- 트랜잭션은 보통 Service 진입 시 시작 — Controller 자체에는 없음 (msa ADR (Architecture Decision Record, 아키텍처 결정 기록) -0020)

### 7단계 — Interceptor.postHandle

- `@ResponseBody` 면 Converter 가 응답을 이미 쓰는 중일 수 있음 → `ModelAndView` 가 null
- **응답 본문 변경 목적이라면 `ResponseBodyAdvice` 사용**

### 8단계 — processDispatchResult

```
if (dispatchException != null) {
    HandlerExceptionResolver[] 순회 → ModelAndView 또는 응답 직접 작성
    ↳ ExceptionHandlerExceptionResolver 가 @RestControllerAdvice 처리
}
if (mv != null && !mv.wasCleared()) {
    ViewResolver → View → render
}
// REST 응답은 보통 여기 도달 전, ReturnValueHandler 안에서 이미 본문이 쓰여짐
```

### 9단계 — afterCompletion

- 등록된 Interceptor 의 `afterCompletion` 을 **역순** 호출
- 예외 발생/정상 모두 호출 → MDC 정리, 자원 반환에 적합

## 4. ArgumentResolver 와 ReturnValueHandler

### ArgumentResolver

`@RequestBody DTO (Data Transfer Object, 데이터 전송 객체)` 를 받기까지의 흐름:

```
RequestResponseBodyMethodProcessor.resolveArgument()
  → readWithMessageConverters()
    → MappingJackson2HttpMessageConverter.read()
      → ObjectMapper.readValue(InputStream, JavaType)
```

- **즉, Jackson 의 ObjectMapper 가 여기서 사용됨**
- 직렬화 양쪽(요청/응답)이 모두 `MappingJackson2HttpMessageConverter` 한 빈을 거침 → ObjectMapper 표준화의 가치

### Custom ArgumentResolver

msa 의 `quant/.../TenantIdHeaderArgumentResolver` 가 좋은 예:

```kotlin
@Configuration
class WebMvcConfig : WebMvcConfigurer {
    override fun addArgumentResolvers(resolvers: MutableList<HandlerMethodArgumentResolver>) {
        resolvers.add(TenantIdHeaderArgumentResolver())
    }
}
```

- 헤더 → 도메인 ValueObject 매핑
- Filter/Interceptor 로 검증한 값을 Controller 인자로 그대로 받기

### ReturnValueHandler

```
RequestResponseBodyMethodProcessor.handleReturnValue()
  → ResponseBodyAdvice.beforeBodyWrite()  (있으면)
  → MappingJackson2HttpMessageConverter.write()
    → ObjectMapper.writeValue(OutputStream, value)
```

`ResponseBodyAdvice` 는 **모든 `@RestController` 응답을 후처리** 할 수 있는 hook. msa 에서 ApiResponse 통일 래핑이 필요해지면 1순위 후보.

## 5. 예외 처리 경로

```
Controller 메소드에서 throw
  ↓
InvocableHandlerMethod 가 reflection 호출 → invocation target exception 풀어냄
  ↓
DispatcherServlet 의 dispatchException 변수에 보관
  ↓
processDispatchResult → HandlerExceptionResolver 순회
  ↓
ExceptionHandlerExceptionResolver 가 @ControllerAdvice 의 @ExceptionHandler 매칭
  → msa 의 GlobalExceptionHandler 가 BusinessException → ApiResponse.error 매핑
  ↓
HandlerInterceptor.afterCompletion (예외 인자 포함)
```

**중요**: Servlet **Filter 에서 던진 예외는 위 흐름에 들어오지 못한다** — Filter 가 직접 try/catch + 응답 작성해야 함.

## 6. msa 매핑 (재확인)

| DispatcherServlet 컴포넌트 | msa 사용 위치 |
|---|---|
| RequestMappingHandlerMapping | Spring Boot 자동 |
| HandlerAdapter | Spring Boot 자동 |
| ArgumentResolver(custom) | quant `TenantIdHeaderArgumentResolver` |
| ReturnValueHandler | Spring Boot 자동 (Jackson) |
| HandlerExceptionResolver | `common/exception/GlobalExceptionHandler` (`@RestControllerAdvice`) + service-local: `quant/.../QuantExceptionHandler` |
| HandlerInterceptor | **현재 사용 안 함** ([18](18-msa-common-patterns.md) 에서 trace ID 주입 후보) |
| MessageConverter | `MappingJackson2HttpMessageConverter` (Spring Boot 자동) — 단, msa 의 `CommonJacksonAutoConfiguration` 은 `Jackson 2 ObjectMapper` 만 bridge ([09](09-jackson-objectmapper.md)) |
| ResponseBodyAdvice | **현재 사용 안 함** ([19](19-improvements.md) 후보: ApiResponse 자동 래핑) |

## 7. 면접 한 줄 답변

> "DispatcherServlet 은 HandlerMapping 으로 컨트롤러 메소드를 찾고, HandlerAdapter 가 ArgumentResolver 를 통해 인자를 매핑해 호출합니다. 결과는 ReturnValueHandler 와 MessageConverter 를 거쳐 직렬화되고, 예외는 HandlerExceptionResolver 가 @ControllerAdvice 와 매칭합니다. Interceptor 는 이 흐름의 preHandle/postHandle/afterCompletion 시점에 끼어들고, 모든 응답 직렬화는 결국 ObjectMapper 한 인스턴스를 통과합니다."

## 다음 학습

- [04-webmvc-vs-webflux.md](04-webmvc-vs-webflux.md) — 위 그림이 WebFlux 에서 어떻게 달라지는가
- [09-jackson-objectmapper.md](09-jackson-objectmapper.md) — ⑦ 단계의 ObjectMapper
