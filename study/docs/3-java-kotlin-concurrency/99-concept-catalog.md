---
parent: 3-java-kotlin-concurrency
seq: 99
title: Java/Kotlin 동시성 개념 카탈로그 — Full-Coverage Index + 심화 템플릿
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
sources:
  - https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/package-summary.html
  - https://openjdk.org/jeps/444 (Virtual Threads)
  - https://openjdk.org/jeps/453 (Structured Concurrency)
  - https://openjdk.org/jeps/446 (Scoped Values)
  - https://kotlinlang.org/docs/coroutines-overview.html
  - https://github.com/Kotlin/kotlinx.coroutines
---

# 99. Java/Kotlin 동시성 개념 카탈로그

> **목적** — 3-java-kotlin-concurrency 의 24+ deep file 매트릭스 + JDK + Kotlin 공식 기준 빠진 영역 발굴. **Loom/Structured Concurrency/Scoped Values** 가 표준화된 이후의 동시성 지형을 반영.

---

## 0. 사용법

`19-search-engine/99-concept-catalog.md` §0 와 동일.

---

## 1. 기존 커버 매트릭스 (요약)

기존 deep files 헤딩에서 확인된 영역:

| 카테고리 | 핵심 | 상태 |
|---|---|---|
| Memory Model | JMM (Java Memory Model), happens-before, ARM/x86 차이 | ✅ |
| Atomic / CAS | AtomicXxx, CAS 동작/ABA, spin vs back-off, 메모리 시맨틱 | ✅ |
| 동기화 primitives | synchronized, volatile, ReentrantLock, ReadWriteLock, StampedLock | ✅ |
| Concurrent Collections | ConcurrentHashMap, ConcurrentLinkedQueue, ConcurrentSkipListMap, CopyOnWriteArrayList, BlockingQueue | ✅ |
| 동기화 게이트 | CountDownLatch, CyclicBarrier, Phaser, Semaphore, Exchanger | ✅ |
| 스레드/스레드풀 | Daemon Thread, ThreadPoolExecutor, Fork/Join, ScheduledExecutorService | ✅ |
| Future / 비동기 | Future, CompletableFuture, ListenableFuture | ✅ |
| Coroutine | CoroutineScope/Job/Dispatcher, Channel (cold/hot), Flow, Backpressure | ✅ |
| Virtual Threads | Loom, JDK 21 GA, blocking IO 친화 | ✅ |
| **Virtual Thread ↔ Coroutine 비교** (Loom / Continuation / Pinning / StructuredTaskScope vs suspend / Dispatcher / Flow / Channel) | M:N 모델 양자 비교 + 선택 가이드 | ✅ 커버 ([25](25-virtual-thread-coroutine-deep.md)) |
| msa 적용 | @Async / @Scheduled / Kafka Concurrency / @Version / @Lock / Redis 분산락 | ✅ |
| 진단 | thread dump, stack trace 분석 | ✅ |

### 1-A. 갭 진단

JDK / Kotlin 공식 기준 다음 영역이 추가 deep dive 가치:

1. **Structured Concurrency** (JEP 462, 463 — preview/incubator) + Kotlin coroutineScope/supervisorScope 매핑
2. **Scoped Values** (JEP 446) — ThreadLocal 후속, Virtual Thread 친화
3. **Continuation API** (Loom 의 underpinning) — coroutine 의 Java 측 등가
4. **VarHandle** (JDK 9+) — Atomic 의 modern 대체
5. **MemorySegment / MemoryLayout** (Project Panama) — off-heap shared 메모리
6. **Thread.ofVirtual / ofPlatform builder** — JDK 21 표준 API
7. **Pinning / monitor-aware** — synchronized 안의 Virtual Thread 회피
8. **`@CarrierThread` / `Thread.startVirtualThread`** 문법
9. **`StructuredTaskScope.ShutdownOnFailure / ShutdownOnSuccess`**
10. **Adaptive ForkJoinPool** — Loom 의 carrier
11. **Reactive Streams 표준 (Java 9 Flow API)** — Reactor / RxJava 와 매핑
12. **Project Reactor 의 backpressure 전략** — BUFFER / DROP / LATEST / ERROR
13. **Kotlin Flow operators 풀 카탈로그** — collect / map / flatMap / buffer / debounce / sample / share
14. **SharedFlow / StateFlow** — hot conduit
15. **Mutex / Semaphore (kotlinx)** — coroutine 친화 lock
16. **Channel.UNLIMITED / RENDEZVOUS / CONFLATED / BUFFERED** — capacity 4종
17. **Coroutine cancellation cooperation** — isActive / yield / ensureActive
18. **ExceptionHandler / SupervisorJob** — 예외 전파 정책
19. **Coroutine context inheritance** — element 합성
20. **kotlinx-coroutines-debug** + IntelliJ Coroutine debugger
21. **Thread leak detection** — JFR `jdk.JavaMonitorWait`
22. **Reentrant problems** — virtual thread + synchronized pinning
23. **Deadlock 분석** — `jstack`, `jcmd Thread.print`, `-XX:+ShowMessageBoxOnError`
24. **Lock contention metrics** — JFR `jdk.JavaMonitorEnter`
25. **Phaser** (Java) — CyclicBarrier 의 일반화
26. **Exchanger** — pair-wise rendezvous
27. **Forkjoin RecursiveTask vs RecursiveAction** + work-stealing 내부
28. **CompletionService** — bulk 비동기 결과 수집
29. **Atomic*Array / Atomic*FieldUpdater** — fine-grained Atomic
30. **DoubleAdder / LongAdder** — high-contention 카운터 (Striped 64)

---

## 2. 카테고리별 개념 트리

### A. Java Memory Model (JMM)

| 개념 | 정의 | 링크 | 상태 |
|---|---|---|---|
| happens-before | program order + synchronization order + volatile + lock | JMM spec | ✅ 커버 |
| volatile | visibility + ordering, atomicity 아님 | docs/api volatile | ✅ |
| final 의 안전 publication | constructor 끝 후 다른 thread 가 보는 값 | JLS 17.5 | ✅ |
| 64-bit tearing | long/double 의 non-atomic write (legacy) | JLS 17.7 | ✅ |
| Acquire / Release semantics | volatile 의 hardware 의미 | JMM | 🟡 |
| Memory Barriers (LoadLoad / StoreStore / LoadStore / StoreLoad) | hardware level | docs | 🟡 |

### B. Atomic / CAS / VarHandle

| 개념 | 정의 | 상태 |
|---|---|---|
| AtomicInteger/Long/Reference | CAS 기반 | ✅ |
| AtomicArray / FieldUpdater | fine-grained | ★ 신규 |
| LongAdder / DoubleAdder | striped 64 — high contention | ★ 신규 |
| **VarHandle** (JDK 9+) | Unsafe 후속 표준 — Atomic 의 일반화 | ★ 신규 |
| CAS spin / back-off | 실패 시 전략 | ✅ |
| ABA 문제 + AtomicStampedReference | 해결책 | ✅ |
| Compare-And-Exchange (CAE) | CAS 의 read-back 변형 | 🟡 |

### C. Lock primitives

| 개념 | 정의 | 상태 |
|---|---|---|
| synchronized (intrinsic) | monitor enter/exit | ✅ |
| ReentrantLock | tryLock + 공정성 + Condition | ✅ |
| ReadWriteLock / ReentrantRWLock | reader 다수 + writer 1 | ✅ |
| StampedLock | optimistic read | ✅ |
| Condition (await/signal) | wait/notify 의 강화 | ✅ |
| Semaphore | permit | ✅ |
| **Coroutine Mutex / Semaphore** (kotlinx) | suspend 친화 | ★ 신규 |
| **Pinning** (Virtual Thread + synchronized) | carrier 고정 함정 — ReentrantLock 권장 | ★ 신규 |

### D. Concurrent Collections

| 개념 | 정의 | 상태 |
|---|---|---|
| ConcurrentHashMap | bucket striped — JDK 8 부터 CAS + tree | ✅ |
| ConcurrentSkipListMap/Set | sorted concurrent | ✅ |
| ConcurrentLinkedQueue/Deque | non-blocking | ✅ |
| CopyOnWriteArrayList/Set | read-heavy | ✅ |
| BlockingQueue (ArrayBlocking / Linked / Priority / DelayQueue / SynchronousQueue / LinkedTransferQueue) | producer-consumer | ✅ |
| Disruptor (LMAX) | mechanical sympathy ring buffer | ✅ |

