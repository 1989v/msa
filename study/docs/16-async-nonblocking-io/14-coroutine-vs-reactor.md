---
parent: 16-async-nonblocking-io
seq: 14
title: Kotlin Coroutine vs Reactor 비교
type: deep
created: 2026-05-01
---

# 14. Kotlin Coroutine vs Reactor 비교

## TL;DR

- **Coroutine** = 컴파일러가 만든 *continuation 기반 비동기* — `suspend` 함수가 핵심
- **Reactor** = Reactive Streams 의 Publisher (Mono/Flux) — operator 기반
- IO 모델은 *둘 다 동일* (분면 3, 같은 Selector/EventLoop 위에서 동작)
- 차이는 **표현력 / 디버깅 / 학습 비용**
- Coroutine 의 코드는 *imperative* 하게 보임 → 디버깅 용이, 직관적
- Reactor 는 operator chain 으로 *복잡한 흐름 제어* (retry / timeout / fallback / parallel) 가 자연스러움
- 두 진영 통합 라이브러리: **kotlinx-coroutines-reactor** (`awaitSingle`, `mono { }`, `asFlow()`)
- 우리 msa 의 `order/ProductAdapter` 가 두 진영 다리 패턴

---

## 1. Coroutine 의 본질 — Continuation Passing

`suspend` 함수는 컴파일러가 *Continuation* 을 받는 일반 함수로 변환한다.

```kotlin
suspend fun fetchUser(id: Long): User { ... }
```

컴파일 후 (대략):

```java
Object fetchUser(long id, Continuation<User> continuation) {
    // 1) state 0: 시작
    // 2) IO 호출 → 결과 받으면 continuation.resume(user)
    // 3) suspend 시점엔 즉시 리턴, JVM thread 는 free
}
```

핵심:
- *suspend 점* 마다 함수가 끊어짐 (state machine)
- 끊어진 후 JVM thread 는 자유 → 다른 coroutine 실행
- 결과가 오면 *임의의 thread* 에서 resume

이게 [02 글](02-io-stages-and-models.md) 의 분면 (3) sync non-blocking IO 위에서 *프로그래밍 모델만* 비동기로 보이게 한다. **실제 IO 는 동일한 epoll Selector**.

---

## 2. Reactor 의 본질 — Operator Chain

Mono / Flux 는 *immutable 그래프*. subscribe 시 위에서 아래로 신호가 흐름.

```kotlin
Mono.fromCallable { fetchUser() }       // assembly
    .map { it.toDto() }                  // assembly
    .flatMap { saveAudit(it) }           // assembly
    .subscribe()                          // execution
```

[10 글](10-project-reactor.md) 에서 다룬 그대로. 핵심: *체인을 만들고 subscribe 가 켜야 흐름*.

---

## 3. 같은 일, 두 가지 표현

### Reactor

```kotlin
fun getUser(id: Long): Mono<User> =
    userRepo.findById(id)
        .flatMap { user ->
            orderClient.findOrders(user.id)
                .map { orders -> user.copy(orders = orders) }
        }
        .timeout(Duration.ofSeconds(2))
        .onErrorResume { Mono.just(User.empty()) }
```

### Coroutine

```kotlin
suspend fun getUser(id: Long): User {
    val user = userRepo.findById(id).awaitSingle()
    val orders = withTimeout(2000) { orderClient.findOrders(user.id) }
    return user.copy(orders = orders)
} catch (e: Exception) {
    User.empty()
}
```

같은 일. Coroutine 이 *읽기 쉽고 디버깅 친화적*. Reactor 가 *operator 조립이 강력*.

---

## 4. 표현력 비교

### (a) Sequential composition

| | Reactor | Coroutine |
|---|---|---|
| 코드 | `mono.flatMap { ... }` | `val x = mono.awaitSingle(); ...` |
| 평가 | Coroutine 승 (직관적) |

### (b) Parallel composition (fan-out)

```kotlin
// Reactor
Mono.zip(fetchA(), fetchB(), fetchC()) { a, b, c -> Triple(a, b, c) }
```

```kotlin
// Coroutine
coroutineScope {
    val a = async { fetchA() }
    val b = async { fetchB() }
    val c = async { fetchC() }
    Triple(a.await(), b.await(), c.await())
}
```

비등. 둘 다 자연스러움.

### (c) Retry / Timeout / Fallback

