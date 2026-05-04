---
parent: 3-java-kotlin-concurrency
seq: 25
title: Java Virtual Thread vs Kotlin Coroutine 심화 비교
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 14-coroutine-internals.md
  - 16-structured-concurrency.md
  - 17-virtual-threads.md
  - 18-reactor-vs-coroutine.md
sources:
  - https://openjdk.org/jeps/444
  - https://openjdk.org/jeps/453
  - https://openjdk.org/jeps/491
  - https://openjdk.org/jeps/505
  - https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html
  - https://kotlinlang.org/docs/coroutines-overview.html
  - https://github.com/Kotlin/kotlinx.coroutines
  - https://kotlinlang.org/docs/composing-suspending-functions.html
  - https://docs.spring.io/spring-framework/reference/integration/cache.html
catalog-row: "Loom (Virtual Thread) vs Coroutine — 컴파일 vs 런타임, 함수 색칠, cancellation 모델, Spring 통합, msa 라우팅"
---

# 25. Java Virtual Thread vs Kotlin Coroutine 심화 비교

## TL;DR

- **Java Virtual Thread (Project Loom)** — JEP 444 (Java 21 final, 2023-09), JEP 491 (synchronized pinning 제거, Java 24+) — JVM (Java Virtual Machine, 자바 가상 머신) 런타임이 *carrier thread 위에 M:N* 매핑하는 가벼운 스레드. blocking IO 자동 unmount.
- **Kotlin Coroutine** — 컴파일러가 `suspend` 함수를 state machine 으로 transform. CoroutineContext + structured concurrency. 라이브러리 (kotlinx.coroutines) 기반.
- **차이점 핵심**:
  - 컴파일 vs 런타임 (Kotlin = 컴파일러 transformation, Loom = JVM runtime)
  - 함수 색칠 (Coroutine 은 `suspend` 키워드로 명시 / Loom 은 비명시 — 그래서 *기존 blocking 코드를 그대로 재사용*)
  - cancellation (Kotlin = cooperative + structured / Loom = `Thread.interrupt()` 기반)
  - dispatcher (Kotlin = 명시 / Loom = pinning 함정)
- **언제 무엇을 쓰나**: JVM ecosystem with legacy blocking lib → VT. Kotlin-first / 정밀 제어 / Flow → Coroutine.

---

## 1. 두 모델의 본질

### 1.1 Virtual Thread (Loom) — runtime transformation

```
플랫폼 스레드 (Carrier Thread, OS thread = ForkJoinPool worker)
   │
   ├── VT-1 (mounted)  ← 일반 Java 코드 실행 중
   │     │ blocking call (Socket.read, JDBC, file IO ...)
   │     ▼
   │     unmount → continuation 으로 stack 캡처 → heap 저장
   │     carrier 풀려남
   │
   ├── VT-2 (mounted) ← carrier 가 다음 VT 처리
   │
   ... IO 완료 → VT-1 가 임의의 idle carrier 에 mount
```

핵심 성질:
- VT 는 *작은 객체* (수백 B). 수백만 개 가능
- carrier (= ForkJoinPool worker, default `availableProcessors`) 위에 mount
- blocking 호출이 자동 unmount → JDK 표준 IO API (Socket, JDBC, NIO 등) 가 *VT-aware* 로 재작성됨
- **기존 blocking 코드 재컴파일 없이 VT 위에서 동작**

### 1.2 Kotlin Coroutine — compile-time transformation

```kotlin
suspend fun fetch(): User = httpClient.get("/user")
suspend fun main() {
    val user = fetch()
    println(user)
}
```

이 코드를 컴파일하면 다음 같은 state machine 생성:

```java
// 의사코드 — 실제는 더 복잡 (label/state/result 필드)
class FetchContinuation implements Continuation<User> {
    int label = 0;
    Object result;
    Object resumeWith(Object input) {
        switch (label) {
            case 0:
                label = 1;
                Object r = httpClient.get("/user", this);
                if (r == COROUTINE_SUSPENDED) return COROUTINE_SUSPENDED;
                result = r;
                // fall through
            case 1:
                User user = (User) result;
                System.out.println(user);
                return Unit.INSTANCE;
        }
    }
}
```

