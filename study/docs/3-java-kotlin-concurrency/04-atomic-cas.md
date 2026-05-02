---
parent: 3-java-kotlin-concurrency
seq: 04
title: Atomic 클래스 + CAS + ABA
type: deep
created: 2026-05-01
---

# 04. Atomic + CAS

## 핵심 한 줄

`Atomic*` 은 **CAS (Compare-And-Swap) 하드웨어 명령어로 락 없이** 원자적 read-modify-write 를 구현한 lock-free 자료구조. contention 낮을 땐 락보다 훨씬 빠르고, 높을 땐 `LongAdder` 같은 striped 변형이 더 빠르다.

## CAS 동작 원리

```
CAS(addr, expected, new) {
    if (*addr == expected) {
        *addr = new
        return true
    } else {
        return false
    }
}
```

- x86 의 `lock cmpxchg` 명령어 (단일 atomic instruction)
- ARMv8 의 `LDXR/STXR` (load-exclusive / store-exclusive 페어)
- 실패하면 루프 (spin) 돌면서 재시도

```kotlin
val counter = AtomicInteger(0)
fun safeInc() {
    while (true) {
        val v = counter.get()
        if (counter.compareAndSet(v, v + 1)) return
        // CAS 실패 → 다른 스레드가 끼어듦, 재시도
    }
}
// 또는 그냥 counter.incrementAndGet() (내부적으로 같은 루프)
```

## 주요 Atomic 클래스

| 클래스 | 용도 | 비고 |
|---|---|---|
| `AtomicInteger`, `AtomicLong` | 정수 카운터 | hot path 면 `LongAdder` 검토 |
| `AtomicBoolean` | flag (set-once 도) | volatile 만으로 부족할 때 |
| `AtomicReference<T>` | 객체 참조 swap | CAS 기반 lock-free 구조 만들 때 |
| `AtomicIntegerArray` 등 | 배열 원소 단위 atomic | 배열 객체 자체는 일반 |
| `LongAdder`, `DoubleAdder` | 고contention counter | striped, get() 비싸지만 inc 빠름 |
| `LongAccumulator` | 사용자 정의 결합 함수 | min/max 같은 reduce |
| `AtomicStampedReference<T>` | reference + 버전 stamp | ABA 방어 |
| `AtomicMarkableReference<T>` | reference + boolean mark | linked list 노드 삭제 표시 |

## CAS 의 ABA 문제

CAS 는 "값이 같으면" 진행한다. **값이 같지만 사이에 변경됐다 돌아온** 경우를 구분 못 한다.

```
초기 stack: A → B → C

Thread 1: top = A 읽음, "B 로 바꿀 거야" 계산
Thread 2: pop A → push D → push A   // 결과: A → D → C
Thread 1: CAS(top, A, B)  // 성공! 하지만 stack 이 A → B 로 망가짐
                          // (B 는 이미 free 됐을 수 있음)
```

**해결**: 값에 *버전(stamp)* 을 함께 비교.

```kotlin
val ref = AtomicStampedReference("A", 0)

// pop
while (true) {
    val stamp = IntArray(1)
    val current = ref.get(stamp)
    val expected = current
    val newValue = "B"
    if (ref.compareAndSet(expected, newValue, stamp[0], stamp[0] + 1)) break
}
```

스택 push/pop 마다 stamp 증가 → 같은 값이 돌아와도 stamp 다르면 CAS 실패.

> **실무에서 ABA 가 문제 되는 빈도는 낮다** — 대부분의 atomic 사용처는 카운터/플래그/객체 swap 인데 GC 가 free-and-reuse 패턴을 차단해준다 (Java 는 C/C++ 처럼 raw memory 재활용 안 됨). lock-free queue 같은 직접 구현 자료구조에서나 본격적 문제.

## `AtomicInteger` vs `LongAdder`

