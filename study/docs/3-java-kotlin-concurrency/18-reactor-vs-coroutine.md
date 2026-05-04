---
parent: 3-java-kotlin-concurrency
seq: 18
title: Reactor vs Coroutine — 비교와 선택
type: deep
created: 2026-05-01
---

# 18. Reactor vs Coroutine

## 핵심 한 줄

**Reactor (Mono/Flux)** = 함수형 reactive stream, push-based + 명시적 backpressure, JVM 표준. **Coroutine (Flow/suspend)** = 언어 차원의 가벼운 비동기, 직선 코드, Kotlin 전용. msa 의 gateway (WebFlux) 는 Reactor, 일반 서비스는 coroutine. 이유는 framework 의존이지 우열이 아니다.

## 패러다임 비교

```kotlin
// Reactor — 함수형 체인
fun fetchUser(id: Long): Mono<User> {
    return webClient.get().uri("/users/$id").retrieve().bodyToMono<UserDto>()
        .flatMap { dto -> webClient.get().uri("/profile/${dto.id}").retrieve().bodyToMono<Profile>() }
        .map { profile -> User(profile) }
        .timeout(Duration.ofSeconds(5))
        .onErrorResume { Mono.just(User.empty()) }
}

// Coroutine — 직선 코드
suspend fun fetchUser(id: Long): User {
    return try {
        withTimeout(5_000) {
            val dto = userClient.fetch(id)
            val profile = profileClient.fetch(dto.id)
            User(profile)
        }
    } catch (e: TimeoutCancellationException) {
        User.empty()
    }
}
```

→ 코드의 *형태* 가 다름. Reactor 는 builder pattern, coroutine 은 일반 imperative.

## 핵심 차이 매트릭스

| 측면 | Reactor | Coroutine |
|---|---|---|
| 언어 | Java/Kotlin 모두 | Kotlin 전용 (Java compatibility 일부) |
| 단위 | `Mono<T>` (1개), `Flux<T>` (N개) | `suspend fun`, `Flow<T>` |
| 구성 | flatMap/map 체인 | 직선 코드 + suspend |
| Cold/Hot | Mono/Flux 기본 cold (subscribe 시 실행) | Flow cold, Channel/SharedFlow hot |
| Backpressure | 명시적 request(n) | suspend 자연 (emit suspend) |
| 학습 곡선 | 높음 (operator 100+ 개) | 낮음~중간 |
| 가독성 | 익숙하면 표현력 강 | 초심자도 읽기 쉬움 |
| Stack trace | 끔찍함 (Reactor frames 많음) | 일반적 (Reactor 보다 좋음) |
| Cancellation | `dispose()` / Subscription | `Job.cancel()` + 협력적 |
| Context | Reactor Context (immutable) | CoroutineContext (immutable) |
| Thread 모델 | event loop (Netty) — non-blocking 강제 | dispatcher 선택, blocking 가능 (with care) |
| Spring 통합 | WebFlux, R2DBC | Spring 6.1+ coroutine 지원 (`suspend` controller) |

## Cold vs Hot

### Reactor

```kotlin
val cold: Flux<Int> = Flux.just(1, 2, 3)   // cold
cold.subscribe { println(it) }              // 1, 2, 3
cold.subscribe { println(it) }              // 1, 2, 3 (다시 처음부터)

val sink = Sinks.many().multicast().onBackpressureBuffer<Int>()  // hot
val hot = sink.asFlux()
sink.tryEmitNext(1)
hot.subscribe { ... }                       // 늦으면 1 못 받음
sink.tryEmitNext(2)                         // 받음
```

### Coroutine

```kotlin
val cold: Flow<Int> = flow { emit(1); emit(2); emit(3) }   // cold
cold.collect { println(it) }                 // 1, 2, 3
cold.collect { println(it) }                 // 1, 2, 3 (다시 처음부터)

val hot = MutableSharedFlow<Int>()           // hot
hot.emit(1)                                  // subscriber 없으면 lost
hot.subscribe { ... }
hot.emit(2)                                  // 받음
```

