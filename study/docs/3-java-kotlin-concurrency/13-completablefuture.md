---
parent: 3-java-kotlin-concurrency
seq: 13
title: CompletableFuture 깊게
type: deep
created: 2026-05-01
---

# 13. CompletableFuture

## 핵심 한 줄

`CompletableFuture<T>` 는 Java 의 promise/future 표준. **체이닝 + 조합 + 예외 처리** 가 핵심이고, **`Async` 안 붙은 메서드의 실행 스레드 모호성**과 **`commonPool` 사용 위험** 두 함정이 면접/실무에서 매번 등장.

## 기본 패턴

```kotlin
import java.util.concurrent.CompletableFuture
import java.util.concurrent.Executors

val executor = Executors.newFixedThreadPool(8)

val cf: CompletableFuture<String> = CompletableFuture.supplyAsync({
    fetchUser(userId)
}, executor)

cf.thenApply { user -> user.toUpperCase() }
  .thenAccept { println(it) }
  .exceptionally { e -> log.error(e) { "fail" }; null }
```

## 생성 메서드

| 메서드 | 동작 | executor |
|---|---|---|
| `supplyAsync(Supplier)` | 비동기 실행, 결과 반환 | commonPool (기본) |
| `supplyAsync(Supplier, Executor)` | 동일, executor 명시 | 명시한 것 |
| `runAsync(Runnable)` | 비동기 실행, 결과 없음 (Void) | commonPool |
| `completedFuture(value)` | 이미 완료된 CF | — |
| `failedFuture(throwable)` (Java 9+) | 이미 실패한 CF | — |
| `new CompletableFuture<>()` | 미완료 CF, 외부에서 `complete()` | — |

## 체이닝 메서드

| 메서드 | 입력 | 출력 | 의미 |
|---|---|---|---|
| `thenApply(Function)` | T → R | `CF<R>` | map (sync) |
| `thenAccept(Consumer)` | T → Unit | `CF<Void>` | sink |
| `thenRun(Runnable)` | () → Unit | `CF<Void>` | trigger |
| `thenCompose(Function)` | T → `CF<R>` | `CF<R>` | flatMap (chain) |
| `thenCombine(other, BiFunction)` | (T, U) → R | `CF<R>` | zip (둘 다 끝나야) |
| `applyToEither(other, Function)` | T (먼저 끝난 쪽) → R | `CF<R>` | race |
| `whenComplete(BiConsumer)` | (T, Throwable) → Unit | `CF<T>` | tap |

각 메서드에 **`Async` 변형** 이 존재 (`thenApplyAsync`, `thenComposeAsync` 등).

## ⚠️ `Async` 안 붙은 메서드의 함정

```kotlin
val cf = CompletableFuture.supplyAsync({ heavyCpu() }, executor)
    .thenApply { transform(it) }    // 어느 스레드에서 실행?
    .thenAccept { println(it) }
```

**규칙**:
- 직전 단계가 *이미 완료* 됐으면 → **호출자 스레드** 에서 실행
- 직전 단계가 *아직 실행 중* 이면 → **그 단계를 완료시킨 스레드** 에서 실행

→ "어디서 실행될지 코드만 봐선 모름" — race 같은 비결정성. 그래서 *항상 어디서 실행될지 명확하게* 하려면 **`Async` 변형 + executor 명시**.

```kotlin
val cf = CompletableFuture.supplyAsync({ heavyCpu() }, cpuPool)
    .thenApplyAsync({ transform(it) }, cpuPool)        // 명시
    .thenAcceptAsync({ println(it) }, eventLoopPool)   // 명시
```

## ⚠️ `commonPool` 사용 위험

`Async` 메서드에 executor 안 주면 `ForkJoinPool.commonPool()` 사용. ([07-executor-threadpool.md](07-executor-threadpool.md) 참조)

- 컨테이너 환경 cgroup 인식 부정확
- 한 곳의 blocking IO 가 commonPool 전체 영향
- 다른 라이브러리 (`parallelStream` 등) 와 풀 공유

→ **production 코드는 항상 명시적 executor**.

```kotlin
// ❌ commonPool 위험
CompletableFuture.supplyAsync { httpCall() }

// ✅ 명시
CompletableFuture.supplyAsync({ httpCall() }, httpExecutor)
```

## 예외 처리