| 측면 | `AtomicInteger` | `LongAdder` |
|---|---|---|
| 내부 | 단일 `volatile int` + CAS 루프 | 여러 cell (스레드별 분산) + 가끔 합계 |
| inc 비용 (low contention) | 매우 빠름 | 비슷 또는 약간 느림 |
| inc 비용 (high contention) | CAS 실패 spin 폭증 | cell 분산으로 거의 영향 없음 |
| `get()` / `sum()` | O(1) | O(N cells), 약간 비쌈 |
| 정확한 read-while-write | 보장 | 약함 (snapshot, 정확하지 않을 수 있음) |
| 용도 | 카운터, flag | hot path 카운터 (메트릭, 로그) |

```kotlin
// 메트릭 카운터 — LongAdder 가 더 빠름
val processedCount = LongAdder()
fun onMessage() { processedCount.increment() }
fun report() = processedCount.sum()   // 약간 느려도 호출 빈도 낮음
```

> **msa 코드 사례** — `EsBulkDocumentProcessor.kt:26` 의 `AtomicLong processedCount` 는 카운트 빈도 낮고 정확한 snapshot 필요해서 적절. 만약 초당 수만 건 인입이라면 `LongAdder` 로 바꿀 가치 있음.

## `AtomicReference` 로 lock-free 구조 만들기

```kotlin
class CASStack<T> {
    private val top = AtomicReference<Node<T>?>(null)

    private data class Node<T>(val value: T, val next: Node<T>?)

    fun push(value: T) {
        while (true) {
            val current = top.get()
            val newNode = Node(value, current)
            if (top.compareAndSet(current, newNode)) return
        }
    }

    fun pop(): T? {
        while (true) {
            val current = top.get() ?: return null
            if (top.compareAndSet(current, current.next)) return current.value
        }
    }
}
```

- 락 안 쓰고 멀티스레드 안전 stack.
- Treiber stack 이라 부르는 고전 알고리즘.
- 단점: 매우 높은 contention 에선 CAS 실패율이 폭증해서 결국 락보다 느려질 수 있다.

## `updateAndGet`, `accumulateAndGet` (Java 8+)

CAS 루프를 함수형으로 추상화.

```kotlin
val ref = AtomicReference(setOf<String>())
ref.updateAndGet { it + "newKey" }   // 내부적으로 CAS 루프
```

- 함수가 *순수* 해야 함 — CAS 실패 시 재실행되므로 사이드 이펙트 있으면 중복 발생.
- 객체 참조에서 collection 갱신 같은 패턴에 유용.

## `getAndAdd` vs `addAndGet` 같은 이름 규칙

- `getAndX` — *이전* 값 반환
- `XAndGet` — *새* 값 반환

```kotlin
val v = AtomicInteger(5)
v.getAndIncrement()  // 5 반환, 이제 6
v.incrementAndGet()  // 7 반환, 이제 7
```

## CAS 의 메모리 시맨틱

`compareAndSet` 은 *full memory barrier* 효과. 즉:

- CAS 이전의 모든 read/write 는 CAS 앞에 commit
- CAS 이후의 모든 read/write 는 CAS 뒤에 시작

→ `volatile` 보다 강한 동기화. `synchronized` 와 비슷한 레벨의 happens-before 보장.

```kotlin
// publication 패턴 — volatile 대신 atomic
val data = AtomicReference<Map<String, String>?>(null)

// publisher
data.set(computeData())   // CAS 와 같은 시맨틱

// reader
val d = data.get()        // 위 set 과 happens-before
```

## CAS 실패 시 spin vs back-off

기본 atomic 클래스는 *그냥 spin* (busy-wait CAS 재시도). contention 매우 높으면 CPU 100% 태우면서 진행 거의 안 함.

대안:
- **`LongAdder`** 처럼 striped 분산
- **`Thread.onSpinWait()`** (JDK 9+) — CPU 에게 spin 중임을 힌트, 효율적인 spin (x86 의 `pause` 명령어)
- **back-off** — 실패 횟수에 따라 exponential delay

