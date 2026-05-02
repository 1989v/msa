---
parent: 3-java-kotlin-concurrency
seq: 14
title: Kotlin Coroutine 내부 (Continuation + suspend 컴파일)
type: deep
created: 2026-05-01
---

# 14. Kotlin Coroutine 내부

## 핵심 한 줄

Kotlin coroutine 은 컴파일러가 **suspend 함수를 state machine 으로 변환** 하고, *각 suspension point* 에서 `Continuation` 객체를 생성/저장한다. 스레드를 점유하지 않은 채 실행 상태를 캡슐화 — 그게 coroutine 이 "수만 개 동시 실행" 가능한 이유.

## 표면 — suspend 함수

```kotlin
suspend fun fetchUser(id: Long): User {
    val profile = profileApi.fetch(id)   // suspend
    val orders = orderApi.fetch(id)      // suspend
    return User(profile, orders)
}
```

- 일반 함수처럼 직선으로 읽힘
- 그러나 컴파일러가 만든 결과물은 *완전히 다른* 형태

## 컴파일 결과 — state machine

위 함수는 **Continuation Passing Style (CPS) 변환** 을 거친다.

```java
// 컴파일러 생성 (단순화 + Java 의사코드)
Object fetchUser(long id, Continuation<? super User> continuation) {
    Object var = ...;
    if (continuation instanceof FetchUserContinuation) {
        // 재진입 — 저장된 state 복구
        FetchUserContinuation cont = (FetchUserContinuation) continuation;
        var = cont.result;
        cont.label;  // 어디까지 갔나
    } else {
        cont = new FetchUserContinuation(this, continuation);
    }

    switch (cont.label) {
        case 0:
            cont.label = 1;
            cont.id = id;
            Object profile = profileApi.fetch(id, cont);   // suspend point
            if (profile == COROUTINE_SUSPENDED) return COROUTINE_SUSPENDED;
            // fall through

        case 1:
            cont.profile = (Profile) profile;
            cont.label = 2;
            Object orders = orderApi.fetch(cont.id, cont);   // suspend point
            if (orders == COROUTINE_SUSPENDED) return COROUTINE_SUSPENDED;
            // fall through

        case 2:
            return new User(cont.profile, (List<Order>) orders);
    }
}

class FetchUserContinuation extends ContinuationImpl {
    int label;
    long id;
    Profile profile;
    Object result;
    Continuation<?> completion;
    // ...
}
```

핵심:
1. 함수에 **숨겨진 마지막 파라미터 `Continuation`** 추가됨
2. 함수 본문이 **`switch (label)` state machine** 으로 변환
3. 각 suspend 호출은 *반환값이 `COROUTINE_SUSPENDED` 면 즉시 return* — 스레드를 안 잡음
4. 이후 콜백 (e.g., HTTP 응답 도착) 이 `continuation.resumeWith(result)` 호출 → 다시 같은 함수 재진입, label 따라 점프

## `Continuation` 인터페이스

```kotlin
interface Continuation<in T> {
    val context: CoroutineContext
    fun resumeWith(result: Result<T>)
}
```

- `resumeWith` 로 결과 또는 예외를 전달
- `context` 가 dispatcher, Job, MDC 등을 들고 있음

## suspend 의 *진짜* 의미

`suspend` 함수는 **두 가지** 중 하나로 동작:

1. **즉시 값 반환** — `COROUTINE_SUSPENDED` 가 아닌 값 반환 → 스레드 그대로 다음 줄 진행
2. **suspend 진입** — `COROUTINE_SUSPENDED` 반환 → 호출 chain 의 모든 함수가 동일하게 즉시 return → 스레드 풀려남 → 나중에 `Continuation.resumeWith` 로 재진입

→ 즉 **suspend 자체가 비동기를 만드는 게 아님**. suspend 함수 *안에서* 비동기 처리 (`delay`, `withContext`, callback wrap) 를 하면 그제서야 진짜 suspension.

```kotlin
suspend fun foo() {                   // suspend 가능 함수
    println("hi")                     // 일반 코드
    return                            // 즉시 반환 — suspension 없음
}

suspend fun bar() {
    delay(1000)                       // 진짜 suspension
}
```

## CoroutineScope, Job, Dispatcher

