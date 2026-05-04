---
parent: 15-connection-pool
seq: 04
title: ConcurrentBag — Hikari 가 lock-free 인 진짜 이유
type: deep
created: 2026-05-01
---

# 04. ConcurrentBag 내부 구조

HikariCP 의 핵심 자료구조. "왜 빠른가" 의 70% 가 여기서 결정된다. 면접에서 "HikariCP 가 빠른 이유가 뭔가요?" 에 *정답* 으로 나오는 단어가 ConcurrentBag.

---

## 다른 풀이 느린 이유: synchronized

DBCP2 / 일반 BlockingQueue 기반 풀의 borrow() 흐름.

```java
// DBCP2 스타일 (단순화)
public synchronized Connection getConnection() {
    while (idleConnections.isEmpty()) {
        if (totalConnections < maxPoolSize) {
            return createNewConnection();
        }
        wait(timeout);
    }
    return idleConnections.poll();
}
```

문제점:

1. `synchronized` 가 *전체 메서드* 를 잠근다 — 100 thread 가 동시에 borrow 하면 99개가 대기
2. `wait/notify` 의 wakeup 이 *한 명만* 깨운다는 보장 없음 — thundering herd
3. JVM (Java Virtual Machine, 자바 가상 머신) 의 monitor lock 은 contention 시 OS-level mutex (heavyweight) 로 escalate

ConcurrentLinkedQueue 기반 (Tomcat JDBC) 도 CAS spin loop 가 cache line bouncing 을 일으켜 thread 수가 늘어날수록 *contention* 이 빠르게 증가.

---

## ConcurrentBag 의 3-계층 구조

```
┌────────────────────────────────────────────────────────────────┐
│  ConcurrentBag<T>                                              │
│                                                                │
│  1. ThreadLocal<List<WeakReference<T>>>  threadList            │
│     ─ borrow 한 thread 가 다음 borrow 시 *우선* 검사           │
│     ─ steal 가능하므로 WeakReference 로 GC friendly            │
│                                                                │
│  2. CopyOnWriteArrayList<T>  sharedList                        │
│     ─ 풀 전체 connection 의 master list                        │
│     ─ COW 라 read 는 lock-free, write 는 비싸지만 드뭄         │
│                                                                │
│  3. SynchronousQueue<T>  handoffQueue                          │
│     ─ "지금 막 반납된" connection 을 대기 thread 에 직접 전달   │
│     ─ borrow 가 없으면 offer() 는 그냥 false (CPU 점유 X)       │
└────────────────────────────────────────────────────────────────┘
```

---

## borrow() 알고리즘 (단순화)

```java
public T borrow(long timeout, TimeUnit unit) throws InterruptedException {
    // ① ThreadLocal: 같은 thread 가 직전에 쓴 connection 우선
    List<Object> list = threadList.get();
    for (int i = list.size() - 1; i >= 0; i--) {
        T bagEntry = list.remove(i).get();
        if (bagEntry != null && bagEntry.compareAndSet(STATE_NOT_IN_USE, STATE_IN_USE)) {
            return bagEntry;
        }
    }

    // ② sharedList 스캔 (다른 thread 가 만들어 둔 idle 도 steal)
    for (T bagEntry : sharedList) {
        if (bagEntry.compareAndSet(STATE_NOT_IN_USE, STATE_IN_USE)) {
            return bagEntry;
        }
    }

    // ③ handoffQueue 에서 대기 — 누군가 반납하면 즉시 깨어남
    timeout = unit.toNanos(timeout);
    do {
        long start = System.nanoTime();
        T bagEntry = handoffQueue.poll(timeout, TimeUnit.NANOSECONDS);
        if (bagEntry == null || bagEntry.compareAndSet(STATE_NOT_IN_USE, STATE_IN_USE)) {
            return bagEntry;
        }
        timeout -= System.nanoTime() - start;
    } while (timeout > 10_000);

    return null;  // timeout
}
```

핵심은:

- **state transition 이 CAS** (`compareAndSet`) — synchronized 없음
- **3계층은 fail-fast** 로 빠르게 옮겨 감 — ThreadLocal hit 면 lock 도 CAS 도 거의 무손실
- **handoffQueue 는 SynchronousQueue** — 대기 thread 가 없으면 offer 즉시 false, 있으면 직접 *handoff* (큐 자체가 zero-capacity)

---

## requite() (반납) 알고리즘

```java
public void requite(T bagEntry) {
    bagEntry.setState(STATE_NOT_IN_USE);

    // ① 대기 중인 borrower 가 있으면 즉시 handoff
    for (int i = 0; waiters.get() > 0; i++) {
        if (bagEntry.getState() != STATE_NOT_IN_USE
            || handoffQueue.offer(bagEntry)) {
            return;
        }
        Thread.yield();
    }

    // ② 대기자 없으면 ThreadLocal 캐시에 넣어 둠
    threadList.get().add(new WeakReference<>(bagEntry));
}
```

- 반납 시점에 *대기 thread 가 있으면* SynchronousQueue 로 *직접 전달* — 큐를 거치지 않고 thread-to-thread handoff
- 대기자 없으면 *반납한 thread 의 ThreadLocal* 에 캐싱 → 같은 thread 가 다음에 같은 connection 을 쓸 가능성 높음 (cache locality)

---

## ThreadLocal 캐싱이 왜 핵심인가

웹 서버는 보통 thread-per-request 모델이 아니라 *NIO + thread pool* 이다 (Tomcat NIO connector, Jetty). 하지만 *같은 worker thread* 가 여러 요청을 처리하므로:

- thread A 가 connection X 를 borrow → 사용 → return
- 잠시 후 thread A 가 다시 borrow → ThreadLocal 에서 X 즉시 hit
- *lock 도 CAS contention 도 없음*

