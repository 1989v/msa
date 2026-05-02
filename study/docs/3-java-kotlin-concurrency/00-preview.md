---
parent: 3-java-kotlin-concurrency
type: preview
created: 2026-05-01
---

# Java/Kotlin 동시성 심화 — Preview

> 학습자: 10년차 Spring Boot Kotlin 백엔드 · 전체 예상 시간: 30h · 목표: 한국 대기업 면접 방어 + msa 코드베이스 동시성 점검
> 계획서: [00-plan.md](00-plan.md) · 깊이: P3 풀팩 + Phase 2 thread dump dedicated 섹션 추가 (2026-05-01 갱신)

---

## 멘탈 모델: "스택 4층 + 진단 1층"

동시성 학습은 결국 **"메모리 모델 → 동기화 프리미티브 → 고수준 추상 → 운영 진단"** 의 4단계로 압축된다.

```
  ┌─────────────────────────────────────────┐
  │  Layer A. 진단/관측 (Thread Dump, JFR)
  │  - jstack/jcmd, async-profiler
  │  - BLOCKED/WAITING 의 의미
  └─────────────────┬───────────────────────┘
                    │ "고장 났을 때 본다"
  ┌─────────────────┴───────────────────────┐
  │  Layer 4. 고수준 비동기 추상
  │  - CompletableFuture, Reactor
  │  - Coroutine (suspend, Flow, Channel)
  │  - Virtual Threads (JDK 25)
  └─────────────────┬───────────────────────┘
                    │ "고수준이 뭘 쓰는지"
  ┌─────────────────┴───────────────────────┐
  │  Layer 3. 동기화 자료구조
  │  - ConcurrentHashMap, COW, BlockingQueue
  │  - StampedLock, Phaser, CountDownLatch
  └─────────────────┬───────────────────────┘
                    │ "어떻게 만드나"
  ┌─────────────────┴───────────────────────┐
  │  Layer 2. 동기화 프리미티브
  │  - synchronized, ReentrantLock
  │  - volatile, Atomic (CAS)
  │  - ThreadLocal
  └─────────────────┬───────────────────────┘
                    │ "기반"
  ┌─────────────────┴───────────────────────┐
  │  Layer 1. JVM 메모리 모델 (JMM)
  │  - happens-before, synchronizes-with
  │  - cache coherence, false sharing
  └─────────────────────────────────────────┘
```

**핵심 7문장**:

1. **JMM happens-before** 가 깨지면 가시성/순서 보장이 모두 무너진다 — `volatile`, `synchronized`, `Lock unlock`, `Thread.start/join` 이 그 다리.
2. **`synchronized` 와 `volatile` 은 다른 문제를 푼다** — `synchronized` = 원자성+가시성, `volatile` = 가시성만.
3. **`Atomic*` 은 락 없는 CAS 루프** — contention 낮으면 빠르고 ABA 문제는 `AtomicStampedReference` 로.
4. **`ConcurrentHashMap` Java 8** = bin 단위 `synchronized` + CAS, 트리화는 충돌 8 이상.
5. **Kotlin coroutine** 은 컴파일러가 `Continuation` 을 만드는 state machine, 스레드를 점유하지 않는 suspend 가 핵심.
6. **Virtual Threads (JDK 25)** = 캐리어 스레드 위 M:N 매핑, blocking IO 는 unmount, `synchronized` pinning 은 JEP 491 으로 거의 해소.
7. **단발 thread dump 는 거짓말한다** — 5초 간격 3-5회로 *추세* 를 봐야 stuck vs transient 가 갈린다.

---

## 소주제 지도

> 25개 파일로 분할. 평균 ~1.2h, 핵심 deep file 은 1.5-2h.

### Phase 1: 기본 프리미티브 (8개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 01 | Thread 생명주기 + Runnable/Callable | [01-thread-lifecycle.md](01-thread-lifecycle.md) | NEW/RUNNABLE/BLOCKED/WAITING/TIMED_WAITING/TERMINATED, Daemon |
| 02 | synchronized + monitor | [02-synchronized-monitor.md](02-synchronized-monitor.md) | intrinsic lock, wait/notify, 클래스 락 vs 인스턴스 락 |
| 03 | volatile 와 메모리 가시성 | [03-volatile-memory-visibility.md](03-volatile-memory-visibility.md) | DCL 깨짐, 64-bit tearing, write-after-write 한계 |
| 04 | Atomic + CAS + ABA | [04-atomic-cas.md](04-atomic-cas.md) | CMPXCHG, LongAdder striped counter, AtomicStampedReference |
| 05 | ReentrantLock / ReadWriteLock / Condition | [05-locks-reentrant-rwlock.md](05-locks-reentrant-rwlock.md) | tryLock, fairness, AQS, Condition.await/signal |
| 06 | ThreadLocal + InheritableThreadLocal | [06-threadlocal.md](06-threadlocal.md) | ThreadLocalMap, WeakReference, 풀 환경 leak |
| 07 | Executor / ThreadPool / Fork-Join | [07-executor-threadpool.md](07-executor-threadpool.md) | core/max/queue, RejectedExecutionHandler, work-stealing |
| 08 | Concurrent Collections | [08-concurrent-collections.md](08-concurrent-collections.md) | COW, ConcurrentLinkedQueue, BlockingQueue, Sync 래퍼의 한계 |

