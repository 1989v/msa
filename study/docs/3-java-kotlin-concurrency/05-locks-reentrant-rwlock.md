---
parent: 3-java-kotlin-concurrency
seq: 05
title: ReentrantLock + ReadWriteLock + Condition
type: deep
created: 2026-05-01
---

# 05. ReentrantLock + ReadWriteLock + Condition

## 핵심 한 줄

`java.util.concurrent.locks` 의 락 패밀리는 **`synchronized` 가 못 하는 것들** 을 채워준다 — `tryLock(timeout)`, `lockInterruptibly`, fairness, 다중 `Condition`, 읽기/쓰기 분리. 단 단순한 동기화엔 `synchronized` 로 충분하니 *이 도구가 필요한 이유* 가 명확해야 사용한다.

## ReentrantLock 의 차별점

```kotlin
import java.util.concurrent.locks.ReentrantLock

val lock = ReentrantLock()
val condition = lock.newCondition()

fun work() {
    lock.lock()
    try {
        // critical section
    } finally {
        lock.unlock()           // 반드시 finally
    }
}
```

| 기능 | `synchronized` | `ReentrantLock` |
|---|---|---|
| 기본 락/언락 | 자동 | 명시적 (try-finally 필수) |
| 재진입 | OK | OK (이름 그대로) |
| `tryLock()` | 불가 | 가능 — 락 못 잡으면 false |
| `tryLock(timeout)` | 불가 | 가능 — 일정 시간 대기 |
| `lockInterruptibly()` | 불가 | 가능 — 대기 중 interrupt 받음 |
| Fair lock | 불가 | `ReentrantLock(true)` 로 가능 (FIFO) |
| 여러 Condition | 1개 (`wait/notify`) | N 개 (`newCondition()` 여러 번) |
| `Condition.await/signal` | wait/notify | 더 표현력 있는 wait/notify |
| 성능 | 매우 강한 JIT 최적화 | 표준 구현 |

### `tryLock` 실무 패턴

```kotlin
if (lock.tryLock(500, TimeUnit.MILLISECONDS)) {
    try {
        // 락 획득 성공
        doWork()
    } finally {
        lock.unlock()
    }
} else {
    // 타임아웃 → fallback (캐시, 큐 적재 등)
    log.warn { "lock acquisition timeout, skipping" }
}
```

→ 락 contention 시 무한 대기 대신 fallback. msa 처럼 외부 트래픽 받는 서비스에선 **데드라인 보호** 필수 (latency budget, ADR-0025 참고).

### `lockInterruptibly` 패턴

```kotlin
try {
    lock.lockInterruptibly()
    try { doWork() }
    finally { lock.unlock() }
} catch (e: InterruptedException) {
    // 락 대기 중 interrupt 받음 → 종료 처리
    Thread.currentThread().interrupt()
    return
}
```

`synchronized` 는 BLOCKED 중 interrupt 못 받음. shutdown 시 응답성이 중요한 코드면 `ReentrantLock + lockInterruptibly` 또는 `synchronized` 자체를 피하기.

## Fair vs Unfair Lock

```kotlin
val unfair = ReentrantLock()           // 기본
val fair = ReentrantLock(true)         // FIFO 보장
```

| 측면 | Unfair (default) | Fair |
|---|---|---|
| 락 풀린 직후 큐 우선순위 | 무관 (먼저 도착이 이김) | FIFO |
| starvation 가능성 | 있음 (운 나쁘면 영원히 못 잡음) | 없음 |
| 처리량 | 높음 | 낮음 (큐잉 오버헤드) |
| 평균 응답 시간 | 짧음 | 길지만 균등 |

**대부분 unfair 가 정답**. fair 는 starvation 이 비즈니스 문제일 때만 (예: 백그라운드 잡이 webhook 핸들러에 영원히 밀리는 상황).

## Condition — 다중 wait queue

`Object.wait/notify` 는 한 monitor 에 wait queue 가 1개. `Lock + Condition` 은 N 개 만들 수 있다.