이 패턴은 thread pool 크기 ≥ pool size 일 때 가장 잘 동작.

### "다른 thread 가 가져갈 수도 있는가"

YES — ThreadLocal 의 값은 *WeakReference* 라 GC 영향 받고, sharedList 스캔에서 다른 thread 가 그 connection 을 CAS steal 할 수도 있다. 그래서 borrow 의 ① 에서 `compareAndSet` 이 실패하면 다음 entry 로 이동.

### "thread 가 죽으면 ThreadLocal 은 어떻게"

WeakReference 라 GC 가 회수. sharedList 가 master list 이므로 connection 자체는 사라지지 않음.

---

## SynchronousQueue 의 역할

`SynchronousQueue` 는 *capacity 0* 의 BlockingQueue. put 은 take 가 있어야 성공, take 는 put 이 있어야 성공.

ConcurrentBag 에서 이 자료구조의 의미:

- borrow 가 timeout 을 기다리는 thread 는 `handoffQueue.poll(timeout)` 에 park
- requite 가 호출되면 `handoffQueue.offer()` 가 *즉시 그 thread 에 hand-off*
- 큐를 거치지 않으므로 *queue traversal 비용 0*
- 대기자가 없으면 offer 가 false → 일반 sharedList 경로로 fallback

이 패턴이 LinkedBlockingQueue 대비 1.5~2배 빠름 (벤치마크).

---

## 상태 머신

각 connection (HikariCP 에서는 PoolEntry) 은 4 상태.

```
       newPoolEntry()
             │
             ▼
      ┌───────────────┐
      │ NOT_IN_USE    │ ←──┐
      └─────┬─────────┘    │
            │ borrow CAS   │ requite
            ▼              │
      ┌───────────────┐    │
      │ IN_USE        │ ───┘
      └─────┬─────────┘
            │ evict / removeFromBag
            ▼
      ┌───────────────┐
      │ REMOVED       │ ──→ closeConnection()
      └───────────────┘
            │ reserve 동안
            ▼
      ┌───────────────┐
      │ RESERVED      │ (HouseKeeper 가 검사 중)
      └───────────────┘
```

상태 전이는 모두 CAS. RESERVED 는 HouseKeeper ([06-hikari-housekeeper.md](06-hikari-housekeeper.md)) 가 idle connection 을 점검할 때 잠깐 사용.

---

## "Bag" 인 이유

Java 의 `Set` / `Queue` / `List` 가 아니라 *Bag* 이다. 이유:

- **순서 보장 없음** — FIFO 도 LIFO 도 아닌 *thread-affinity* 우선
- **steal 가능** — 다른 thread 의 ThreadLocal entry 를 가져올 수 있음
- **multiset 아님** — entry 는 unique (`==` 로 비교)
- **thread 별 view** 가 다를 수 있음 — ThreadLocal 캐시

표준 컬렉션이 fit 하지 않아 새 자료구조 이름 ("ConcurrentBag") 을 만들었다는 게 Brett Wooldridge 의 설명.

---

## 벤치마크 직관

`getConnection() → close()` 만 1억번 반복 (워크로드 없음, 풀 자체 cost):

| 풀 / thread 수 | 1 thread | 16 thread | 64 thread |
|---|---|---|---|
| HikariCP | 14 ns | 19 ns | 32 ns |
| Tomcat JDBC | 320 ns | 1.5 µs | 8 µs |
| DBCP2 | 410 ns | 2.1 µs | 12 µs |

thread 수 64 일 때 DBCP2 가 12 µs/op = 1ms 에 80 회 throughput. HikariCP 는 30000 회. *연산 자체* 가 풀의 처리량을 제한할 수 있음.

---

## 면접 모의 답변

> "HikariCP 의 ConcurrentBag 은 3계층 구조다. ① 같은 thread 가 직전에 쓴 connection 을 ThreadLocal 에서 우선 가져온다 (lock 0). ② 없으면 sharedList (CopyOnWriteArrayList) 를 스캔하면서 CAS 로 NOT_IN_USE → IN_USE 전이를 시도해 *steal* 한다. ③ 그래도 없으면 SynchronousQueue 에 park 해 누군가 반납하기를 기다리고, 반납 시 큐를 거치지 않는 *direct handoff* 로 받는다. 핵심은 (1) synchronized 가 없고 모든 전이가 CAS, (2) 같은 thread reuse 시 거의 무손실, (3) 대기 시 SynchronousQueue 로 traversal 비용 0 이라는 점이다."

---

## 한계 / 함정

- **CPU 코어 수가 적은 환경 (1 vCPU)** 에서는 spin / yield 가 오히려 손해 — k3d 단일 노드에서 부하 테스트 시 이론값 안 나옴
- **풀이 작을 때 (size 2~3)** 는 ThreadLocal hit 률이 낮아 효과 작음
- ConcurrentBag 자체가 멀티-CPU 가정 — JVM 이 -XX:+UseBiasedLocking 같은 lock 최적화에 의존하지 않음

---

## 핵심 포인트

- ConcurrentBag = ThreadLocal 캐시 + CopyOnWriteArrayList sharedList + SynchronousQueue handoffQueue
- 모든 상태 전이는 CAS — synchronized 없음
- 같은 thread 가 직전 connection 을 재사용할 때 borrow 비용 ≈ 14 ns
- 큐를 거치지 않는 *direct handoff* 가 다른 풀 대비 결정적 차이

## 다음 학습

- [05-hikari-fastlist-proxy.md](05-hikari-fastlist-proxy.md) — FastList + ProxyConnection (나머지 30%)
- [06-hikari-housekeeper.md](06-hikari-housekeeper.md) — HouseKeeper 가 이 Bag 을 어떻게 청소하는가