핵심 성질:
- *컴파일러* 가 transformation → JVM 은 단지 일반 Object 와 메서드만 봄
- `suspend` 함수만 suspension point 가 될 수 있음 → **함수 색칠 (function coloring)**
- Continuation 객체 = coroutine 의 stack snapshot
- Dispatcher 가 어느 thread 에서 resume 할지 결정

### 1.3 한 장 비교

| 항목 | Virtual Thread | Kotlin Coroutine |
|---|---|---|
| 변환 시점 | 런타임 (JVM) | 컴파일 시점 (kotlinc) |
| 단위 | Thread 객체 | Continuation 객체 |
| API 변화 | 없음 (기존 blocking API 재사용) | `suspend` 키워드 필요 |
| 함수 색칠 | 없음 (color-blind) | 있음 (`suspend` red, normal blue) |
| 메모리 | ~수백 B/VT | ~수십 B/Continuation |
| 의존성 | JDK 21+ | kotlinx.coroutines 라이브러리 |

---

## 2. Java Virtual Thread 심화

### 2.1 API

```java
// 단발 VT
Thread.startVirtualThread(() -> System.out.println("hi"));

// VT factory
ThreadFactory factory = Thread.ofVirtual().name("worker-", 0).factory();

// VT executor
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    executor.submit(() -> doWork());
}

// VT vs Platform thread
Thread.ofVirtual().start(() -> {});   // virtual
Thread.ofPlatform().start(() -> {});  // platform (OS thread)
```

### 2.2 Continuation 기반 구현

VT 의 unmount/mount 는 OpenJDK 의 *Continuation API* 가 핵심 (internal):

```java
// 개념 의사코드
class Continuation {
    Continuation(Runnable target) { ... }
    void run();           // mount + execute
    static void yield(Scope s);  // unmount, save stack to heap
}
```

`Thread.sleep`, `Socket.read`, `LockSupport.park` 등이 내부적으로 `Continuation.yield()` 호출 → carrier 풀어줌.

### 2.3 ForkJoinPool 위 carrier

```
default carrier = ForkJoinPool with parallelism = availableProcessors()
- Thread.startVirtualThread → 새 VT, 임의 carrier 에 mount
- VT 가 blocking → unmount → carrier idle → 다음 VT
- VT 가 CPU bound → mount 한 채로 끝까지 (다른 VT 가 쓸 carrier 줄어듦)
```

Carrier 명시적 변경:
```java
Thread.ofVirtual()
    .scheduler(myExecutor)  // ← internal API, deprecated 위험
    .start(...);
```

→ **기본 default carrier 권장**. 따로 분리하면 starvation 위험.

### 2.4 Pinning 함정

VT 가 *unmount 못 하고* carrier 를 점유하는 경우:

| 원인 | 상태 (Java 21) | 상태 (Java 24+, JEP 491) |
|---|---|---|
| `synchronized` block 안에서 blocking | pinned | **resolved** ✓ |
| native call (JNI) 안에서 blocking | pinned | pinned (여전) |
| `Object.wait()` | pinned | resolved (Java 25, JEP 505) |

#### Java 21 시기 회피책

```java
// before
synchronized (lock) {
    expensive.run();    // ← 여기서 IO 일어나면 pinning
}

// after — ReentrantLock 사용
ReentrantLock lock = new ReentrantLock();
lock.lock();
try {
    expensive.run();    // ← unmount OK
} finally {
    lock.unlock();
}
```

JFR (Java Flight Recorder) 의 `jdk.VirtualThreadPinned` 이벤트로 진단:
```bash
java -XX:StartFlightRecording=filename=app.jfr -jar app.jar
jfr print --events jdk.VirtualThreadPinned app.jfr
```

#### Java 24+ 이후

JEP 491 — `synchronized` 안에서도 unmount 가능. 대부분의 legacy 코드를 *수정 없이* VT 친화로 만듦. **단, native 코드 / `Object.wait` 일부 케이스는 여전히 pinning**.

### 2.5 Structured Concurrency (JEP 453, 462, 463)

```java
try (var scope = StructuredTaskScope.<String>open()) {
    Subtask<String> a = scope.fork(() -> fetchA());
    Subtask<String> b = scope.fork(() -> fetchB());
    scope.join();             // wait all
    return a.get() + b.get();
}
```

