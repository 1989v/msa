---
parent: 3-java-kotlin-concurrency
seq: 08
title: Concurrent Collections
type: deep
created: 2026-05-01
---

# 08. Concurrent Collections

## 핵심 한 줄

`Collections.synchronizedXxx` 는 *글로벌 락* 1개라 거의 항상 부적절. 실무는 **`ConcurrentHashMap`, `CopyOnWriteArrayList`, `ConcurrentLinkedQueue`, `BlockingQueue`** 4종을 상황에 맞게.

## 자료구조 가족도

```
java.util.concurrent
├── Map
│   ├── ConcurrentHashMap          ← 표준
│   ├── ConcurrentSkipListMap      ← 정렬 필요 (TreeMap 대체)
│
├── List/Set
│   ├── CopyOnWriteArrayList       ← read 압도, write 드물 때
│   ├── CopyOnWriteArraySet        ← 동일
│
├── Queue/Deque (non-blocking)
│   ├── ConcurrentLinkedQueue      ← MPMC, lock-free
│   ├── ConcurrentLinkedDeque      ← 양방향
│
├── BlockingQueue (생산자-소비자)
│   ├── ArrayBlockingQueue         ← 배열, capacity 고정
│   ├── LinkedBlockingQueue        ← linked, capacity optional
│   ├── SynchronousQueue           ← 0-capacity, hand-off
│   ├── PriorityBlockingQueue      ← 우선순위
│   ├── DelayQueue                 ← 시간 만료 후 소비
│   ├── LinkedTransferQueue        ← Linked + transfer (생산자 대기)
│
└── Sync 도구
    ├── Semaphore
    ├── CountDownLatch
    ├── CyclicBarrier
    ├── Phaser
```

## `Collections.synchronizedXxx` 의 한계

```kotlin
val syncList = Collections.synchronizedList(ArrayList<String>())
syncList.add("a")             // 락 OK
syncList.contains("b")        // 락 OK

// 하지만 iteration 은 외부 동기화 필요
synchronized(syncList) {       // 외부 동기화!
    for (item in syncList) { ... }
}
```

- 메서드 단위로만 락 → **복합 연산 (check-then-act)** 은 외부 동기화 별도 필요
- 글로벌 단일 락 → 모든 read/write 가 직렬화 → 다중 코어 활용 못 함
- **거의 안 씀**, ConcurrentHashMap 등으로 대체

## ConcurrentHashMap — 표준

```kotlin
val map = ConcurrentHashMap<String, Long>()

// 기본 메서드들 모두 thread-safe
map.put("a", 1L)
map["a"]
map.remove("a")

// 복합 연산은 atomic 메서드 사용
map.putIfAbsent("a", 1L)
map.computeIfAbsent("counter") { 0L }
map.merge("counter", 1L, Long::plus)   // counter += 1, atomic
map.compute("a") { k, v -> (v ?: 0) + 1 }
```

### `computeIfAbsent` — 가장 자주 쓰는 패턴

```kotlin
// 캐시 lazy init
val cache = ConcurrentHashMap<String, ExpensiveObject>()
fun get(key: String): ExpensiveObject =
    cache.computeIfAbsent(key) { compute(it) }   // race 안 남
```

**주의**: `computeIfAbsent` 의 람다는 *해당 key 의 락 안에서* 실행됨. 람다 안에서 같은 map 의 다른 key 에 *재진입* 하면 데드락 가능 (Java 8 버그, Java 9+ 에서 ConcurrentModificationException 으로 빨리 실패).

```kotlin
// ❌ 잠재적 데드락
cache.computeIfAbsent("a") { _ ->
    cache.computeIfAbsent("b") { Foo() }
}
```

자세한 내부는 [11-concurrenthashmap-internals.md](11-concurrenthashmap-internals.md).

### `Hashtable` 과 차이

`Hashtable` 은 *모든 메서드에 `synchronized` (this)* — 글로벌 락. ConcurrentHashMap 은 bin 단위 락 (Java 8) 으로 contention 분산. **Hashtable 은 레거시, 신규 코드 금지**.

## ConcurrentSkipListMap — 정렬된 동시성 Map

`TreeMap` 의 동시성 버전. 내부는 skip list (확률적 균형 BST 대안).

```kotlin
val sorted = ConcurrentSkipListMap<Long, Order>()
sorted.put(1633000000000L, order1)
sorted.firstEntry()     // 가장 작은 key
sorted.headMap(now)     // now 이전 모든 entry (subMap, view)
```

- `pollFirstEntry()` 등 atomic 추출 가능 — 시간 기반 큐 패턴

## CopyOnWriteArrayList — read 압도적일 때

```kotlin
val listeners = CopyOnWriteArrayList<EventListener>()
listeners.add(listener)   // 내부 배열 통째로 복사 후 새 참조

// read 는 락 없이 그냥 배열 read (snapshot)
listeners.forEach { it.onEvent(event) }
```