→ 모델은 거의 동일. 이름과 API 만 다름.

## Backpressure

### Reactor — 명시적

```kotlin
flux.subscribe(object : BaseSubscriber<Int>() {
    override fun hookOnSubscribe(s: Subscription) {
        request(10)        // 처음 10개
    }
    override fun hookOnNext(value: Int) {
        process(value)
        if (every10) request(10)
    }
})

// 또는 onBackpressureXxx
flux.onBackpressureDrop()             // overflow 시 drop
flux.onBackpressureBuffer(1000)        // buffer
flux.onBackpressureLatest()            // 가장 최근만
```

### Coroutine — 자연

```kotlin
flow.collect { item ->
    process(item)         // process 가 느리면 emit 도 자동 suspend
}

// 명시적 buffer
flow
    .buffer(100)           // upstream/downstream 분리
    .collect { ... }
```

`emit` 이 suspend 함수라 downstream 이 *처리 못 하면 자동 suspend* → 자연스러운 backpressure. 별도 신호 없이.

## Spring 통합

### WebFlux (Reactor)

```kotlin
@RestController
class UserController(private val userService: UserService) {

    @GetMapping("/users/{id}")
    fun get(@PathVariable id: Long): Mono<User> {
        return userService.fetch(id)
    }

    @GetMapping("/users")
    fun list(): Flux<User> {
        return userService.list()
    }
}
```

### MVC + suspend (Spring 6.1+)

```kotlin
@RestController
class UserController(private val userService: UserService) {

    @GetMapping("/users/{id}")
    suspend fun get(@PathVariable id: Long): User {
        return userService.fetch(id)
    }

    @GetMapping("/users")
    fun list(): Flow<User> {       // streaming response
        return userService.listFlow()
    }
}
```

→ Spring MVC + suspend 지원. WebFlux 가 아니어도 OK.

## 상호운용

```kotlin
// Mono → suspend
suspend fun foo() {
    val user: User = userMono.awaitSingle()       // kotlinx-coroutines-reactor
}

// suspend → Mono
fun fooMono(): Mono<User> = mono {                 // builder
    fetchUserSuspend()
}

// Flux → Flow
val flow: Flow<Int> = flux.asFlow()

// Flow → Flux
val flux: Flux<Int> = flow.asFlux()
```

`kotlinx-coroutines-reactor` 라이브러리가 양방향 변환 제공. msa 처럼 일부는 Reactor (gateway), 일부는 coroutine 인 환경에서 유용.

## msa 의 선택

### gateway → Reactor (WebFlux)
- Spring Cloud Gateway 가 WebFlux 기반 (필수)
- Netty event loop, non-blocking 강제
- 다운스트림 호출 (`webClient.get()...`) 도 Reactor

### 일반 서비스 → MVC + coroutine
- Spring MVC + Kotlin
- coroutine 으로 외부 IO (Input/Output, 입출력) 처리 (e.g., `quant`)
- Spring MVC 의 일반 controller + `suspend fun` 조합 가능

### 왜 일반 서비스에 WebFlux 안 썼나?
- 학습 곡선 + 디버깅 어려움
- JPA blocking → Reactor 와 안 맞음 (R2DBC 가 답이지만 생태계 좁음)
- coroutine + JDBC + `Dispatchers.IO` 조합이 *충분히 빠르고* 가독성 좋음

> **ADR-0002** (Architecture Decision Record, 아키텍처 결정 기록 — msa 런타임 결정): MVC + JPA blocking + Coroutine 외부 IO + Tomcat 가상 스레드. 정확히 이 트레이드오프를 명시.

## stack trace 비교

### Reactor