- `ShutdownOnFailure`: 하나 실패 시 나머지 cancel
- `ShutdownOnSuccess`: 첫 성공 시 나머지 cancel
- scope close 시 모든 자식 cancel

→ Kotlin 의 `coroutineScope { }` / `supervisorScope { }` 와 1:1 매핑.

### 2.6 Scoped Values (JEP 446, 464) — ThreadLocal 후속

```java
final static ScopedValue<User> CURRENT_USER = ScopedValue.newInstance();

ScopedValue.where(CURRENT_USER, currentUser).run(() -> {
    handleRequest();   // CURRENT_USER.get() 으로 접근
});
```

VT 의 단점: VT 는 수백만 개 → ThreadLocal 메모리 폭증. ScopedValue 는 *immutable + scope 한정* 으로 GC 친화.

---

## 3. Kotlin Coroutine 심화

### 3.1 suspend function + Continuation

```kotlin
suspend fun fetchUser(id: Long): User = withContext(Dispatchers.IO) {
    httpClient.get("/users/$id")
}
```

bytecode 레벨에서 `suspend` 함수는 `Continuation<T>` 파라미터를 추가 받는 일반 함수로 transform:

```kotlin
// before kotlinc
suspend fun fetchUser(id: Long): User = ...

// after (JVM bytecode 레벨)
fun fetchUser(id: Long, $cont: Continuation<User>): Object {
    // state machine ...
}
```

리턴은 *실제 결과* 또는 `COROUTINE_SUSPENDED` (suspending state).

### 3.2 CoroutineContext

```kotlin
launch(Dispatchers.IO + CoroutineName("worker") + SupervisorJob() + exHandler) {
    // ...
}
```

context elements:
- **Dispatcher** — 실행할 thread pool (`Default`, `IO`, `Main`, `Unconfined`, custom)
- **Job** — lifecycle / parent-child / cancellation
- **CoroutineName** — debug name
- **CoroutineExceptionHandler** — uncaught 예외 처리

### 3.3 Dispatchers

```kotlin
Dispatchers.Default      // CPU bound, ForkJoinPool 비슷, ncpu 개
Dispatchers.IO           // blocking IO, default 64 + ncpu 까지 확장
Dispatchers.Main         // UI thread (Android / JavaFX / Swing)
Dispatchers.Unconfined   // 호출자 thread 그대로, 위험
Dispatchers.fromExecutor(myExecutor)  // 임의 ExecutorService 래핑
```

전형 사용:
- CPU 작업: `Dispatchers.Default`
- DB / 외부 API blocking call: `Dispatchers.IO`
- UI 렌더링: `Dispatchers.Main`

### 3.4 Structured Concurrency

```kotlin
suspend fun fetchAll() = coroutineScope {
    val a = async { fetchA() }
    val b = async { fetchB() }
    a.await() + b.await()
}
```

- `coroutineScope { }` — 자식 중 하나 실패 시 모두 cancel + scope close 까지 대기
- `supervisorScope { }` — 자식 실패가 형제에 전파 안 됨
- `withContext(ctx) { }` — context 변경 + 동기 호출처럼 보이지만 dispatcher 전환

Job tree:
```
parent Job
├── child A (launch)
│   ├── grandchild A1
│   └── grandchild A2
└── child B (async)
```

parent cancel → 모든 후손 cancel.

### 3.5 Cancellation — cooperative

```kotlin
val job = launch {
    repeat(1000) { i ->
        if (!isActive) return@launch  // 또는 ensureActive()
        doWork(i)
        delay(100)  // suspend point — cancellation check 자동
    }
}
delay(500)
job.cancel()
job.join()
```

**모든 suspend 함수가 cancellation point** — `delay`, `withContext`, `yield` 등에서 자동 검사.

CPU bound loop 는 `yield()` 또는 `ensureActive()` 로 검사 명시 필요.

### 3.6 Flow / Channel

#### Flow — cold stream (≈ Reactor Flux 의 cold)

```kotlin
fun numbers(): Flow<Int> = flow {
    repeat(10) {
        emit(it)
        delay(100)
    }
}

numbers()
    .filter { it % 2 == 0 }
    .map { it * it }
    .collect { println(it) }   // ← 여기서 emission 시작
```

#### Channel — hot, multi-producer/consumer queue

