---
parent: 17-spring-web
seq: 08
title: Spring AOP + AspectJ — JDK Proxy / CGLIB / self-invocation
type: deep
created: 2026-05-01
---

# 08. Spring AOP + AspectJ

> 면접 단골: **"@Transactional 이 안 먹는 경우는?"** 답의 핵심은 self-invocation. 그 메커니즘을 그림으로 설명할 수 있어야 한다. (AOP = Aspect-Oriented Programming, 관점 지향 프로그래밍)

## 1. AOP 의 두 가지 구현 모델

| 모델 | 정체 | 적용 시점 | 적용 가능 대상 |
|---|---|---|---|
| **Spring AOP (Proxy)** | Spring 컨테이너가 만든 proxy 객체 | 런타임 (빈 생성 시) | Spring 빈의 public 메소드 |
| **AspectJ Compile-time Weaving (CTW)** | `ajc` 컴파일러가 .class 변형 | 컴파일 | 모든 클래스 (final, private 포함) |
| **AspectJ Load-time Weaving (LTW)** | Java agent 가 클래스 로딩 시 변형 | JVM 로딩 | 모든 클래스 |

**99% 의 Spring 프로젝트는 Spring AOP (proxy)** 를 쓴다. AspectJ weaving 은 framework 코드, infrastructure (`@Configurable` 도메인 객체) 같은 특수 케이스.

## 2. Proxy 의 두 가지 구현 — JDK vs CGLIB

### JDK Dynamic Proxy

- 표준 Java API (`java.lang.reflect.Proxy`)
- **인터페이스 기반** — proxy 가 인터페이스를 구현하고 모든 호출을 InvocationHandler 로 forward
- 타깃 클래스가 인터페이스를 구현해야 함

```kotlin
interface OrderService { fun place(req: OrderRequest): Order }

@Service
class OrderServiceImpl(...) : OrderService {
    override fun place(req: OrderRequest): Order = ...
}

// Spring 이 OrderService 인터페이스를 구현하는 proxy 만듦
//   OrderServiceProxy → InvocationHandler → 실제 OrderServiceImpl 호출
// 주입 받을 때 OrderService 타입으로 받아야 함. OrderServiceImpl 로 받으면 ClassCastException.
```

### CGLIB Proxy

- 바이트코드 라이브러리 (`net.sf.cglib`, Spring 5+ 는 `org.springframework.cglib` 내장)
- **클래스 상속 기반** — 타깃 클래스를 상속한 subclass 를 만들고 메소드 override
- 인터페이스 없는 클래스도 proxy 가능
- **`final` 클래스/메소드 proxy 불가** (override 불가) — Kotlin 의 기본 final 정책 때문에 `open class` 또는 `kotlin-allopen` 플러그인 필요

```kotlin
@Service
open class OrderService(...) {           // open 필요
    open fun place(req: OrderRequest) {  // open 필요
        ...
    }
}
```

또는 build.gradle.kts:

```kotlin
plugins {
    kotlin("plugin.spring") version "..."  // @Component, @Service 등을 자동 open
}
```

### Spring Boot 의 기본값

- **Spring Boot 2.x+ : CGLIB 가 기본**. `spring.aop.proxy-target-class=true` 가 default.
- 인터페이스가 있어도 CGLIB 사용. 이유: 타입 일관성 (subclass 라 타깃 클래스로 주입 받아도 OK)
- JDK proxy 쓰려면 `spring.aop.proxy-target-class=false`

## 3. self-invocation 이 안 먹는 이유

### 그림

```
Client
  │  주입 받은 OrderService 는 사실 OrderServiceProxy
  ▼
┌──────────────────────────┐
│  OrderServiceProxy       │   ← AOP advice 호출 지점
│   .place(req) {          │
│     // before advice      │
│     target.place(req)    │   ← 실제 OrderServiceImpl 호출
│     // after advice       │
│   }                      │
└────────┬─────────────────┘
         │  proxy 가 target 으로 위임
         ▼
┌──────────────────────────┐
│  OrderServiceImpl (target)│
│   .place(req) {          │
│     this.cancel(...)     │   ← `this` 는 target 자기 자신,
│                           │      proxy 가 아님 → advice 안 먹힘
│   }                      │
│   .cancel() {            │
│     // @Transactional ... │
│   }                      │
└──────────────────────────┘
```