### Phase 2: JVM 내부 + 고수준 추상 (11개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 09 | JMM happens-before / synchronizes-with | [09-jmm-happens-before.md](09-jmm-happens-before.md) | as-if-serial, 8가지 happens-before, sequential consistency 환상 |
| 10 | synchronized 내부 (lock 진화) | [10-synchronized-internals.md](10-synchronized-internals.md) | Mark Word, biased(JEP 374 deprecation) → light → heavy, lock inflation |
| 11 | ConcurrentHashMap 내부 | [11-concurrenthashmap-internals.md](11-concurrenthashmap-internals.md) | Java 7 Segment vs Java 8 bin synchronized + CAS, 트리화 |
| 12 | StampedLock 과 optimistic read | [12-stampedlock.md](12-stampedlock.md) | tryOptimisticRead → validate, lock 비반복성, RWLock 대비 |
| 13 | CompletableFuture 깊게 | [13-completablefuture.md](13-completablefuture.md) | thenApply vs thenApplyAsync, exceptionally, 조합, ForkJoinPool.commonPool 위험 |
| 14 | Kotlin coroutine 내부 (Continuation) | [14-coroutine-internals.md](14-coroutine-internals.md) | suspend → state machine 변환, COROUTINE_SUSPENDED, Dispatcher |
| 15 | Flow + Channel | [15-flow-channel.md](15-flow-channel.md) | cold vs hot, StateFlow/SharedFlow, backpressure, fan-out/in |
| 16 | Structured Concurrency | [16-structured-concurrency.md](16-structured-concurrency.md) | Job 트리, supervisorScope, 취소 전파 |
| 17 | Virtual Threads (Loom, JDK 25) | [17-virtual-threads.md](17-virtual-threads.md) | carrier/mount, pinning(JEP 491 해소), 적용 가능 영역 |
| 18 | Reactor vs Coroutine | [18-reactor-vs-coroutine.md](18-reactor-vs-coroutine.md) | 패러다임 비교, gateway 의 WebFlux 선택 이유 |
| 19 | false sharing / cache line / @Contended | [19-false-sharing.md](19-false-sharing.md) | 64B cache line, padding, JDK 8 @Contended |

### Phase 2.5: 운영 진단 (2개) — 신규 강화

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 20 | **스레드 덤프 수집 + 분석** | [20-thread-dump-analysis.md](20-thread-dump-analysis.md) | jstack/jcmd/kill -3, 5초 간격 3-5회, lock id 매칭, 풀 고갈 패턴 |
| 21 | async-profiler / JFR / IntelliJ | [21-profiling-tools.md](21-profiling-tools.md) | lock 프로파일, JFR Lock Inflation 이벤트 |

### Phase 3: msa 코드 점검 (1개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 22 | msa 동시성 코드 실측 점검 | [22-msa-concurrency-patterns.md](22-msa-concurrency-patterns.md) | @Async/@Scheduled/Kafka concurrency/JPA Lock/Coroutine 사용처 grep |

### 산출물 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 23 | msa 동시성 개선 후보 | [23-improvements.md](23-improvements.md) | Virtual Threads 도입 검토 + 분산 락 + Optimistic Lock 패턴 |
| 24 | 면접 Q&A 카드 | [24-interview-qa.md](24-interview-qa.md) | Phase별 카드 + thread dump 2문항 + 자가 평가 |

---

## 학습 의존 관계도