```kotlin
val chan = Channel<Int>(capacity = 10)
launch { chan.send(42) }
launch { val x = chan.receive() }
```

backpressure 정책: `RENDEZVOUS / BUFFERED / CONFLATED / UNLIMITED`.

#### SharedFlow / StateFlow — hot Flow

- `StateFlow` — single value state holder, BehaviorSubject 비슷
- `SharedFlow` — multi-value broadcast, 구독자별 replay 가능

---

## 4. 핵심 차이점 비교

### 4.1 컴파일 vs 런타임

```
Coroutine:
  source.kt → kotlinc → bytecode (Continuation-passing) → JVM 그냥 실행
  → JVM 은 coroutine 모름. 일반 객체와 메서드만 봄.

Virtual Thread:
  source.java → javac → bytecode (변화 없음) → JVM (Loom-aware)
  → JVM 자체가 VT 인지 platform thread 인지 분기
```

함의:
- Coroutine: **kotlinx.coroutines 라이브러리만 있으면 어떤 JVM 에서도 동작** (Java 8+ OK)
- VT: **JVM 21+ 필수**. 그 미만은 평범한 Thread.

### 4.2 함수 색칠 (Function Coloring)

```kotlin
// Kotlin
fun normal() {
    val x = suspendingFn()   // ❌ COMPILE ERROR — suspend 안에서만 호출
}

suspend fun suspending() {
    val x = suspendingFn()   // ✓
}
```

vs

```java
// Java with VT
void anywhere() {
    var x = blockingFn();   // ✓ — VT 안이든 platform thread 안이든 OK
}
```

→ **VT 의 가장 큰 장점**: 기존 Spring Framework / JDBC / Apache HttpClient / Kafka client 등 *모든 blocking lib* 를 그대로 사용 가능. coroutine 은 각 lib 에 *suspending wrapper* 가 필요 (`kotlinx-coroutines-jdk*`, `kotlinx-coroutines-reactor` 등).

→ **단점**: VT 는 어디서 suspend 가 일어나는지 *명시적이지 않음* → side effect / IO 가 코드에서 안 보임. coroutine 의 `suspend` 는 *시각적 표시*.

### 4.3 Cancellation 모델

| 모델 | 메커니즘 | 협력 필요 |
|---|---|---|
| Coroutine | `Job.cancel()` → suspend point 에서 `CancellationException` | ✓ (suspend 함수만 자동 / CPU loop 는 yield 필요) |
| VT | `Thread.interrupt()` → `InterruptedException` (blocking call) | ✓ (interrupt flag 검사 / blocking call 만 자동) |

본질은 같음 — **둘 다 cooperative cancellation**. 차이:
- Coroutine: structured concurrency 가 *기본* — `coroutineScope` 안에서 자식 자동 cancel
- VT: structured concurrency 는 *별도 API* (`StructuredTaskScope`) — 명시적 사용 필요

### 4.4 Pinning / Dispatcher 함정

VT 의 pinning 은 자동 (개발자가 모르고 발생). Coroutine 의 dispatcher 는 명시적 선택 (개발자가 IO/Default/Main 지정).

```kotlin
// Coroutine — IO bound 명시
withContext(Dispatchers.IO) {
    blockingDbCall()
}

// 실수 — Default 에서 blocking 호출하면 Default pool 고갈
// withContext(Dispatchers.Default) {
//     blockingDbCall()  // ← Default 의 ncpu 개 worker 가 다 막힘
// }
```

VT 는 *자동* 으로 unmount → carrier 풀림. 단, pinning 시 carrier 점유.

→ trade-off: Coroutine 은 *명시 필요* + 안전, VT 는 *자동* + 함정 위험.

### 4.5 Spring 통합

#### Spring Boot 3.2+ Virtual Threads

```yaml
spring:
  threads:
    virtual:
      enabled: true
```

활성화되면:
- Tomcat worker → VT
- `@Async` executor → VT
- `@Scheduled` → VT (옵션)
- WebFlux 는 별개 (이미 reactive)

#### Spring WebFlux + Coroutine

```kotlin
@RestController
class ProductController(private val service: ProductService) {
    @GetMapping("/products/{id}")
    suspend fun get(@PathVariable id: Long): Product =
        service.findById(id)   // suspend repository
}
```