### 왜?

- AOP advice 는 **proxy 객체** 가 가로채는 것
- target 클래스 안에서 `this.method()` 는 target 자기 자신을 호출 → proxy 를 거치지 않음
- 따라서 `@Transactional`, `@Async`, `@Cacheable`, `@Retry` 등 모두 **같은 빈 안의 self-invocation 에서 안 먹힘**

### 해결책

| 방법 | 코드 | 트레이드오프 |
|---|---|---|
| 자가 주입 (self-injection) | `class A { @Autowired lateinit var self: A; fun x() = self.y() }` | 순환 참조 — Spring Boot 4 에선 default 거부 |
| `ApplicationContext.getBean(A::class)` | `ctx.getBean(A::class).y()` | DI 주입 우회 — 테스트성 ↓ |
| 메소드를 다른 빈으로 분리 | `class B { @Transactional fun y() }`; `class A(b: B) { fun x() = b.y() }` | **표준 패턴** — 책임 분리 |
| AspectJ weaving 도입 | (compile-time) | 빌드 복잡 — 보통 과한 해결 |

→ msa 에서는 **3번(분리)** 이 표준. quant, order 모두 이 패턴.

## 4. `@Aspect` 작성

### 의존성

```kotlin
implementation("org.springframework.boot:spring-boot-starter-aop")
```

### 어노테이션 + Pointcut

```kotlin
@Aspect
@Component
class TimingAspect(private val registry: MeterRegistry) {

    // Pointcut 재사용 정의
    @Pointcut("@annotation(io.micrometer.core.annotation.Timed)")
    fun timedAnnotation() {}

    // Around: 가장 강력. 호출 전/후/예외 모두 hook.
    @Around("timedAnnotation()")
    fun aroundTimed(pjp: ProceedingJoinPoint): Any? {
        val start = System.nanoTime()
        return try {
            pjp.proceed()
        } finally {
            val elapsed = (System.nanoTime() - start) / 1_000_000
            registry.timer("custom.timing", "method", pjp.signature.toShortString())
                .record(elapsed, TimeUnit.MILLISECONDS)
        }
    }

    // Before/After/AfterReturning/AfterThrowing 도 가능
    @Before("execution(* com.kgd..service.*Service.*(..))")
    fun logEntry(joinPoint: JoinPoint) {
        log.debug("→ {}", joinPoint.signature.toShortString())
    }
}
```

### Pointcut 표현식 예시

| 표현 | 의미 |
|---|---|
| `execution(* com.kgd.order.application.*.*(..))` | order 의 application 패키지 모든 빈/메소드 |
| `@within(com.kgd.common.annotation.Auditable)` | 클래스에 Auditable 붙은 빈의 모든 메소드 |
| `@annotation(org.springframework.transaction.annotation.Transactional)` | 메소드에 @Transactional 붙은 것 |
| `bean(orderService)` | 빈 이름 매칭 |
| `args(java.lang.String)` | 인자가 String 1개 |
| `target(com.kgd.common.web.AbstractController+)` | 타깃이 AbstractController 의 서브클래스 |

### Advice 종류

| Advice | 호출 시점 | 반환 변경 |
|---|---|---|
| `@Before` | 메소드 진입 직전 | ✗ |
| `@AfterReturning` | 정상 반환 후 (`returning` 으로 값 받음) | ✗ |
| `@AfterThrowing` | 예외 throw 후 (`throwing` 으로 받음) | ✗ |
| `@After` | 정상/예외 무관 finally 자리 | ✗ |
| `@Around` | 모두 + 호출 자체 가로채기 (`pjp.proceed()` 명시) | ✅ |

→ 시간 측정/retry/circuit breaker 같이 호출 자체를 감싸야 하면 항상 `@Around`.

## 5. `@EnableAspectJAutoProxy`

Spring Boot 는 `aop` starter 가 있으면 자동 활성. 명시 옵션:

```kotlin
@Configuration
@EnableAspectJAutoProxy(proxyTargetClass = true)  // CGLIB 강제
class AopConfig
```

옵션:

| 속성 | 기본 | 설명 |
|---|---|---|
| `proxyTargetClass` | true (Boot 2+) | CGLIB 사용 여부 |
| `exposeProxy` | false | `AopContext.currentProxy()` 로 self-invocation 우회 가능. 권장 X (분리 패턴이 정공) |

## 6. AspectJ weaving (가볍게 짚기)

| 모드 | 시점 | 도입 비용 |
|---|---|---|
| **CTW (compile-time)** | 빌드 시 `ajc` 가 .class 변형 | 빌드 도구 의존성 + IDE 통합 필요 |
| **LTW (load-time)** | JVM 시작 시 `-javaagent:aspectjweaver.jar` | 운영 단순하지만 시작 느림 |

- self-invocation 도 적용됨
- `final` / `private` 메소드, 도메인 객체(`@Configurable`) 도 가능
- 트레이드오프: 빌드/배포 복잡, 이해 비용 높음

→ **msa 에선 거의 불필요**. Spring AOP 로 다 해결.

## 7. AOP 의 흔한 함정 5

1. **`@Transactional` self-invocation** → 분리 패턴
2. **Kotlin 클래스 final 기본값** → `kotlin-spring` 플러그인 또는 `open class`
3. **private 메소드에 advice** → proxy 는 public 만 가로챔. private 는 컴파일러가 final 로 처리
4. **Mono/Flux 반환 타입에 timing** → `pjp.proceed()` 직후 시간이 아니라 `doFinally` 시점이 맞음 ([04](04-webmvc-vs-webflux.md) 참고)
5. **여러 Aspect 의 순서** → `@Order` 로 명시. 외부 라이브러리 advice (Transactional 등) 와 충돌 가능성 의식

## 8. msa 에서의 AOP 활용 현황

- **현재 운영 코드에 `@Aspect` 사용처 없음**
- 유일하게 `ai/plugins/ai-debugger/templates/` 의 `io-snapshot-aspect.kt` 가 template — 실제 등록 안 됨
- 후보:
  - 외부 API 호출 timing (charting, 빗썸/업비트 client) — `@Around` + Micrometer
  - `@Auditable` 애노테이션 → 감사 로그 (order, gifticon)
  - Retry / CircuitBreaker — Resilience4j 가 이미 AOP 기반

→ [18](18-msa-common-patterns.md) 에서 common AOP 표준 패턴 제안.

## 9. 면접 답변 핵심

### Q. "AOP 가 안 먹는 경우는?"

> "Spring AOP 는 proxy 기반이라 같은 빈 안에서의 self-invocation, private/final 메소드, proxy 적용 안 된 빈(예: Filter 빈, 일부 BeanPostProcessor) 에는 advice 가 적용되지 않습니다. 가장 흔한 케이스가 `@Transactional` self-invocation 인데, 메소드를 별도 빈으로 분리하거나 self-injection 으로 우회합니다. 정공은 분리, AspectJ weaving 까지 가면 너무 무겁습니다."

### Q. "JDK Proxy 와 CGLIB 의 차이는?"

> "JDK Proxy 는 인터페이스 기반이라 타깃 클래스가 인터페이스를 구현해야 하고, CGLIB 은 상속 기반이라 인터페이스 없이도 가능하지만 final 클래스/메소드는 proxy 불가합니다. Spring Boot 2 부터 CGLIB 이 기본이고, Kotlin 은 클래스가 기본 final 이라 `kotlin-spring` 플러그인이 자동 open 처리해줍니다."

### Q. "@Around 와 @Before 의 차이는?"

> "@Before 는 메소드 진입 전에만 hook 이고 반환값/예외에 영향을 줄 수 없는 반면, @Around 는 `ProceedingJoinPoint.proceed()` 를 직접 호출하니 호출 자체를 가로채 반환값 교체, 예외 변환, retry, timing 같은 작업을 다 할 수 있습니다. 시간 측정처럼 finally 자리가 필요하면 항상 @Around 입니다."

## 다음 학습

- [09-jackson-objectmapper.md](09-jackson-objectmapper.md) — 응답 직렬화 영역으로 진입
- [18-msa-common-patterns.md](18-msa-common-patterns.md) — msa AOP 표준 후보