```kotlin
// Reactor
fetchUser()
    .timeout(Duration.ofSeconds(2))
    .retry(3)
    .onErrorResume { Mono.just(default()) }
```

```kotlin
// Coroutine
suspend fun safe(): User {
    repeat(3) { attempt ->
        try {
            return withTimeout(2000) { fetchUser() }
        } catch (e: Exception) {
            if (attempt == 2) return default()
        }
    }
    return default()
}
```

**Reactor 승** — operator 가 더 짧고 의도가 명확. retry 정책 (exponential backoff 등) 도 `.retryWhen(Retry.backoff(...))` 로 단정.

### (d) Streaming

```kotlin
// Reactor
Flux.fromIterable(ids).flatMap { fetchOne(it) }
```

```kotlin
// Coroutine
flow {
    ids.forEach { emit(fetchOne(it)) }
}
```

비등. Coroutine Flow 가 backpressure 도 자동.

### (e) Backpressure

| | Reactor | Coroutine |
|---|---|---|
| 메커니즘 | `request(n)` + onBackpressureXxx | suspend 자체 |
| 명시 필요 | `limitRate(n)`, `onBackpressureBuffer` | `flow.buffer(64)`, `conflate()` |
| 제어성 | 더 정교 (4 가지 전략) | 단순 |

---

## 5. 디버깅 비교

### Reactor 의 stack trace

```
java.lang.RuntimeException: oops
  at reactor.core.publisher.Mono$$Lambda$...
  at reactor.core.publisher.MonoMap.subscribe...
  at reactor.core.publisher.Operators.complete...
  at reactor.core.publisher.MonoFlatMap.subscribe...
  ... (사용자 코드 거의 안 보임)
```

→ 보강: `Hooks.onOperatorDebug()` 또는 `.checkpoint("location")`. 그래도 코드 라인 매핑은 약함.

### Coroutine 의 stack trace

```
java.lang.RuntimeException: oops
  at com.kgd.product.service.ProductService$fetchUser$1.invokeSuspend(ProductService.kt:42)
  at com.kgd.product.service.ProductService.getUser(ProductService.kt:23)
  ...
```

→ 사용자 코드 라인이 그대로. `kotlinx-coroutines-debug` 활성화 시 더 풍부.

**Coroutine 승** — production 사고 분석 시간 절약.

---

## 6. 학습 비용

| | Reactor | Coroutine |
|---|---|---|
| 개념 수 | 많음 (Cold/Hot, assembly/subscription, operator 100+, Schedulers, Context) | 적음 (suspend, scope, dispatcher) |
| 진입 장벽 | 가파름 | 평이 |
| 함정 | block(), subscribe() 누락, ThreadLocal | dispatcher 누락, runBlocking 오용 |

팀 운영 관점에선 Coroutine 이 *교육 비용 낮음*.

---

## 7. 두 진영의 다리 — kotlinx-coroutines-reactor

`org.jetbrains.kotlinx:kotlinx-coroutines-reactor` 라이브러리.

### Mono → suspend

```kotlin
import kotlinx.coroutines.reactor.awaitSingle
import kotlinx.coroutines.reactor.awaitSingleOrNull

suspend fun fetchUser(id: Long): User =
    userRepo.findById(id).awaitSingle()  // Mono<User> → User

suspend fun fetchUserOrNull(id: Long): User? =
    userRepo.findById(id).awaitSingleOrNull()
```

### suspend → Mono

```kotlin
import kotlinx.coroutines.reactor.mono

fun userMono(id: Long): Mono<User> = mono {
    fetchUserSuspend(id)  // suspend 함수 호출
}
```

### Flux → Flow

```kotlin
import kotlinx.coroutines.reactive.asFlow

val flow: Flow<User> = userRepo.findAll().asFlow()
```

### Flow → Flux

```kotlin
import kotlinx.coroutines.reactor.asFlux

val flux: Flux<User> = flow.asFlux()
```

---

## 8. msa 의 실제 패턴

`order/app/src/main/kotlin/com/kgd/order/client/ProductAdapter.kt` 발췌:

```kotlin
override suspend fun validateProduct(productId: Long): ProductInfo {
    return circuitBreaker.executeSuspendFunction {
        try {
            val response = webClient.get()
                .uri("/api/products/{id}", productId)
                .retrieve()
                .bodyToMono(ProductApiResponse::class.java)
                .awaitSingle()
            // ...
        }
    }
}
```