WebFlux 가 `suspend` 함수를 자동으로 `Mono` 로 transform.

#### Spring MVC + Coroutine

Spring MVC 에서도 `suspend` controller 지원 (Spring 6.0+). 내부적으로 servlet async + coroutine 조합.

### 4.6 성능 비교 (대략)

| 시나리오 | Platform Thread (8K pool) | VT | Coroutine |
|---|---|---|---|
| 10K concurrent IO bound | 풀 고갈 | OK | OK |
| 1M concurrent IO bound | 불가 | OK (메모리 충분 시) | OK |
| CPU bound parallel | 동등 | 동등 | 동등 (Default dispatcher) |
| 메모리/concurrency unit | ~1MB/thread | ~수백 B/VT | ~수십 B/Continuation |
| Context switch 비용 | OS-level (μs) | JVM-level (ns 수준) | 없음 (단일 thread 내 state machine) |

→ **연결 100K+ 의 high concurrency**: VT 또는 Coroutine, 둘 다 OK. **유지보수성 / 코드 색깔 표현력** 차이가 결정 요인.

---

## 5. 언제 무엇을 쓸 것인가

### 5.1 Virtual Thread 가 유리한 경우

- **Java 위주 + legacy blocking 코드 다수** — JDBC, JPA, Apache HttpClient, Kafka client 등
- **Spring Boot 3.2+ + Spring MVC (servlet 모델)** 유지하면서 동시성 늘리고 싶을 때
- **외부 lib 가 suspend 미지원** (대부분의 legacy SDK)
- **함수 색깔 (suspend) 가 부담스러운 팀**
- **JDK 21+ 만 사용 가능** 환경

### 5.2 Coroutine 이 유리한 경우

- **Kotlin-first 프로젝트**
- **Flow / Channel 같은 stream 추상화 필요**
- **structured concurrency 를 default 로** 사용하고 싶을 때
- **세밀한 dispatcher 제어** (CPU/IO 명시 분리)
- **Android** (VT 미지원)
- **Ktor / Arrow 등 Kotlin native 스택**

### 5.3 둘 다 사용 가능한 경우

Spring Boot 3.2 + Kotlin + WebFlux 조합. 권장:
- WebFlux + suspend controller → Coroutine
- 일반 Spring MVC + JDBC → VT
- **혼합 가능** — VT 안에서 `runBlocking { ... coroutine ... }` 도 OK (단 권장 안 함)

---

## 6. 함정과 해결책

### 6.1 VT 함정

#### 함정 1: Pinning (Java 21)
```java
// ❌ synchronized 안에서 blocking
synchronized (cache) {
    var data = httpClient.get(...);  // pinning
}
```
→ **해결**: ReentrantLock 사용 또는 Java 24+ (JEP 491).

#### 함정 2: ThreadLocal 메모리 폭증
VT 수백만 개 + 각각 ThreadLocal → 메모리 부족.
→ **해결**: ScopedValue (JEP 446) 사용.

#### 함정 3: Thread Pool 제거 안 함
```java
@Bean
ExecutorService executor() {
    return Executors.newFixedThreadPool(200);  // VT 시대엔 무의미
}
```
→ **해결**: `Executors.newVirtualThreadPerTaskExecutor()`.

### 6.2 Coroutine 함정

#### 함정 1: blocking call in Default dispatcher
```kotlin
withContext(Dispatchers.Default) {
    Thread.sleep(1000)  // ← Default pool worker 점유
}
```
→ **해결**: `Dispatchers.IO` 또는 `delay(1000)`.

#### 함정 2: GlobalScope 남용
```kotlin
GlobalScope.launch { ... }  // ← parent 없음, leak 위험
```
→ **해결**: 적절한 scope (e.g. `viewModelScope`, `applicationScope`) 사용.

#### 함정 3: runBlocking 잘못 사용
```kotlin
// ❌ suspend 함수 안에서
suspend fun foo() {
    runBlocking { bar() }  // ← thread block, structured concurrency 깨짐
}
```
→ **해결**: 그냥 `bar()` 호출 (suspend 함수면 OK).

#### 함정 4: 예외 전파
`async { }` 의 예외는 `await()` 호출 시점에 발생. `launch { }` 는 즉시 전파.
```kotlin
val deferred = async { throw RuntimeException("boom") }
// 여기까지 OK
delay(1000)
deferred.await()  // ← 여기서 예외 던짐
```