```kotlin
val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

scope.launch {                        // 새 coroutine 시작
    val user = fetchUser(1)
    println(user)
}
```

- `CoroutineScope` — coroutine 들의 *부모* (Job 트리의 root)
- `Job` — 하나의 coroutine 을 추적하는 핸들 (cancel, join, 자식 관리)
- `CoroutineContext` — Job + Dispatcher + 기타 element 의 합집합 (immutable map)
- `Dispatcher` — coroutine 을 *어느 스레드 풀에서 resume 할지* 결정

### Dispatcher 종류

| Dispatcher | 스레드 풀 | 용도 |
|---|---|---|
| `Dispatchers.Default` | CPU-bound 풀 (코어 수) | 계산, 파싱 |
| `Dispatchers.IO` | IO-bound 풀 (default 64+, 동적 확장) | HTTP, JDBC, 파일 |
| `Dispatchers.Main` | 단일 스레드 (UI) | Android, Desktop |
| `Dispatchers.Unconfined` | 호출자 스레드 (resume 시 다른 스레드) | 거의 안 씀 |

> **Virtual Threads + coroutine** — JDK 25 에서는 `Dispatchers.IO` 를 virtual thread executor 로 교체할 수 있다. coroutine + virtual thread 조합은 blocking IO 호출이 많을 때 추가 이득.

## launch vs async

```kotlin
// launch — fire and forget
val job: Job = scope.launch {
    doWork()
}
job.join()        // 끝날 때까지 대기

// async — 결과 받음 (Deferred = Job + 결과)
val deferred: Deferred<Int> = scope.async {
    computeValue()
}
val result = deferred.await()
```

- `launch` 는 결과 없음 (`Job`)
- `async` 는 결과 있음 (`Deferred<T>`, `await()` 로 받음)
- `async + await` 가 CompletableFuture 와 가장 비슷

## suspend 의 컴파일러 친화성

CPS 변환은 컴파일러가 *함수 호출 chain 모두* 를 변환해야 가능. 그래서:

- **suspend 함수는 suspend 함수만 호출 가능** (또는 일반 함수)
- **일반 함수는 suspend 함수 직접 호출 불가** — `runBlocking { ... }` 같은 builder 필요
- `runBlocking` 은 현재 스레드를 *block* 하면서 coroutine 실행 — 테스트와 main 진입점에서만 권장

```kotlin
fun main() = runBlocking {            // suspend 진입점
    val result = fetchUser(1)
    println(result)
}
```

## context preservation — withContext

```kotlin
suspend fun process() {
    val data = withContext(Dispatchers.IO) {   // 풀 변경
        readFile()
    }
    val parsed = withContext(Dispatchers.Default) {
        parse(data)
    }
}
```

- `withContext` 는 *동일 coroutine 안에서* dispatcher (또는 다른 context element) 를 변경
- 새 coroutine 안 만듦 → 부모 자식 관계 안 생김 → 가벼움

## 취소 (Cancellation)

coroutine 의 cancellation 은 **협력적**. suspend 함수가 자동으로 `CancellationException` 을 throw 하지만, **CPU bound 코드는 `yield()` 또는 `ensureActive()` 명시 호출** 필요.

```kotlin
val job = scope.launch {
    while (isActive) {                // 또는 ensureActive()
        heavyCompute()
        yield()                       // suspend 지점 — cancel 시 여기서 throw
    }
}
delay(100)
job.cancel()                          // 신호만 보냄
job.join()                            // 진짜 끝날 때까지 대기
// 또는 job.cancelAndJoin()
```

`CancellationException` 은 *정상 종료* 로 간주 — 부모 coroutine 에 전파되지 않음 (다른 예외와 다름).

## `try-finally` 안의 suspend 호출 주의

```kotlin
launch {
    try {
        doWork()
    } finally {
        cleanup()       // ❌ cancel 후엔 cancel 상태에선 suspend 안 됨
    }
}
```

cancel 후 `finally` 안에서 suspend 호출하면 *즉시* `CancellationException` throw. cleanup 하려면 `withContext(NonCancellable)` 로 wrap.

```kotlin
finally {
    withContext(NonCancellable) {
        cleanup()       // cancel 무시하고 진행
    }
}
```

## msa 코드 사례