```kotlin
class BoundedBuffer<T>(private val capacity: Int) {
    private val lock = ReentrantLock()
    private val notFull = lock.newCondition()
    private val notEmpty = lock.newCondition()
    private val items = ArrayDeque<T>()

    fun put(item: T) {
        lock.lock()
        try {
            while (items.size == capacity) notFull.await()
            items.addLast(item)
            notEmpty.signal()    // empty 대기자만 깨움 (전체 X)
        } finally {
            lock.unlock()
        }
    }

    fun take(): T {
        lock.lock()
        try {
            while (items.isEmpty()) notEmpty.await()
            val item = items.removeFirst()
            notFull.signal()
            return item
        } finally {
            lock.unlock()
        }
    }
}
```

- `notFull` 큐 와 `notEmpty` 큐 분리 → `notifyAll` 로 모두 깨운 뒤 다시 sleep 하는 낭비 없음.
- producer-consumer 의 정석.

## ReadWriteLock — 읽기 다대다 / 쓰기 1

```kotlin
import java.util.concurrent.locks.ReentrantReadWriteLock

val rwLock = ReentrantReadWriteLock()
val readLock = rwLock.readLock()
val writeLock = rwLock.writeLock()

fun get(key: String): String? {
    readLock.lock()
    try { return cache[key] }
    finally { readLock.unlock() }
}

fun put(key: String, value: String) {
    writeLock.lock()
    try { cache[key] = value }
    finally { writeLock.unlock() }
}
```

규칙:
- read 끼리는 동시 진행 OK
- read 와 write 는 상호배제
- write 끼리도 상호배제

### ReadWriteLock 이 항상 빠른가? — **아니다**

| 시나리오 | RWLock 적합? |
|---|---|
| Read 95%, Write 5%, critical section 길다 (수ms+) | 적합 |
| Read 99%, Write 1%, critical section 매우 짧음 (수십 ns) | 부적합 — `synchronized` 가 더 빠름 |
| Read 60%, Write 40% | 부적합 — 일반 락 |
| Read-mostly + 캐시 | `ConcurrentHashMap` 또는 immutable + `volatile` swap |

`ReadWriteLock` 자체 오버헤드가 일반 락보다 크다 — read 카운터 + write 비트 관리. critical section 이 길어야 그 비용을 상쇄한다.

### 다운그레이드 / 업그레이드

- **다운그레이드** (write → read) — `ReentrantReadWriteLock` 에서 가능. write lock 을 들고 read lock 을 추가로 잡은 뒤 write 해제.
  ```kotlin
  writeLock.lock()
  try {
      // write 작업
      readLock.lock()  // 다운그레이드 시작
  } finally {
      writeLock.unlock()
  }
  try {
      // read 작업 (다른 write 는 못 들어옴? read 만 잡았으니 OK)
  } finally {
      readLock.unlock()
  }
  ```
- **업그레이드** (read → write) — *불가*. deadlock 위험 (두 read 가 동시에 업그레이드 시도하면 영원히 대기).

### `synchronized` 대비 단점

- 락 안에서 `wait/notify` 못 씀 → `Condition` 으로 대체
- API 가 더 verbose
- JIT (Just-In-Time compilation, 즉시 컴파일) 최적화는 일반 락 (편향/경량) 만큼 강하지 않음
- read-write 분리가 *진짜 이득* 인지 측정해야 함

## Lock의 내부 — AQS (AbstractQueuedSynchronizer)

`ReentrantLock`, `Semaphore`, `CountDownLatch`, `ReentrantReadWriteLock`, `FutureTask` 모두 **AQS (AbstractQueuedSynchronizer) 기반**.

AQS 핵심:
- `volatile int state` — 락 보유자 카운트, semaphore 토큰, latch count 등 자유롭게 의미 부여
- **CLH 큐** (CAS 기반 lock-free linked list) — 대기 스레드 큐
- `tryAcquire(int)` / `tryRelease(int)` — 서브클래스가 구현
- `acquire(int)` — `tryAcquire` 시도 → 실패 시 큐에 enqueue + `LockSupport.park()` (= WAITING)

