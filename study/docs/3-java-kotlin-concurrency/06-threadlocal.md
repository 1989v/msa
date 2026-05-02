---
parent: 3-java-kotlin-concurrency
seq: 06
title: ThreadLocal + InheritableThreadLocal
type: deep
created: 2026-05-01
---

# 06. ThreadLocal + InheritableThreadLocal

## 핵심 한 줄

`ThreadLocal<T>` 은 **각 스레드별로 독립된 변수 슬롯** 을 만든다. 스레드 풀 환경에선 *반드시 `remove()`* 안 하면 메모리 누수 + 다른 요청에 leak. coroutine 환경에선 `ThreadContextElement` 또는 코루틴 컨텍스트로 대체해야 한다.

## 구조

각 `Thread` 객체는 `ThreadLocalMap threadLocals` 필드를 가진다. `ThreadLocal<T>` 인스턴스는 그 맵의 *키* 역할.

```
Thread A
  threadLocals = {
    [ThreadLocal#1]: "valueA1",
    [ThreadLocal#2]: "valueA2"
  }

Thread B
  threadLocals = {
    [ThreadLocal#1]: "valueB1"
  }
```

```kotlin
val tlUser = ThreadLocal<String>()

// Thread A
tlUser.set("alice")
println(tlUser.get())  // "alice"

// Thread B
println(tlUser.get())  // null (Thread A 의 값 안 보임)
```

## 주 사용처

1. **request-scoped 컨텍스트** — Spring Security 의 `SecurityContextHolder`, MDC (로그 컨텍스트), Hibernate `EntityManager` 바인딩
2. **format 객체 재사용** — `SimpleDateFormat` 같은 thread-unsafe 객체를 스레드별로 가짐
   ```kotlin
   private val df = ThreadLocal.withInitial { SimpleDateFormat("yyyy-MM-dd") }
   fun format(d: Date) = df.get().format(d)
   ```
3. **transaction-id, trace-id 전파** — controller 에서 set, service/repository 에서 get

## 메모리 누수 — 반드시 알아야 하는 함정

`ThreadLocalMap` 의 **키는 WeakReference**, **값은 strong reference**.

```
ThreadLocalMap.Entry:
  - key:   WeakReference<ThreadLocal>     (gc 가능)
  - value: Object                          (strong, gc 안 됨)
```

### 무슨 일이 일어나나

1. Application 코드가 `ThreadLocal` 인스턴스에 대한 참조를 잃음
2. WeakReference 라 ThreadLocal 자체는 GC 됨 → key 가 null 이 됨
3. **그러나 value 는 strong reference 라 안 사라짐** → "stale entry"
4. 스레드 풀의 worker thread 가 영원히 살아있으면 stale entry 도 영원히 살아있음
5. 누적 → OOM

### `remove()` 가 정답

```kotlin
val tlUser = ThreadLocal<String>()

fun handle(req: Request) {
    tlUser.set(req.userId)
    try {
        process()
    } finally {
        tlUser.remove()    // 반드시!
    }
}
```

→ `try-finally` 안에서 `remove()` 호출. Spring 은 `Filter` / `Interceptor` 에서 자동 처리하지만 직접 만든 ThreadLocal 은 본인 책임.

### Spring `RequestContextHolder` 가 안전한 이유

```java
// Spring 내부 (단순화)
public class RequestContextHolder {
    static ThreadLocal<RequestAttributes> attrs = new ThreadLocal<>();

    public static void resetRequestAttributes() {
        attrs.remove();
    }
}

// DispatcherServlet
try {
    attrs.set(new ServletRequestAttributes(req));
    handler.handle(req);
} finally {
    RequestContextHolder.resetRequestAttributes();   // 매 요청마다 remove
}
```

→ 요청 끝마다 자동으로 `remove()`. ThreadPool 의 worker 가 다음 요청에서 *깨끗한 ThreadLocal* 을 받음.