```
                    [01 Thread 생명주기]
                            │
                            ▼
            ┌──────────────[02 synchronized]
            │               │
            ▼               ▼
       [03 volatile]   [05 ReentrantLock]
            │               │
            └───┬───────────┘
                ▼
        [04 Atomic / CAS] ────────┐
                │                  │
                ▼                  ▼
   [07 ThreadPool]            [09 JMM happens-before]
                │                  │
                ▼                  ▼
   [08 Concurrent Coll]   [10 synchronized 내부]
                │                  │
                └───────┬──────────┘
                        ▼
              [11 ConcurrentHashMap]
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
  [13 CompletableFuture]  [14 coroutine]  [12 StampedLock]
                          │
                          ▼
                  [15 Flow/Channel]
                          │
                          ▼
                [16 Structured Concurrency]
                          │
                          ▼
                  [17 Virtual Threads]
                          │
                          ▼
                  [18 Reactor 비교]
                          │
                          ▼
                  [19 false sharing]
                          │
                          ▼
        ┌──────[20 Thread Dump]───────┐
        │                              │
        ▼                              ▼
  [21 Profiling]              [22 msa 코드 점검]
                                       │
                          ┌────────────┴────────────┐
                          ▼                          ▼
                 [23 improvements]          [24 interview Q&A]
```

---

## Phase 0 치트시트 (학습 시작 전 한 장)

### 동기화 도구 선택 의사결정

| 상황 | 1순위 | 비고 |
|---|---|---|
| 단순 카운터 증가 | `LongAdder` | 고contention. `AtomicLong` 은 contention 낮을 때만 |
| flag 한 개 read/write | `volatile` | 복합 연산 (read+modify+write) 이면 부족 |
| 복합 연산 보호 (몇 줄) | `synchronized` 블록 | JIT 가 거의 다 최적화함 |
| 복합 연산 + tryLock/timeout 필요 | `ReentrantLock` | interrupt, fairness 필요 시 |
| 읽기 다대다, 쓰기 가끔 | `ReadWriteLock` 또는 `StampedLock` | 쓰기 비율 5% 이하일 때 효과 |
| 다중 thread 가 같은 Map 갱신 | `ConcurrentHashMap` | `Collections.synchronizedMap` 은 글로벌 락이라 거의 항상 부적절 |
| read 100%, write 시 통째로 swap | `CopyOnWriteArrayList` | 리스너 목록 패턴 |
| 비동기 IO 조합 | `CompletableFuture` (Java) / `coroutine` (Kotlin) | gateway 만 Reactor |
| 짧은 blocking IO 다량 (HTTP 호출, JDBC) | **Virtual Threads (JDK 25)** | Tomcat `spring.threads.virtual.enabled=true` |
| Kafka Consumer 병렬화 | `concurrency: N` (≤ partition 수) | partition 보다 크면 idle |

### 절대 하지 말 것

- 락 안에서 외부 IO (HTTP/DB) 호출 — deadlock + 풀 고갈 직행
- Double-Checked Locking 에 `volatile` 빼먹기 — JMM 위반
- `ThreadLocal` 을 ThreadPool 환경에서 `remove()` 안 하기 — 메모리 누수 + 다른 요청에 leak
- `Collections.synchronizedXxx` 에 iterator 돌리기 — 외부 동기화 필요
- `synchronized` 블록 안에서 `wait()` 빼고 `Thread.sleep()` — 다른 스레드 다 멈춤
- 단발 thread dump 로 stuck 판정 — *반드시* 3-5회 비교
- 락을 무한히 잡고 외부 호출 — `tryLock(timeout)` 또는 외부 IO 분리 필수

---

## Phase 별 학습 시간 배분 (권장)

| Phase | 파일 | 시간 | 누적 |
|---|---|---|---|
| 1. 기본 프리미티브 | 01-08 | 8h | 8h |
| 2. JVM 내부 + 고수준 | 09-19 | 14h | 22h |
| 2.5. 운영 진단 | 20-21 | 3h | 25h |
| 3. msa 점검 | 22 | 2h | 27h |
| 산출물 | 23-24 | 3h | 30h |

---

## 학습 진행 가이드

- **권장 순서**: 01 → 24 직진 (의존 그래프 따라 작성됨)
- **Phase 1 (01-08)** 은 의존성이 강하니 순서대로
- **Phase 2 (09-19)** 는 09 → 10 → 11 까지는 순서, 그 다음 13 (CF), 14-16 (coroutine), 17 (VT) 로 분기 가능
- **Phase 2.5 (20-21)** 는 학습 후 즉시 회사 stage 환경에서 jstack 1회 떠보기를 권장 — 실전 자산화
- **Phase 3 (22)** 는 msa 코드 직접 grep 하면서 따라갈 것 (이 파일에 grep 명령 그대로 수록)
- **24-interview-qa.md** 는 회독용 — 학습 종료 후 1주일 간격 2-3회 회독

각 파일 호출:
```
/study:start 3            # 다음 deep file 자동 선택
/study:start 3 14         # 14-coroutine-internals.md 직접 지정
```
