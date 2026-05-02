---
parent: 16-async-nonblocking-io
seq: 10
title: Project Reactor — Mono / Flux / Schedulers
type: deep
created: 2026-05-01
---

# 10. Project Reactor — Mono / Flux / Schedulers

## TL;DR

- **Project Reactor** = Reactive Streams 표준의 JVM 구현, Spring WebFlux 의 기본 reactive lib
- **Publisher = Flux (0..N)** / **Mono (0..1)** — cold by default
- **Operator chain 은 두 단계** — assembly time (선언) → subscription time (실행)
- **Schedulers** 4 종 — parallel / boundedElastic / single / immediate
- **연산자 90% 는 publishOn / subscribeOn / map / flatMap / filter / zip / merge** 로 충분
- **Backpressure** 는 [11 글](11-backpressure.md) 에서 별도

---

## 1. Reactive Streams 표준

[Reactive Streams](https://www.reactive-streams.org/) (2015) — Netflix/Pivotal/Red Hat 등이 합의한 4 개 인터페이스.

```java
public interface Publisher<T> {
    void subscribe(Subscriber<? super T> s);
}

public interface Subscriber<T> {
    void onSubscribe(Subscription s);
    void onNext(T t);
    void onError(Throwable t);
    void onComplete();
}

public interface Subscription {
    void request(long n);
    void cancel();
}

public interface Processor<T, R> extends Subscriber<T>, Publisher<R> {}
```

JDK 9 부터 `java.util.concurrent.Flow` 로 표준 진입.

구현체:
- **Project Reactor** (Pivotal) ← Spring WebFlux
- RxJava (Netflix)
- Akka Streams
- Mutiny (Quarkus)

---

## 2. Mono / Flux 기본

### Mono = 0 또는 1 개의 결과

```kotlin
val mono: Mono<String> = Mono.just("hello")
val empty: Mono<String> = Mono.empty()
val error: Mono<String> = Mono.error(RuntimeException("oops"))

// 비동기 결과
val async: Mono<String> = Mono.fromCallable { fetchSomething() }
```

### Flux = 0..N 개의 스트림

```kotlin
val flux: Flux<Int> = Flux.just(1, 2, 3, 4, 5)
val range: Flux<Int> = Flux.range(1, 100)
val interval: Flux<Long> = Flux.interval(Duration.ofSeconds(1))
val fromList: Flux<String> = Flux.fromIterable(listOf("a", "b", "c"))
```

> Mono / Flux 는 **Publisher 인터페이스 구현체**. subscribe() 호출 전엔 *아무 일도 일어나지 않는다.*

---

## 3. Cold vs Hot Publisher

### Cold (default)

각 Subscriber 가 처음부터 새 데이터 스트림.

```kotlin
val cold: Flux<Int> = Flux.range(1, 5)
cold.subscribe { println("A: $it") }  // 1,2,3,4,5
cold.subscribe { println("B: $it") }  // 1,2,3,4,5 — A 와 독립
```

각 subscribe 가 *새 source* 를 만든다.

### Hot

여러 Subscriber 가 *같은 데이터* 를 공유. 늦게 구독하면 이미 흘러간 건 못 봄.

```kotlin
val hot: Flux<Long> = Flux.interval(Duration.ofSeconds(1)).share()
hot.subscribe { println("A: $it") }
Thread.sleep(2500)
hot.subscribe { println("B: $it") }  // 2 부터 받음
```

대표 hot source: `Sinks.many().multicast()`, `Flux.interval().share()`, Server-Sent Events.

---

## 4. Assembly time vs Subscription time

가장 헷갈리는 개념. 두 단계로 분리됨.

```kotlin
// 1) Assembly time — 체인을 *선언* 만 함, 실행 안 함
val pipeline = Mono.fromCallable { fetchUser() }    // 실행 X
    .map { it.toDto() }                             // 실행 X
    .flatMap { saveAudit(it) }                      // 실행 X

// 2) Subscription time — 여기서 비로소 실행 시작
pipeline.subscribe { println(it) }
```

핵심:
- Mono/Flux 변수 = "실행할 일의 그래프" 를 들고 있는 객체
- subscribe() 가 호출돼야 위에서 아래로 데이터가 흐름
- 같은 Mono 를 두 번 subscribe 하면 **두 번 실행**됨

> "Mono 안 만들어졌는데 왜 안 동작?" → subscribe 안 했기 때문. 90% 의 초보 실수.

---

## 5. 핵심 Operator

### map / flatMap / concatMap / switchMap

```kotlin
// map: 1:1 변환 (sync)
Flux.just(1, 2, 3).map { it * 2 }            // 2, 4, 6

// flatMap: 1:N 변환 (async, 병렬), 순서 보장 X
Flux.just("a", "b").flatMap { fetchAsync(it) }

// concatMap: flatMap + 순서 보장 (직렬)
Flux.just("a", "b").concatMap { fetchAsync(it) }

// switchMap: 새 값이 들어오면 이전 inner Mono 취소
Flux.just("a", "b").switchMap { fetchAsync(it) }
```

flatMap vs concatMap 차이는 면접 단골:
- flatMap: 동시에 여러 inner publisher subscribe → throughput ↑, 순서 X
- concatMap: 한 번에 하나만 → 순서 ✓, throughput ↓

### filter / take / skip

```kotlin
Flux.range(1, 10).filter { it % 2 == 0 }  // 2,4,6,8,10
Flux.range(1, 10).take(3)                  // 1,2,3
Flux.range(1, 10).skip(7)                  // 8,9,10
```

### zip / merge / concat

```kotlin
// zip: 여러 publisher 의 값을 *짝지어* 합침
Mono.zip(fetchUser(), fetchOrder()) { user, order -> Pair(user, order) }

// merge: 여러 publisher 를 동시에 (interleaved)
Flux.merge(fluxA, fluxB)

// concat: 여러 publisher 를 직렬로
Flux.concat(fluxA, fluxB)  // A 끝나고 B 시작
```

### onErrorResume / retry / timeout

```kotlin
fetchUser()
    .timeout(Duration.ofSeconds(2))
    .retry(3)
    .onErrorResume { ex -> Mono.just(defaultUser()) }
```

체이닝이 깔끔. 이 부분이 try/catch 보다 reactive 의 명백한 우위.

---

## 6. Schedulers — 어디서 실행할 것인가

Reactor 자체는 thread 를 생성하지 않는다. Scheduler 가 그것을 결정.

| Scheduler | 용도 | 특징 |
|---|---|---|
| `Schedulers.parallel()` | CPU-bound 작업 | thread = CPU 수, fixed |
| `Schedulers.boundedElastic()` | **Blocking IO** | thread 동적, 상한 = CPU * 10 |
| `Schedulers.single()` | 순차 실행 (timer 등) | thread 1 개 공유 |
| `Schedulers.immediate()` | 호출자 thread 그대로 | overhead 0 |

### subscribeOn vs publishOn — 가장 헷갈림

```kotlin
Mono.fromCallable { blockingCall() }           // 어디서 실행?
    .subscribeOn(Schedulers.boundedElastic())  // 위 단계를 boundedElastic 에서
    .map { transform(it) }                     // ← 어디서?
    .publishOn(Schedulers.parallel())          // 아래 단계를 parallel 에서
    .filter { it.isOk() }                      // parallel 에서 실행
    .subscribe { println(it) }                  // parallel 에서 실행
```

**규칙**:
- `subscribeOn` — *체인 시작점* (source 의 subscribe 호출) 의 thread 결정. 한 체인에 여러 번 써도 첫 번째만 의미 있음
- `publishOn` — 그 *이후* 단계의 thread 결정. 여러 번 써서 단계별 분리 가능

```
Source ─[subscribeOn 영향]─► op1 ─[publishOn1]─► op2 ─[publishOn2]─► op3 ─► Subscriber
```

### 흔한 패턴 — JDBC 호출

```kotlin
fun findUserReactive(id: Long): Mono<User> = Mono.fromCallable {
    jdbcTemplate.queryForObject("SELECT * FROM users WHERE id = ?", id)
}.subscribeOn(Schedulers.boundedElastic())  // ← blocking 을 elastic 에서
```

WebFlux 의 EventLoop 가 안 막히는 핵심 패턴.

### 흔한 실수

```kotlin
// 잘못된 코드: subscribeOn 을 마지막에
Mono.fromCallable { blockingCall() }
    .map { transform(it) }
    .filter { it.isOk() }
    .subscribeOn(Schedulers.boundedElastic())  // 이렇게 둬도 *전체 체인이 elastic 에서*
```

`subscribeOn` 은 **체인 어디에 두든 source 의 subscribe 만 영향**. 위 코드는 결과적으로 모든 단계가 elastic 에서 도는데, 명확성을 위해 source 직후에 두는 게 관행.

---

## 7. Operator 동작 — 내부 모습

`.map { it * 2 }` 는 새 Mono 를 만들어 *기존 Mono 를 wrap* 한다.

```
Mono.just(5)
  └ MonoJust(value=5)

Mono.just(5).map { it * 2 }
  └ MonoMap(source=MonoJust(5), mapper=...)

Mono.just(5).map { it * 2 }.filter { it > 0 }
  └ MonoFilter(source=MonoMap(source=MonoJust(5), mapper=...), pred=...)
```

subscribe() 시점에 안에서 밖으로 펴면서 실행. 그래서 *operator 가 immutable* — 같은 Mono 를 여러 번 써도 안전.

---

## 8. Context — ThreadLocal 의 비동기 대체

ThreadLocal 은 reactive 에서 안 됨 (thread 가 hop 하므로). Reactor 는 자체 Context 제공.

```kotlin
fun userIdFromContext(): Mono<Long> =
    Mono.deferContextual { ctx ->
        Mono.just(ctx.get("userId"))
    }

webHandler()
    .contextWrite(Context.of("userId", 123L))
    .subscribe()
```

Spring Security Reactive 도 SecurityContext 를 이 Context 에 담아 전파.

---

## 9. Sinks — 손으로 데이터 푸시

Hot publisher 를 만들 때.

```kotlin
val sink: Sinks.Many<String> = Sinks.many().multicast().onBackpressureBuffer()

// publisher 로 노출
val flux: Flux<String> = sink.asFlux()

// 외부에서 push
sink.tryEmitNext("hello")
sink.tryEmitNext("world")
sink.tryEmitComplete()
```

Server-Sent Events, 실시간 알림 등에 사용. SSE 는 [18 글](18-improvements.md) 에서 다룸.

---

## 10. block() — 절대 쓰지 말라는 그것

```kotlin
val result = Mono.fromCallable { fetch() }.block()  // sync 처럼 기다림
```

- 테스트, main 함수, 마이그레이션 외 **금지**
- WebFlux EventLoop 안에서 `block()` 호출하면 즉시 IllegalStateException
- 운영 코드에선 `subscribe()` 또는 suspend 함수로 변환

---

## 11. Coroutine 과의 다리 — kotlinx-coroutines-reactor

```kotlin
import kotlinx.coroutines.reactor.awaitSingle
import kotlinx.coroutines.reactor.mono

// Mono → suspend
suspend fun getUser(id: Long): User =
    userRepo.findById(id)
        .awaitSingle()

// suspend → Mono
fun getUserMono(id: Long): Mono<User> = mono {
    fetchUserSuspend(id)
}
```

[14 글](14-coroutine-vs-reactor.md) 에서 자세히. 우리 msa 의 `order/ProductAdapter.kt` 가 이 패턴 사용 중.

---

## 12. 면접 답변 템플릿

**Q. Reactor 의 publishOn 과 subscribeOn 차이는?**

> "둘 다 thread 를 바꾸는 operator 인데 영향 범위가 다릅니다.
> - **subscribeOn** 은 *체인의 source* 가 어느 thread 에서 시작될지를 결정합니다. 체인 어느 위치에 둬도 첫 번째 것만 의미 있고, source 의 subscribe 호출에 적용됩니다.
> - **publishOn** 은 *그 이후 단계* 가 어느 thread 에서 실행될지 결정합니다. 여러 번 써서 단계별로 분리 가능합니다.
>
> 흔한 예: `Mono.fromCallable { jdbcQuery() }.subscribeOn(Schedulers.boundedElastic())` — blocking JDBC 를 elastic pool 로 옮겨 EventLoop 가 안 막히게. WebFlux 컨텍스트에선 *blocking 호출은 거의 항상 boundedElastic*, *CPU 작업은 parallel* 입니다."

---

## 13. 핵심 포인트

- Mono(0..1) / Flux(0..N) — Publisher 인터페이스 구현
- Cold = subscribe 마다 새 source / Hot = 공유
- Assembly time (선언) vs Subscription time (실행) 분리 — subscribe 안 하면 아무 일 없음
- Schedulers 4 종 — boundedElastic 이 blocking IO 의 안전망
- subscribeOn = source thread / publishOn = 이후 thread
- block() 는 테스트 외 금지

## 다음 학습

- [11-backpressure.md](11-backpressure.md) — Backpressure 의 의미와 전략