---

## 7. msa 적용

### 7.1 현재 msa 의 동시성 모델

| 서비스 | 동시성 모델 | 비고 |
|---|---|---|
| gateway | Spring Cloud Gateway = WebFlux + Reactor Netty | reactive, suspend 일부 |
| product | Spring MVC + Kotlin + JPA | blocking, 향후 VT 후보 |
| order | Spring MVC + Kotlin + JPA + Kafka | blocking, VT 후보 |
| search | Spring MVC + Kotlin + ES Java client | blocking, VT 후보 |
| analytics | Spring MVC + Kotlin + Kafka Streams | blocking |
| charting | Python FastAPI | async/await (별도 모델) |
| quant | Spring MVC + Kotlin + JPA | blocking |
| wishlist | Spring MVC + Kotlin + JPA | blocking |
| gifticon | Spring MVC + Kotlin + JPA | blocking |

→ Spring MVC 서비스들은 모두 **VT 도입으로 즉시 이득**.

### 7.2 VT 도입 가이드 — Spring Boot 3.2+

#### Step 1: 활성화

```yaml
# application.yml
spring:
  threads:
    virtual:
      enabled: true
```

→ Tomcat worker / `@Async` / `@Scheduled` 가 자동으로 VT.

#### Step 2: 임시 코드 점검

- `synchronized` block 안의 IO → ReentrantLock 으로 교체 (Java 24 미만)
- `ThreadLocal` 사용처 점검 → `ScopedValue` 후보
- `ThreadPool` 빈 → `newVirtualThreadPerTaskExecutor()` 검토

#### Step 3: 모니터링

```bash
# JFR 으로 pinning 추적
java -XX:StartFlightRecording=duration=60s,filename=app.jfr -jar app.jar
jfr print --events jdk.VirtualThreadPinned app.jfr
```

#### Step 4: 부하 테스트

- 동시 요청 수 100/1K/10K 단계별 측정
- p99 latency / heap / GC pause 비교
- Tomcat thread pool 만 늘릴 때 vs VT 활성화 비교

### 7.3 Coroutine 도입 — gateway / charting 등

`gateway` 는 이미 WebFlux. WebFlux + suspend 통합은 자연스러움:

```kotlin
// gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt
class AuthenticationGatewayFilter : GatewayFilter {
    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        // 현재 reactive
        return chain.filter(exchange)
    }
}
```

→ suspend 로 변환하려면 `kotlinx-coroutines-reactor` 의 `mono { }` 빌더 사용:

```kotlin
class AuthenticationGatewayFilter : GatewayFilter {
    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> = mono {
        val token = exchange.request.headers["Authorization"]?.firstOrNull()
        val user = authService.verify(token)  // suspend
        exchange.attributes["user"] = user
        chain.filter(exchange).awaitFirstOrNull()
    }
}
```

trade-off: 가독성 ↑, 단 Reactor Context propagation 주의 (별도 핸들링 필요).

### 7.4 권장 라우팅 (msa 한정)

| 서비스 패턴 | 추천 |
|---|---|
| Spring MVC + JPA | VT (Spring Boot 3.2+) |
| Spring WebFlux + Reactor | Coroutine wrapping (선택) 또는 Reactor 유지 |
| Kafka consumer | VT 또는 Coroutine (Kafka client 는 blocking → VT 자연) |
| 전 서비스 통일 | VT (Kotlin-first 라도) — Spring 표준 |
| 협업 / 실시간 통신 | Coroutine + Flow |

→ **현실적 선택**: msa 는 Spring Boot 3.2 + Kotlin → VT 활성화 + 일부 Coroutine 도입 (필요시) 혼합.

### 7.5 마이그레이션 ADR 후보

`docs/adr/ADR-XXXX-virtual-threads-rollout.md` 후보:
- 각 서비스별 VT 활성화 시점
- 부하 테스트 결과 첨부
- Pinning 모니터링 대시보드 (Grafana panel)
- ThreadLocal → ScopedValue 마이그레이션 plan

→ `study/docs/00-ADR-CANDIDATES.md` 에 통합.

---

## 8. 면접 질문 대비

### Q1. Virtual Thread 와 Kotlin Coroutine 의 본질적 차이