```kotlin
var backoff = 1
while (true) {
    if (atomicRef.compareAndSet(...)) break
    repeat(backoff) { Thread.onSpinWait() }
    if (backoff < 1024) backoff *= 2
}
```

실무에선 거의 안 만든다 — `LongAdder` / `LinkedBlockingQueue` / `Semaphore` 등 검증된 자료구조로 우회.

## msa 코드 사례

```kotlin
// QuantMetrics.kt:239
private val wsConnectionStates = ConcurrentHashMap<String, AtomicInteger>()

fun setWsConnectionState(exchange: String, state: Int) {
    wsConnectionStates.computeIfAbsent(exchange) { AtomicInteger(state) }.set(state)
    // 또는 .compareAndSet(...) 으로 transition 검증
}

fun currentState(exchange: String): Int =
    wsConnectionStates[exchange]?.get() ?: STATE_UNKNOWN
```

- 거래소별 WebSocket 연결 상태 (CONNECTING/CONNECTED/DISCONNECTED) 를 atomic 으로.
- `ConcurrentHashMap` + `AtomicInteger` 조합이 흔한 메트릭 패턴.
- `BithumbWebSocketSubscriber.kt:106` 의 `AtomicReference<ConnectionState>` 도 동일 — 상태 enum 을 swap.

## `LongAdder` 적용 가이드

| 상황 | 추천 |
|---|---|
| HTTP 요청 카운트 (req/sec) | `LongAdder` |
| Kafka consumer lag 추적 | `AtomicLong` (정확한 read 필요) |
| 락 contention 측정 (debug) | `LongAdder` |
| 대시보드 게이지 값 | `AtomicLong` (정확성 우선) |

## 면접 단골

**Q. CAS 와 `synchronized` 중 뭘 쓰나?**

연산이 단일 변수 swap 이고 contention 이 낮거나 중간이면 CAS (atomic) 가 빠름. 복합 연산 (여러 변수 같이 갱신) 이거나 critical section 이 길면 `synchronized` 가 단순하고 안정. 매우 높은 contention 하의 카운터는 `LongAdder`. 락이 외부 IO 와 섞이면 절대 atomic 으로 못 풀고 `synchronized + 외부 IO 분리` 패턴.

**Q. `Atomic*` 이 lock-free 인 이유?**

CAS 명령어 자체가 하드웨어에서 atomic 으로 한 사이클에 수행되기 때문. OS 의 mutex 처럼 스레드를 컨텍스트 스위칭 하지 않고 즉시 성공/실패가 결정된다. 단 wait-free 는 아니다 (실패 시 spin). 실패 보장 횟수는 없으므로 contention 극단에선 starvation 가능.

**Q. `AtomicLong` 과 `volatile long` 차이?**

`volatile long` 은 read/write 의 가시성 + tearing 방지만 보장. read-modify-write (`++`) 는 atomic 아님. `AtomicLong` 은 `incrementAndGet`/`compareAndSet` 같은 RMW 메서드를 제공하면서 그것까지 atomic. 단순 read/write 만 하면 `volatile` 충분, 그 이상은 `Atomic`.

**Q. ABA 문제는 GC 있는 Java 에서도 진짜 일어나나?**

자체 구현한 lock-free 자료구조 (특히 객체 풀, 노드 재활용) 에선 일어남. 일반 카운터/플래그에선 거의 무관. JDK 가 표준 제공하는 `AtomicInteger` 류는 ABA 무관 (값 자체에 의미가 있음). 직접 lock-free queue 만들면 `AtomicStampedReference` 또는 hazard pointer 패턴 필요.

## 다음 학습

- [05-locks-reentrant-rwlock.md](05-locks-reentrant-rwlock.md) — 락 기반 동기화
- [11-concurrenthashmap-internals.md](11-concurrenthashmap-internals.md) — CAS + synchronized 조합 사례