### E. Thread / Pool / Future

| 개념 | 정의 | 상태 |
|---|---|---|
| Thread (Platform vs Virtual) | OS thread vs M:N | ✅ |
| Daemon Thread | JVM 종료 무시 | ✅ |
| ThreadFactory / UncaughtExceptionHandler | 생성/예외 정책 | 🟡 |
| ThreadPoolExecutor | core/max/keepAlive/queue/handler | ✅ |
| ScheduledExecutorService | 정기/지연 | ✅ |
| ForkJoinPool / Common pool | work-stealing | ✅ |
| RecursiveTask / RecursiveAction | divide-and-conquer | ✅ |
| ExecutorCompletionService | bulk async | ★ 신규 |
| Future / FutureTask | 결과 동기화 | ✅ |
| CompletableFuture | composable 비동기 + thenApply / thenCompose / handle | ✅ |
| ListenableFuture (Guava) | callback | 🟡 |

### F. Virtual Threads (Loom)

| 개념 | 정의 | 상태 |
|---|---|---|
| Virtual Thread (JEP 444) | M:N, blocking IO 친화 | ✅ 커버 ([25](25-virtual-thread-coroutine-deep.md)) |
| Carrier Thread | underlying platform thread | ✅ 커버 ([25](25-virtual-thread-coroutine-deep.md)) |
| Pinning (synchronized 안) | carrier 고정 — `-Djdk.tracePinnedThreads=full` | ✅ 커버 ([25](25-virtual-thread-coroutine-deep.md)) |
| Thread.ofVirtual().start | builder API | ✅ |
| Continuation API (internal) | coroutine 의 Java 측 underlying | ✅ 커버 ([25](25-virtual-thread-coroutine-deep.md)) |
| Virtual Thread schedulers | ForkJoinPool 기반 carrier | ✅ 커버 ([25](25-virtual-thread-coroutine-deep.md)) |

### G. Structured Concurrency / Scoped Values

| 개념 | 정의 | 상태 |
|---|---|---|
| **StructuredTaskScope** (JEP 462) | scope 기반 자식 task — fail-fast / first-success | ✅ 커버 ([25](25-virtual-thread-coroutine-deep.md)) |
| **Scoped Values** (JEP 446) | immutable per-thread context — Virtual Thread 친화 | ★ 신규 |
| **Kotlin coroutineScope / supervisorScope** | 등가 | ✅ 커버 ([25](25-virtual-thread-coroutine-deep.md)) |
| **CompletionStage cancellation** | timeout / cancel propagation | 🟡 |

### H. Reactive Streams / Reactor

| 개념 | 정의 | 상태 |
|---|---|---|
| Java 9 Flow API | Publisher / Subscriber / Subscription / Processor | ★ 신규 |
| Reactor Mono / Flux | 0-1 / 0-N | ✅ |
| Backpressure 전략 | BUFFER / DROP / LATEST / ERROR | ✅ |
| Schedulers | parallel / boundedElastic / single / immediate | 🟡 |
| Hot vs Cold | publishers | ✅ |

### I. Kotlin Coroutines