```kotlin
// quant/NotificationDispatcher.kt:55
private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

@PostConstruct
fun start() {
    job = scope.launch {
        while (isActive) {
            try {
                val item = queue.dequeue()        // suspend
                sender.send(item)                  // suspend
            } catch (ce: CancellationException) {
                throw ce                           // 반드시 rethrow!
            } catch (ex: Exception) {
                log.error(ex) { "loop error" }    // 일반 예외만 흡수
            }
        }
    }
}

@PreDestroy
fun stop() {
    runCatching { job?.cancel() }
    runCatching { scope.cancel() }
}
```

좋은 패턴:
- `SupervisorJob` — 자식 한 명 실패가 다른 자식에 전파 안 됨
- `isActive` 체크 + `CancellationException` rethrow + 일반 예외 흡수
- PreDestroy 에서 명시적 scope cancel → graceful shutdown

```kotlin
// quant/ClickHouseAuditLogPublisher.kt:64
override suspend fun publish(event: AuditEvent) {
    val mutex = tenantLocks.computeIfAbsent(event.tenantId) { Mutex() }
    mutex.withLock {                          // suspend 락
        // ...
        withContext(Dispatchers.IO) {         // JDBC blocking IO 분리
            insertRow(...)
        }
    }
}
```

`Mutex` 는 coroutine 친화적 락 — `synchronized` 와 달리 suspend 가능. JDBC 같은 blocking IO 는 `Dispatchers.IO` 로 명시 dispatch.

## 면접 단골

**Q. coroutine 이 어떻게 스레드를 점유 안 하나?**

컴파일러가 suspend 함수를 state machine 으로 변환. 각 suspension point 에서 함수가 `COROUTINE_SUSPENDED` 를 반환하면서 *호출 chain 전체가 즉시 return* → 스레드 풀려남. 나중에 `Continuation.resumeWith()` 가 호출되면 같은 함수에 재진입해서 저장된 label 부터 다시 실행. 그래서 한 스레드가 수천 개의 coroutine 을 *번갈아* 처리할 수 있다.

**Q. `suspend` 키워드의 정확한 의미?**

"이 함수는 *중단 가능* 하다" 는 컴파일러 신호. 컴파일러가 (1) Continuation 파라미터 추가, (2) state machine 으로 변환. suspend 자체가 비동기를 만드는 게 아니라, suspend 함수가 *안에서* `delay`, `withContext`, callback wrap 등을 호출할 때 진짜 suspension 발생. 일반 코드만 있으면 즉시 반환.

**Q. `launch` 와 `async` 차이?**

`launch` 는 결과 없음 (`Job` 반환), fire-and-forget. `async` 는 결과 있음 (`Deferred<T>`), `await()` 로 받음 → CompletableFuture 와 가장 가까운 모델. 둘 다 새 coroutine 시작. 결과 안 쓸 거면 `launch`.

**Q. `runBlocking` 을 production 에서 쓰면?**

현재 스레드를 *block* 시켜 coroutine 진입. 테스트/main 진입점에선 OK 지만, 일반 서비스 코드에서 쓰면 호출 스레드 (예: HTTP worker) 가 막혀서 풀 고갈 위험. Spring Controller 안에서 `runBlocking` 도 같은 문제. 대신 `suspend fun` 으로 controller 를 선언하거나 `@Async` + coroutine builder 조합. `quant` 의 `LazyReencryptionJob.runOnce` 는 1분 1회 background 잡이라 OK.

**Q. coroutine 의 cancellation 이 협력적이라는 의미?**

cancel 호출은 *플래그만* 세팅. suspend 함수들이 자동으로 `CancellationException` throw 하지만 CPU bound 루프는 명시적 `yield()` 또는 `ensureActive()` 안 부르면 영원히 진행. 그래서 long-running compute 안엔 협력 지점을 박아넣어야 한다. 이는 자바 `Thread.interrupt` 와 비슷하지만 coroutine 은 *언어 차원* 에서 `Cancellation Exception` 을 throw 한다는 점이 다르다.

## 다음 학습

- [15-flow-channel.md](15-flow-channel.md) — Flow 와 Channel
- [16-structured-concurrency.md](16-structured-concurrency.md) — Job 트리
- [17-virtual-threads.md](17-virtual-threads.md) — VT vs coroutine