```
java.lang.RuntimeException: oops
    at com.kgd.foo.UserService.fetch(UserService.kt:42)
    at reactor.core.publisher.MonoFlatMap$FlatMapMain.onNext(MonoFlatMap.java:144)
    at reactor.core.publisher.FluxMap$MapSubscriber.onNext(FluxMap.java:122)
    at reactor.core.publisher.MonoSubscribeOn$SubscribeOnSubscriber.run(MonoSubscribeOn.java:130)
    at reactor.core.scheduler.WorkerTask.call(WorkerTask.java:84)
    at reactor.core.scheduler.WorkerTask.call(WorkerTask.java:37)
    at java.base/java.util.concurrent.FutureTask.run(FutureTask.java:317)
    ... 원본 호출 chain 거의 안 보임
```

→ `Hooks.onOperatorDebug()` 또는 `checkpoint()` 사용 시 일부 보강. 하지만 여전히 어렵.

### Coroutine

```
java.lang.RuntimeException: oops
    at com.kgd.foo.UserService.fetch(UserService.kt:42)
    at com.kgd.foo.UserController.get(UserController.kt:18)
    at com.kgd.foo.UserController$get$1.invokeSuspend(UserController.kt:0)
    ... DispatcherInvocation 등
```

→ 일반 stack trace 와 비슷. `kotlinx-coroutines-debug` 의 `DebugProbes.install()` 로 더 보강 가능.

## 성능

비교 어렵지만 일반적으로:
- 단순 echo → Reactor 가 *약간* 빠름 (event loop 의 efficiency)
- 복잡한 chain → 차이 거의 없음
- coroutine + VT 조합 → Reactor 동급 또는 우위 (JDK 25)

성능보다 *유지보수성과 학습 비용* 이 선택의 우선 기준.

## 면접 단골

**Q. Reactor 와 Coroutine 의 본질적 차이?**

Reactor 는 *함수형 reactive stream* — 데이터 흐름을 builder pattern 으로 조립, push-based 에 명시적 backpressure. Coroutine 은 *언어 차원의 비동기* — `suspend` 키워드로 마킹된 함수가 컴파일러에 의해 state machine 으로 변환, 직선 imperative 코드 유지. 같은 비동기 문제를 패러다임이 다르게 푼다.

**Q. WebFlux 를 쓸지 MVC + coroutine 을 쓸지?**

(1) Spring Cloud Gateway / API Gateway → WebFlux 강제. (2) 외부 의존성 (Reactor 기반 라이브러리, R2DBC) → WebFlux 자연. (3) JPA + blocking IO + 학습 비용 우려 → MVC + coroutine. msa 처럼 gateway 만 WebFlux 인 게 흔한 절충안.

**Q. coroutine 의 backpressure 가 자연스럽다는 의미?**

`emit` 이 suspend 함수라 downstream 이 처리 못 하면 자동 suspend → upstream 도 멈춤. 별도 request(n) 신호 없이 자연스러운 backpressure. Reactor 는 명시적 신호 + 다양한 onBackpressureXxx 정책. coroutine 이 단순하고, Reactor 가 finer control 가능.

**Q. Mono 와 Deferred (Coroutine) 비교?**

둘 다 단일 결과의 비동기 표현. Mono 는 cold (subscribe 시 실행), Deferred 는 *생성 즉시 실행* (async 빌더 호출 시). Mono 는 builder chain, Deferred 는 await 으로 직선. 호환성: `mono.awaitSingle()` 또는 `deferred.toMono()` 변환 가능.

**Q. Reactor 의 stack trace 가 어려운 이유?**

operator chain 이 내부적으로 operator 객체들의 next/onComplete 호출 stack 으로 변환되어, 원본 코드 흐름이 가려진다. `Hooks.onOperatorDebug()` 또는 `checkpoint()` 로 부분 보강 가능하지만 여전히 익숙해지는 데 시간이 걸린다. coroutine 은 일반 함수 호출에 가까워서 stack trace 가 직관적.

## 다음 학습

- [22-msa-concurrency-patterns.md](22-msa-concurrency-patterns.md) — msa 코드 점검
- [17-virtual-threads.md](17-virtual-threads.md) — VT 와의 관계