| 개념 | 정의 | 상태 |
|---|---|---|
| suspend 함수 | Continuation 기반 | ✅ 커버 ([25](25-virtual-thread-coroutine-deep.md)) |
| CoroutineScope / Job / Dispatchers | 컨텍스트 | ✅ 커버 ([25](25-virtual-thread-coroutine-deep.md)) |
| coroutineScope vs CoroutineScope | scope vs builder | ✅ |
| supervisorScope / SupervisorJob | 자식 실패 격리 | ✅ |
| CoroutineExceptionHandler | uncaught | ✅ |
| Cancellation cooperation | isActive / yield / ensureActive | 🟡 |
| Channel (4 capacity 모드) | RENDEZVOUS / CONFLATED / BUFFERED / UNLIMITED | ✅ 커버 ([25](25-virtual-thread-coroutine-deep.md)) |
| Channel pattern | fan-out / fan-in / pipeline | ✅ 커버 ([25](25-virtual-thread-coroutine-deep.md)) |
| Flow (cold) | collect / map / flatMap / buffer / debounce / sample / catch / retry | ✅ 커버 ([25](25-virtual-thread-coroutine-deep.md)) |
| StateFlow / SharedFlow (hot) | UI / event hub | ✅ |
| Mutex / Semaphore | coroutine 친화 lock | ★ 신규 |
| Dispatchers (IO / Default / Main / Unconfined) | 실행 풀 | ✅ 커버 ([25](25-virtual-thread-coroutine-deep.md)) |
| coroutineContext + CoroutineName / + Job + ... | 합성 | 🟡 |
| flowOn / collectLatest / launchIn | operator 패턴 | 🟡 |

### J. 디버깅 / 진단

| 도구 | 정의 | 상태 |
|---|---|---|
| jstack / jcmd Thread.print | thread dump | ✅ |
| Async-profiler (lock profile) | contention | 🟡 |
| JFR `jdk.JavaMonitorEnter / Wait` | lock 이벤트 | ★ 신규 |
| IntelliJ Coroutine Debugger / kotlinx-coroutines-debug | suspended state | ★ 신규 |
| `-Djdk.tracePinnedThreads=full` | Virtual Thread pinning 추적 | ★ 신규 |
| Deadlock detection | jstack -l | ✅ |

### K. msa 적용 (#3 의 Phase 3 grounding)

| 위치 | 적용 | 상태 |
|---|---|---|
| @Async | 미사용 | ✅ |
| @Scheduled | 다수 사용 | ✅ |
| Kafka consumer concurrency (concurrency=N) | 핵심 | ✅ |
| @Version (optimistic lock) | 일부 | ✅ |
| @Lock (pessimistic) | 미사용 | ✅ |
| Redis 분산락 (Redisson) | 미사용 | ✅ |
| Coroutine 사용처 | 일부 | ✅ |

---

## 3. 우선 심화 후보 Top-10

| 우선 | 주제 | 왜 |
|---|---|---|
| 1 | **Structured Concurrency + Scoped Values** | Virtual Thread 후속 — 새 표준 |
| 2 | **Virtual Thread Pinning 진단** | 운영 함정 — synchronized + IO 조합 |
| 3 | **VarHandle** | Unsafe 후속 표준 |
| 4 | **Kotlin Flow operators 풀 카탈로그** | reactive 코딩 표준 |
| 5 | **kotlinx-coroutines-debug + IntelliJ debugger** | suspended state 진단 |
| 6 | **Reactor / Flow / Java 9 Flow API 매핑 비교** | reactive 표준 정리 |
| 7 | **JFR lock 이벤트 + async-profiler lock profile** | contention 운영 |
| 8 | **LongAdder / DoubleAdder + Striped 64** | high-contention 카운터 |
| 9 | **Disruptor 와 mechanical sympathy** | 극단 성능 영역 |
| 10 | **Mutex / Semaphore (kotlinx)** | coroutine 친화 lock |

---

## 4. 표준 심화 스터디 템플릿

`19/99 §4` 그대로. JVM/Kotlin 특화:
- §3 → "JEP / JDK 도입 버전" 표
- §6 → "Java vs Kotlin 등가 매핑" (예: ReentrantLock ↔ Mutex, CompletableFuture ↔ async/await)
- §7 → JFR/async-profiler 모니터 패턴

---

## 5. 참고 자료

- JDK API: https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/package-summary.html
- JEP index: https://openjdk.org/jeps/0
- Kotlin Coroutines: https://kotlinlang.org/docs/coroutines-overview.html
- kotlinx.coroutines: https://github.com/Kotlin/kotlinx.coroutines
- Project Reactor: https://projectreactor.io/docs/core/release/reference/
- "Java Concurrency in Practice" (Brian Goetz) — 고전 표준
- "Kotlin Coroutines: Deep Dive" (Marcin Moskała)
- async-profiler lock mode: https://github.com/async-profiler/async-profiler