| 측면 | 일반 List + lock | CopyOnWriteArrayList |
|---|---|---|
| read | 락 필요 | 락 없음, 매우 빠름 |
| write | O(1) amortized | **O(N) — 배열 복사** |
| iterator | fail-fast (`ConcurrentModificationException`) | snapshot, 안전 |
| 메모리 | N | 2N (복사 중 일시) |

**용도**:
- 이벤트 리스너 등록/제거 (드묾) + 발행 (잦음)
- 서버 routes/handlers 등록
- write 가 read 의 1% 미만일 때

**금물**:
- 큰 list 에 빈번한 write — 매번 전체 복사로 GC (Garbage Collection, 가비지 컬렉션) 폭발
- 핫패스 메모리 민감한 곳

## ConcurrentLinkedQueue — non-blocking MPMC

Michael-Scott non-blocking queue 알고리즘. CAS (Compare-And-Swap, 비교-교환) 만 사용, 락 없음.

```kotlin
val queue = ConcurrentLinkedQueue<Task>()
queue.offer(task)       // 항상 성공 (capacity 없음)
val t = queue.poll()    // 비어있으면 null
```

- **size() 가 O(N)** — linked list 전체 순회. 호출 자제.
- capacity 없음 → 메모리 무제한 (위험)
- producer 가 consumer 보다 빠르면 OOM (Out Of Memory, 메모리 부족)

→ **bounded 가 필요하면 BlockingQueue 가 정답**.

## BlockingQueue — 생산자-소비자의 표준

```kotlin
val queue = LinkedBlockingQueue<Task>(1000)

// Producer
queue.put(task)         // queue full 이면 블록 (대기)
queue.offer(task, 100, TimeUnit.MILLISECONDS)  // 타임아웃
queue.offer(task)       // non-blocking, full 이면 false

// Consumer
val t = queue.take()    // queue empty 면 블록
val t2 = queue.poll(100, TimeUnit.MILLISECONDS)
```

| 메서드 | full | empty | 사용 |
|---|---|---|---|
| `add` / `remove` | throw | throw | 거의 안 씀 |
| `offer` / `poll` | false / null | false / null | non-blocking |
| `offer(t,timeout)` / `poll(timeout)` | timeout 후 false / null | timeout 후 null | 일반적 |
| `put` / `take` | 무한 대기 | 무한 대기 | 풀 + worker |

### 종류 비교

| Queue | capacity | producer 대기 | 특성 |
|---|---|---|---|
| `ArrayBlockingQueue(N)` | 고정 | full 시 대기 | 메모리 안정성 |
| `LinkedBlockingQueue(N)` | 지정 (default Integer.MAX) | full 시 대기 | 일반적 |
| `SynchronousQueue` | 0 | consumer 대기 시 1:1 hand-off | newCachedThreadPool 패턴 |
| `PriorityBlockingQueue` | unbounded | 안 함 (size 무제한) | 우선순위 |
| `DelayQueue` | unbounded | 안 함 | 시간 도래 task만 take 가능 |
| `LinkedTransferQueue` | unbounded | `transfer()` 시 consumer 대기 가능 | hand-off + queueing 혼합 |

## Semaphore — 자원 카운팅

`N` 개의 permit 으로 동시 접근 제한.

```kotlin
val sem = Semaphore(10)              // 10개 동시 허용

fun callApi() {
    sem.acquire()                    // permit 획득 (대기 가능)
    try {
        externalApi.call()
    } finally {
        sem.release()
    }
}

// non-blocking
if (sem.tryAcquire()) {
    try { ... } finally { sem.release() }
}
```

- **DB connection 풀, 외부 API 호출 동시성 제한** 등에 사용
- `Semaphore(1)` 은 mutex 와 같지만 일반 락 쓰는 게 의도 명확

## CountDownLatch — 한 번 쓰는 동기화 게이트

```kotlin
val latch = CountDownLatch(3)

repeat(3) { i ->
    Thread {
        doWork(i)
        latch.countDown()
    }.start()
}

latch.await()    // 3개 다 끝날 때까지 대기 (또는 timeout)
println("all done")
```

- count = 0 되면 모든 `await` 풀림
- **재사용 불가** (한 번 0 되면 영구 0). 재사용 필요하면 `CyclicBarrier`.
- 테스트에서 동시 시작 / 동시 종료 보장에 자주 사용.

## CyclicBarrier — 반복 동기화 게이트

```kotlin
val barrier = CyclicBarrier(3) {
    println("all reached barrier, next phase")
}

repeat(3) {
    Thread {
        phase1()
        barrier.await()    // 3개 다 도착할 때까지 대기
        phase2()
        barrier.await()    // 다시 동기화
    }.start()
}
```