## 스레드 풀 환경의 cross-request leak

```kotlin
val currentUser = ThreadLocal<String>()

@GetMapping("/api/me")
fun me(): String {
    val user = currentUser.get()   // 만약 이전 요청이 set 만 하고 remove 안 했으면?
    return user ?: "anonymous"
}

// 이전 요청 처리:
fun previousRequest() {
    currentUser.set("alice")
    // ❌ remove() 빼먹음
    // 다음 요청이 같은 worker thread 에서 처리되면 currentUser.get() = "alice"
}
```

→ **사용자 A 의 요청 정보가 사용자 B 의 요청에 leak**. **보안 사고**. 가장 위험한 안티패턴.

방어:
- 항상 `try-finally` + `remove()`
- 또는 컨텍스트 객체를 method 파라미터로 명시적 전파
- 또는 Spring Security 처럼 framework 가 자동 cleanup 하는 메커니즘 신뢰

## InheritableThreadLocal

자식 스레드가 부모의 값을 *복사* 받는 변형.

```kotlin
val parent = InheritableThreadLocal<String>()
parent.set("alice")

Thread {
    println(parent.get())  // "alice"  (부모에서 복사됨)
}.start()
```

내부적으로 `Thread.init()` 에서 부모의 `inheritableThreadLocals` 를 자식에게 *얕은 복사*.

### 함정

- **스레드 풀에선 무용** — 풀의 worker 는 풀이 만들 때 정해진 부모로 inherit. 이후 들어오는 task 의 호출자(부모) 가 바뀌어도 worker 는 그 시점의 inherit 만 가짐.
- **mutable 객체는 위험** — 얕은 복사라 부모/자식이 같은 객체를 공유.

→ `InheritableThreadLocal` 은 실무에서 거의 안 씀. 대안:
- **TransmittableThreadLocal** (Alibaba 오픈소스) — 풀에서도 동작
- **명시적 컨텍스트 캐리어** — `Runnable` 을 wrap 해서 컨텍스트 명시 전달

## ThreadLocal 과 Coroutine

코루틴은 `suspend` 후 다른 스레드로 *재배치* 될 수 있다. `ThreadLocal.set()` 후 suspend 하면 다른 스레드에선 그 값을 못 본다.

```kotlin
val tl = ThreadLocal<String>()

suspend fun broken() {
    tl.set("alice")
    delay(100)             // 여기서 다른 스레드로 옮겨질 수 있음
    println(tl.get())      // null 또는 다른 값!
}
```

### 해결 1: `asContextElement()`

```kotlin
val tl = ThreadLocal<String>()

withContext(tl.asContextElement("alice")) {
    delay(100)
    println(tl.get())   // "alice" — 코루틴 컨텍스트가 따라감
}
```

- coroutine context 에 `ThreadContextElement` 가 들어감
- suspend/resume 시 `updateThreadContext` / `restoreThreadContext` 호출 → 새 스레드에 ThreadLocal 값 복사

### 해결 2: 코루틴 컨텍스트로 대체

```kotlin
class UserContext(val userId: String) : AbstractCoroutineContextElement(Key) {
    companion object Key : CoroutineContext.Key<UserContext>
}

withContext(UserContext("alice")) {
    val ctx = coroutineContext[UserContext.Key]
    println(ctx?.userId)
}
```

→ 코루틴 표준 메커니즘. ThreadLocal 자체를 안 쓴다.

## MDC (로그 컨텍스트) 와 coroutine

`MDC.put("traceId", ...)` 은 내부적으로 ThreadLocal. coroutine 에서 안 따라감.

```kotlin
import kotlinx.coroutines.slf4j.MDCContext

withContext(MDCContext()) {   // 현재 MDC 를 코루틴 컨텍스트로 capture
    log.info { "start" }
    delay(100)
    log.info { "end" }   // traceId 동일하게 출력
}
```