### `exceptionally`

```kotlin
cf.exceptionally { e ->
    log.error(e) { "fallback" }
    DEFAULT_VALUE
}
```

- throwable 받아서 fallback 값 반환
- 정상 경로에선 호출 안 됨

### `handle` — 정상 + 예외 동시 처리

```kotlin
cf.handle { result, throwable ->
    if (throwable != null) DEFAULT_VALUE
    else transform(result)
}
```

### `whenComplete` — side effect

```kotlin
cf.whenComplete { result, throwable ->
    if (throwable != null) log.error(throwable) { "err" }
    else log.info { "ok: $result" }
}
```

- 결과는 변형 안 함 (CF 의 값 유지). 로깅/메트릭 같은 side effect 만.

### Async 체인의 예외 전파

체인 어딘가 예외가 발생하면 **이후 단계 모두 skip**, 마지막 `exceptionally`/`handle` 까지 전달.

```kotlin
cf.thenApply { it * 2 }              // (1) skip
  .thenApply { it + 1 }              // (2) skip
  .exceptionally { _ -> 0 }          // (3) 여기서 처리
```

→ Try/catch 처럼 chain 끝부분에 fallback 두면 단순.

### `CompletionException` wrapping

체인 중간의 예외는 `get()` 호출 시 `ExecutionException` 으로, 다른 체이닝 메서드에선 `CompletionException` 으로 wrap.

```kotlin
try {
    cf.get()
} catch (e: ExecutionException) {
    val cause = e.cause   // 원본 예외
}

cf.exceptionally { e ->
    // e 가 CompletionException 이라면 e.cause 가 원본
    val original = if (e is CompletionException) e.cause else e
    handle(original)
}
```

## 조합 — 여러 CF 동시

### `allOf` — 다 끝날 때까지

```kotlin
val futures: List<CompletableFuture<User>> = userIds.map { id ->
    CompletableFuture.supplyAsync({ fetchUser(id) }, executor)
}

val all: CompletableFuture<Void> = CompletableFuture.allOf(*futures.toTypedArray())
val result: CompletableFuture<List<User>> = all.thenApply {
    futures.map { it.join() }   // 모두 끝났으니 join 안 막힘
}
```

### `anyOf` — 누구든 먼저 끝나면

```kotlin
val any: CompletableFuture<Any> = CompletableFuture.anyOf(*futures.toTypedArray())
any.thenAccept { firstResult -> println(firstResult) }
```

→ HTTP 다중 endpoint 중 가장 빠른 응답 사용 패턴 (hedged request).

### `thenCombine` — 두 개 zip

```kotlin
val a: CompletableFuture<User> = fetchUserAsync(id)
val b: CompletableFuture<Order> = fetchOrderAsync(id)

val combined = a.thenCombine(b) { user, order ->
    UserOrder(user, order)
}
```

## `thenCompose` vs `thenApply`

```kotlin
// thenApply: T → R (sync transform)
cf.thenApply { user -> user.name }   // CF<String>

// thenCompose: T → CF<R> (chain async)
cf.thenCompose { user ->             // user 받아서 다른 비동기 호출
    fetchOrdersAsync(user.id)        // CF<List<Order>>
}                                     // 결과: CF<List<Order>>, 중첩 X
```

→ flatMap 패턴. `thenApply` 쓰면 `CF<CF<R>>` 이중 wrapping 됨.

## 직접 complete

```kotlin
val cf = CompletableFuture<String>()

// 다른 스레드에서
Thread {
    Thread.sleep(100)
    cf.complete("hello")    // 완료
    // 또는 cf.completeExceptionally(SomeException())
}.start()

cf.thenAccept { println(it) }
```

→ 외부 콜백 (e.g., Netty handler, websocket) 을 future 로 wrap 할 때.

## 시간 제한

```kotlin
cf.orTimeout(5, TimeUnit.SECONDS)              // Java 9+, timeout 시 TimeoutException
  .completeOnTimeout(DEFAULT, 5, TimeUnit.SECONDS)  // timeout 시 default 값
```

내부적으로 `ScheduledExecutorService` 사용.

## CompletableFuture 와 Reactor / Coroutine