> Coroutine 은 *컴파일러가* suspend 함수를 state machine 으로 transform → JVM 은 그냥 일반 객체로 봄. VT 는 *JVM 런타임이* carrier thread 위에 M:N 매핑 → 기존 Thread API 의미를 유지하면서 가벼움. 그래서 VT 는 함수 색칠 없음 (legacy 코드 재사용 OK), Coroutine 은 `suspend` 명시 필수 (단, 명시 = 가시성).

### Q2. Pinning 이란?

> VT 가 carrier thread 를 *unmount 못하고* 점유하는 상태. Java 21 까지는 `synchronized` block 안의 blocking IO, native call (JNI), `Object.wait()` 가 원인. JEP 491 (Java 24+) 으로 synchronized pinning 해소. 진단은 JFR 의 `jdk.VirtualThreadPinned` 이벤트 또는 `-Djdk.tracePinnedThreads=full`.

### Q3. Coroutine 의 cooperative cancellation

> `Job.cancel()` 호출 시 즉시 thread 죽이는 게 아니라 `CancellationException` 을 *suspend point* 에서 던짐. `delay`, `withContext` 등은 자동 검사. CPU bound loop 는 `yield()` / `ensureActive()` 로 명시 검사. structured concurrency 가 parent cancel → 자식 cancel 자동.

### Q4. VT 도입 시 ThreadPool 빈은 어떻게?

> Spring Boot 3.2+ 의 `spring.threads.virtual.enabled=true` 면 Tomcat worker / `@Async` 가 자동 VT. 사용자 정의 ThreadPool (e.g. `Executors.newFixedThreadPool`) 은 그대로 두면 platform thread → VT 이득 안 봄. `Executors.newVirtualThreadPerTaskExecutor()` 로 교체.

### Q5. Coroutine Dispatcher 와 VT carrier 의 차이

> Dispatcher 는 *명시적 선택* (`Default` / `IO` / `Main`) — 개발자가 의도 표현. VT carrier 는 *자동* — JVM 이 ForkJoinPool 에서 임의 carrier 선택. blocking 호출 시 자동 unmount. trade-off: Coroutine 명시 = 안전 + 코드 노이즈, VT 자동 = 편함 + pinning 함정.

---

## 9. 학습 체크포인트

- [ ] VT 의 mount/unmount 사이클 그림으로 그리기
- [ ] suspend 함수가 bytecode 레벨에서 어떻게 변환되는지 설명
- [ ] Pinning 의 3 원인 + 해결책
- [ ] Coroutine 의 cooperative cancellation 시나리오
- [ ] structured concurrency — `coroutineScope` vs `StructuredTaskScope` 매핑
- [ ] Spring Boot 3.2 의 `spring.threads.virtual.enabled` 효과
- [ ] WebFlux + suspend controller 의 내부 변환 (`mono { }` 빌더)
- [ ] msa 의 어느 서비스가 VT / Coroutine / Reactor 인지

## 10. 다음 학습

- [14-coroutine-internals.md](14-coroutine-internals.md) — Continuation transformation 깊이
- [16-structured-concurrency.md](16-structured-concurrency.md) — structured concurrency 모델
- [17-virtual-threads.md](17-virtual-threads.md) — Loom 자체
- [18-reactor-vs-coroutine.md](18-reactor-vs-coroutine.md) — Reactor 와의 비교
- [22-msa-concurrency-patterns.md](22-msa-concurrency-patterns.md) — msa 적용 패턴

## 11. 참고 자료

- JEP 444: [Virtual Threads (Java 21 final)](https://openjdk.org/jeps/444)
- JEP 491: [Synchronize Virtual Threads without Pinning (Java 24)](https://openjdk.org/jeps/491)
- JEP 505: [Structured Concurrency (5th preview, Java 25)](https://openjdk.org/jeps/505)
- JEP 446 / 464: [Scoped Values](https://openjdk.org/jeps/446)
- Kotlin Coroutines guide: https://kotlinlang.org/docs/coroutines-overview.html
- kotlinx.coroutines: https://github.com/Kotlin/kotlinx.coroutines
- Roman Elizarov 의 *"Structured concurrency"* 발표
- Ron Pressler 의 *"Project Loom"* OpenJDK 발표