- 모든 스레드가 도착하면 `Runnable` 실행 후 진행
- 자동 reset → 반복 사용 가능
- 한 스레드가 깨지면 `BrokenBarrierException` 으로 *전원 실패*

## Phaser — 동적 참가자 + 다중 phase

`CyclicBarrier` 의 generalize. 참가자 수가 동적이고, phase 가 여러 개일 때.

```kotlin
val phaser = Phaser(1)        // controller 자신

repeat(workerCount) {
    phaser.register()
    Thread {
        phase1(); phaser.arriveAndAwaitAdvance()
        phase2(); phaser.arriveAndAwaitAdvance()
        phaser.arriveAndDeregister()
    }.start()
}
phaser.arriveAndDeregister()
```

→ 현실에선 거의 안 씀. coroutine `Job` 트리 + `joinAll` 이 보통 더 단순.

## Exchanger — 2-스레드 hand-off

두 스레드가 만나서 데이터 교환.

```kotlin
val exchanger = Exchanger<List<Item>>()

// Producer
val items = produce()
val empty = exchanger.exchange(items)   // empty buffer 받음

// Consumer
val buffer = mutableListOf<Item>()
val received = exchanger.exchange(buffer)
process(received)
```

거의 안 씀. `BlockingQueue` 가 일반적으로 더 적합.

## msa 코드 사용

```bash
$ grep -rn "ConcurrentHashMap" --include="*.kt" msa | wc -l
# 십수 곳
```

- `quant/MarketDataHub.kt:44` — `ConcurrentHashMap<Symbol, Tick>` 최신 시세 캐시
- `quant/QuantMetrics.kt:93` — `ConcurrentHashMap<String, Counter>` 메트릭 캐시
- `auth/AuthService.kt:25` — `ConcurrentHashMap<String, String> refreshTokenStore` (in-memory, 단일 인스턴스 전제)

`ClickHouseAuditLogPublisher.kt:59` 의 `ConcurrentHashMap<String, Mutex>` 는 *tenant 별 coroutine Mutex* 패턴 — 깔끔한 도메인 단위 직렬화.

`ConcurrentLinkedQueue` 사용 거의 없음. `BlockingQueue` 도 명시적 사용 없음 — 대부분 coroutine `Channel` 로 대체.

## 면접 단골

**Q. `Hashtable`, `Collections.synchronizedMap`, `ConcurrentHashMap` 차이?**

`Hashtable` 은 모든 메서드에 `synchronized` (this) — 글로벌 락. 레거시. `Collections.synchronizedMap` 은 wrapper 로 같은 글로벌 락 패턴, 다만 외부 동기화로 iteration 가능. `ConcurrentHashMap` 은 Java 7 까진 segment 단위, Java 8 부턴 bin 단위 `synchronized` + CAS — contention 이 분산되고 read 는 거의 lock-free. 신규 코드는 무조건 ConcurrentHashMap.

**Q. `CopyOnWriteArrayList` 가 적합한 시나리오와 부적합한 시나리오?**

적합: 이벤트 리스너 목록처럼 *read 가 압도적이고 write 가 매우 드문* 경우. 부적합: 큰 list 에 빈번한 add/remove — 매번 배열 전체 복사라 GC 부담이 크고 latency 가 튄다. 일반 컬렉션이 빈번하게 변경되면 `ConcurrentLinkedQueue` 또는 lock + `ArrayList` 가 더 낫다.

**Q. `BlockingQueue` 의 `take()` 와 `poll()` 차이?**

`take()` 는 큐가 비어있으면 *무한 대기*. shutdown 시나리오에서 interrupt 로 깨워야 함. `poll(timeout)` 은 일정 시간 대기 후 null 반환 → graceful shutdown 과 메트릭 측정에 더 적합. 운영 코드는 거의 항상 `poll(timeout)`.

**Q. `ConcurrentLinkedQueue` 의 `size()` 가 비싼 이유?**

내부적으로 head 부터 tail 까지 순회하면서 카운팅. linked list 라 random access 안 되고, 동시 갱신 중이라 캐시된 size 도 부정확. 메트릭 등에서 호출 자제 — 차라리 별도 `LongAdder` 로 producer/consumer 가 inc/dec.

**Q. `Semaphore` 와 `Lock` 의 차이?**

`Lock` 은 1개 자원의 상호배제. `Semaphore(N)` 은 N 개 permit 의 카운팅. `Semaphore(1)` 이 `Lock` 처럼 동작하지만 reentrancy 없고 의도가 모호함. 외부 API 호출 동시성 제한 (rate limiting 의 일부) 같은 자원 카운팅이 본래 용도.

## 다음 학습

- [11-concurrenthashmap-internals.md](11-concurrenthashmap-internals.md) — CHM 내부
- [15-flow-channel.md](15-flow-channel.md) — coroutine 의 Channel (BlockingQueue 대안)