```
state = 0  → 락 비어있음
state = 1  → 한 번 잡힘 (재진입 카운트 1)
state = 2  → 재진입 카운트 2
```

ReentrantLock 의 `tryAcquire(1)`:
1. CAS 로 `state` 0 → 1 시도. 성공하면 owner = currentThread, return true.
2. 이미 owner 가 currentThread → state 증가 (재진입), return true.
3. 다른 스레드 owner → return false (큐로 들어감).

이 구조 덕분에 단일 atomic 변수 (`state`) 로 다양한 동기화 도구가 만들어진다.

## msa 코드 사례 (가상)

msa 코드베이스엔 명시적 `ReentrantLock` 사용은 거의 없다 — 대부분 `synchronized` 또는 `ConcurrentHashMap` 또는 coroutine `Mutex` 로 해결. 다만 다음 같은 시나리오라면 도입 가치:

```kotlin
class WebhookProcessor(private val maxInflight: Int) {
    private val lock = ReentrantLock()
    private val notFull = lock.newCondition()
    private var inflight = 0

    fun submit(webhook: Webhook): Boolean {
        if (!lock.tryLock(100, TimeUnit.MILLISECONDS)) return false
        try {
            while (inflight >= maxInflight) {
                if (!notFull.await(500, TimeUnit.MILLISECONDS)) {
                    return false   // 대기 타임아웃 → 거부
                }
            }
            inflight++
        } finally {
            lock.unlock()
        }
        // 처리 (락 밖에서!)
        process(webhook)
        return true
    }

    fun done() {
        lock.lock()
        try {
            inflight--
            notFull.signal()
        } finally {
            lock.unlock()
        }
    }
}
```

webhook 동시 처리 한도 + 타임아웃 보호. `synchronized + wait/notify` 로도 가능하지만 timeout 이 깔끔히 안 되어서 `Lock + Condition` 이 적합.

## 면접 단골

**Q. `ReentrantLock` 을 `synchronized` 대신 쓰는 이유?**

가장 큰 이유 셋: **(1) `tryLock(timeout)`**, **(2) `lockInterruptibly`**, **(3) 다중 `Condition`**. 그 외 fairness 옵션, 락 보유 상태 query (`isLocked`, `getHoldCount`) 도 있다. 단순한 동기화는 `synchronized` 가 JIT 최적화 측면에서도 동등 또는 더 빠르니까 일부러 ReentrantLock 으로 갈 이유 없음.

**Q. `ReadWriteLock` 이 일반 락보다 항상 빠른가?**

아니다. critical section 이 짧고 read 비율이 압도적이면 일반 락 + JIT 최적화가 더 빠를 수도 있다. RWLock 의 read/write 카운터 관리 자체에 오버헤드가 있어서 critical section 이 그 비용보다 충분히 길어야 이득. 일반적으로 *수 µs 이상의 read-heavy critical section* 에서 가치.

**Q. `StampedLock` 과 `ReadWriteLock` 차이?**

`StampedLock` 은 **optimistic read** 를 지원 — 락 획득 없이 read 시도 후 validate. 매우 가벼운 read. 단 (1) 재진입 안 됨, (2) `Condition` 없음, (3) interrupt 안 됨. read 가 압도적으로 많고 short 하면 `StampedLock`, 일반 read-write 분리는 `ReadWriteLock`. 자세한 건 [12-stampedlock.md](12-stampedlock.md).

**Q. `Lock.lock()` 호출 후 try-finally 안 쓰면?**

critical section 안에서 예외가 throw 되면 락이 영원히 풀리지 않음. 다른 스레드 전부 BLOCKED → 데드락. 그래서 `lock.lock(); try { ... } finally { lock.unlock() }` 패턴이 *반드시*. Kotlin 에선 `lock.withLock { ... }` extension 으로 try-finally 자동 처리 가능 (`kotlin.concurrent.withLock`).

```kotlin
import kotlin.concurrent.withLock
lock.withLock {
    // critical section
}  // unlock 자동
```

## 다음 학습

- [06-threadlocal.md](06-threadlocal.md) — ThreadLocal
- [12-stampedlock.md](12-stampedlock.md) — StampedLock