→ msa 코드에서 coroutine 쓰는 곳 (quant 등) 은 **MDCContext 누락이 흔한 버그 원인**. trace 가 끊긴다.

## msa 코드 사례 (가상 점검)

`gateway` 의 `AuthenticationGatewayFilter` 는 **WebFlux 라 ThreadLocal 안 씀** — Reactor Context 사용. Reactor 는 thread hopping 이 일상이라 ThreadLocal 은 거의 무용.

일반 MVC 서비스 (order, product 등) 는:
- Spring Security `SecurityContextHolder` (ThreadLocal 기반) — framework 자동 cleanup
- MDC 로깅 — Spring Boot 기본 + Filter 에서 cleanup
- 명시적 ThreadLocal 사용은 거의 없음 (좋은 신호)

만약 `@Async` + ThreadLocal 조합 쓰면 주의:

```kotlin
@Async
fun process() {
    val user = SecurityContextHolder.getContext().authentication  // null!
}
```

→ `@Async` 는 새 스레드에서 실행 → SecurityContext (ThreadLocal) 가 따라가지 않음. Spring 이 제공하는 `DelegatingSecurityContextRunnable` / `SecurityContextHolderStrategy=MODE_INHERITABLETHREADLOCAL` 또는 **request 정보를 메서드 파라미터로 명시 전달** 이 정답.

## 디버깅 팁

ThreadLocal 누수 의심 시:

```bash
jcmd <pid> GC.class_histogram | grep -i ThreadLocal
```

- `ThreadLocalMap$Entry` 가 비정상적으로 많으면 누수.
- heap dump 떠서 MAT (Eclipse Memory Analyzer) 의 dominator tree 분석.

## 면접 단골

**Q. `ThreadLocal` 을 풀 환경에서 안전하게 쓰는 방법?**

`try-finally` 패턴으로 매 요청 끝에 `remove()` 호출. Spring 의 표준 메커니즘 (Security Context, MDC 등) 은 framework 가 자동 cleanup 하니까 그 위에 얹어 쓰는 게 안전. 직접 ThreadLocal 만들 거면 `Filter` / `Interceptor` 또는 try-finally 로 감싸야 한다.

**Q. WeakReference 키인데 왜 누수가 나나?**

key (ThreadLocal) 는 약 참조라 GC 되지만, value 는 strong 라 그대로 살아있다. ThreadLocalMap 안에 key=null entry (stale entry) 가 쌓이고, 그 value 도 strong 이라 GC 안 된다. 풀의 worker 가 영원히 살아있으면 누적 → OOM. 그래서 `remove()` 로 명시적 제거가 필요.

**Q. `InheritableThreadLocal` 을 쓰지 말라는 이유?**

스레드 풀 환경에서 안 동작. worker 스레드가 풀 생성 시점의 부모로 inherit 받고, 이후 호출자가 바뀌어도 갱신 안 됨. 그래서 풀이 일반화된 현대 백엔드에선 거의 무용. 대안은 TransmittableThreadLocal (Alibaba), 또는 컨텍스트를 메서드 파라미터로 명시 전달, 또는 coroutine context.

**Q. coroutine 에서 ThreadLocal 쓰면 어떤 문제?**

suspend 후 resume 될 때 *다른 스레드* 일 수 있어서 `ThreadLocal.get()` 이 null 또는 다른 값을 반환. 해결은 `ThreadLocal.asContextElement(value)` 로 코루틴 컨텍스트에 element 등록, 또는 ThreadLocal 자체를 안 쓰고 코루틴 표준 컨텍스트 메커니즘 사용. MDC 로깅도 같은 문제 — `MDCContext` 사용해야 trace 유지.

## 다음 학습

- [07-executor-threadpool.md](07-executor-threadpool.md) — ThreadPool 환경
- [16-structured-concurrency.md](16-structured-concurrency.md) — coroutine 컨텍스트