| 측면 | CompletableFuture | Reactor (Mono/Flux) | Coroutine |
|---|---|---|---|
| 단위 | 단일 결과 | 0..N stream | suspend function |
| 호출 | `thenXxx` 체인 | `flatMap`, `map` 체인 | 시퀀셜 코드 |
| backpressure | 없음 | 내장 (request/cancel) | suspend 자연 |
| cancel | `cancel(true)` interrupt | dispose | structured + Job |
| 가독성 | 중간 | 함수형 | 가장 좋음 (직선) |

→ Java 만 쓸 거면 CF 가 표준. Spring WebFlux 면 Reactor. Kotlin + 일반 MVC 면 coroutine 으로 가는 게 가장 깔끔.

## msa 코드 사용 검색

```bash
$ grep -rn "CompletableFuture" --include="*.kt" /Users/gideok-kwon/IdeaProjects/msa | grep -v test/
# 거의 없음 — search 의 EsBulkDocumentProcessor 정도
```

msa 는 Kotlin coroutine + Spring MVC 조합이라 CF 직접 사용은 적다. Spring 프레임워크 *내부* 가 CF 쓰지만 (e.g., `@Async` 메서드의 반환 타입) 애플리케이션 코드는 거의 항상 coroutine 으로 우회.

`Kafka KafkaTemplate.send()` 가 `CompletableFuture<SendResult>` 반환 (Spring Kafka 3.0+) — outbox relay 등에서 등장 가능.

```kotlin
// outbox relay 의 send (가상 점검)
val futures = batch.map { msg ->
    kafkaTemplate.send(msg.topic, msg.key, msg.value)
}
CompletableFuture.allOf(*futures.toTypedArray())
    .orTimeout(5, TimeUnit.SECONDS)
    .whenComplete { _, ex ->
        if (ex != null) metrics.outboxSendFailed()
        else metrics.outboxSendOk(batch.size)
    }
```

## 면접 단골

**Q. `thenApply` 와 `thenApplyAsync` 차이?**

`thenApply` 는 직전 stage 가 이미 끝났으면 *호출자 스레드*, 아니면 *직전을 끝낸 스레드* 에서 실행 — 비결정적. `thenApplyAsync` 는 항상 (default `commonPool` 또는 명시한) executor 에서 실행. production 코드에선 *항상 Async + 명시 executor* 가 정공법, blocking IO 가 호출자 (web worker 같은) 를 막지 않게.

**Q. `thenCompose` 와 `thenApply` 차이?**

`thenApply` 는 sync transform (T → R). 반환값이 CF 면 `CF<CF<R>>` 이중 wrap. `thenCompose` 는 *flatMap* — 람다가 CF 를 반환하고, 결과는 안에 있는 CF 가 unwrap 된 형태. 비동기 chaining 에 필수.

**Q. `commonPool` 위험성?**

ForkJoinPool.commonPool 은 `Runtime.availableProcessors() - 1` 크기. 컨테이너 cgroup 인식 부정확, 다른 라이브러리 (parallelStream 등) 와 공유, blocking IO 가 들어가면 시스템 전체 영향. CompletableFuture 의 `xxxAsync` 메서드에 executor 안 주면 commonPool 사용. production 에선 무조건 명시 executor.

**Q. `CompletableFuture` 의 cancel 이 `Future.cancel` 과 어떻게 다른가?**

`CompletableFuture.cancel(true)` 는 `interrupt` 신호를 *전파 안 함*. 단지 future 자체를 `CancellationException` 으로 종료시키고 downstream chain 을 중단할 뿐. 실행 중인 task 는 그대로 진행. 그래서 진짜 task 중단 필요하면 `Thread.interrupt()` 또는 task 자체에 cancellation flag 가 필요.

**Q. CF 와 Kotlin coroutine 비교?**

CF 는 thenXxx 체인 → 코드가 함수 callbacks 로 변형되어 가독성 떨어짐. coroutine 은 `suspend` 로 비동기 코드를 *직선으로* 작성 가능, structured concurrency 로 cancellation/scope 관리도 표준화. Kotlin 프로젝트면 coroutine 선택. CF 가 필요한 건 (1) Java 라이브러리 호환, (2) 단순 비동기 wrapping 정도.

## 다음 학습

- [14-coroutine-internals.md](14-coroutine-internals.md) — coroutine 내부
- [18-reactor-vs-coroutine.md](18-reactor-vs-coroutine.md) — Reactor 비교