분석:
- WebClient 자체는 Reactor 기반 (Mono 리턴)
- 호출자 (Order 도메인) 는 *suspend* 로 받음
- `.awaitSingle()` 이 다리
- Circuit Breaker 는 `executeSuspendFunction` 으로 suspend 친화적 wrapping

이 패턴이 우리 msa 의 표준. **아래 layer (HTTP 호출) 는 Reactor, 위 layer (도메인 / 비즈니스) 는 suspend**.

---

## 9. 트레이드오프 표

| 항목 | Reactor | Coroutine |
|---|---|---|
| **표현력** | operator 풍부, 복잡 흐름 강함 | imperative, 직관적 |
| **디버깅** | 어려움 (operator hop) | 쉬움 (그대로 stack trace) |
| **학습 비용** | 높음 | 낮음 |
| **Spring 통합** | 1급 시민 (WebFlux) | 1급 시민 (kotlinx-reactor) |
| **Backpressure** | 정교 | 자동 (suspend) |
| **메모리** | 객체 그래프 | continuation object |
| **JVM thread** | EventLoop / Schedulers | Dispatchers.Default 등 |
| **Java 호환** | Java 에서 그대로 사용 | suspend 는 Java 에서 어색 |
| **스트리밍** | Flux | Flow |

---

## 10. Virtual Threads + Coroutine = ?

JDK 21 의 VT 와 Coroutine 의 관계:

- VT 와 Coroutine 은 *서로 다른 추상화 레벨*
- VT = JVM 차원의 가벼운 thread
- Coroutine = 언어 차원의 suspend
- 공존 가능: Coroutine 의 dispatcher 를 VT executor 로 설정

```kotlin
val vtDispatcher = Executors.newVirtualThreadPerTaskExecutor()
    .asCoroutineDispatcher()

withContext(vtDispatcher) {
    // suspend 함수가 VT 위에서 실행
    fetchUser(id)
}
```

**그러나 굳이 같이 쓸 이유는 거의 없음**. VT 만 써도 같은 효과 + 더 단순.

> 우리 msa 의 order 가 coroutine 사용 중인데, VT 활성화 후 *기존 suspend 를 점진적으로 일반 함수로 단순화* 가능. ADR 검토 사항.

---

## 11. 면접 답변 템플릿

**Q. Reactor 와 Kotlin Coroutine 의 차이는?**

> "본질적인 IO 모델은 같습니다 — 둘 다 분면 (3) sync non-blocking, Selector/EventLoop 위에서 동작합니다. 차이는 *프로그래밍 모델*:
>
> - **Reactor** 는 Mono/Flux 라는 Publisher 그래프를 *조립* 해서 subscribe 시점에 실행. operator (map/flatMap/zip/timeout/retry/onErrorResume) 가 풍부해서 *복잡한 흐름 제어* 에 강함.
> - **Coroutine** 은 `suspend` 함수가 컴파일러에 의해 continuation 받는 일반 함수로 변환. 코드가 *imperative* 하게 보여서 디버깅 / 가독성 / 학습 비용이 좋음.
>
> 둘은 `kotlinx-coroutines-reactor` 로 다리를 놓을 수 있습니다 (`awaitSingle`, `mono { }`, `asFlow()`). 우리 msa 도 *아래 layer 는 Reactor (WebClient), 위 layer 는 suspend* 로 섞어 씁니다.
>
> JDK 21 의 Virtual Threads 가 등장하면서 두 진영 모두 *대체 가능* 해졌습니다 — VT + 일반 imperative 코드가 같은 throughput 에 더 단순. 다만 reactive 의 *operator chain* 표현력은 여전히 의미 있어서 복잡한 retry / fallback / circuit breaker 조합엔 Reactor 가 좋습니다."

---

## 12. 핵심 포인트

- IO 모델은 둘 다 분면 (3), Selector 위에서 동작 — 같음
- 프로그래밍 모델 차이만:
  - Reactor: operator chain, 복잡 흐름 강함, 디버깅 어려움
  - Coroutine: suspend, imperative, 디버깅 쉬움
- `kotlinx-coroutines-reactor` 가 다리 — `awaitSingle`, `mono { }`
- 우리 msa: WebClient(Reactor) → suspend(Coroutine) 로 다리
- VT 가 둘 다 단순화 가능

## 다음 학습

- [15-msa-gateway-webflux.md](15-msa-gateway-webflux.md) — msa Gateway 의 WebFlux 사용 분석
