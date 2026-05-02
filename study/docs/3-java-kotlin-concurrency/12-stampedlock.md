---
parent: 3-java-kotlin-concurrency
seq: 12
title: StampedLock + Optimistic Read
type: deep
created: 2026-05-01
---

# 12. StampedLock

## 핵심 한 줄

`StampedLock` (Java 8+) 은 **락 획득 없이 read 시도 후 validate** 하는 *optimistic read* 모드를 추가한 동기화 도구. read 가 매우 짧고 압도적이면 `ReentrantReadWriteLock` 보다 빠르다. 대신 **재진입 안 됨, Condition 없음, interrupt 안 받음** — 일반 락 대체재가 아니라 *특수 케이스용*.

## 3가지 모드

| 모드 | 획득 메서드 | 비고 |
|---|---|---|
| **Optimistic Read** | `tryOptimisticRead()` | 락 안 잡음, stamp 만 받음 → validate 필요 |
| **Read** | `readLock()` | RWLock 의 read lock 과 동일 (pessimistic) |
| **Write** | `writeLock()` | RWLock 의 write lock 과 동일 |

stamp = `long` 값. write 가 일어날 때마다 변함. validate 는 "이 stamp 가 그동안 안 바뀌었나" 검사.

## Optimistic Read 패턴

```kotlin
import java.util.concurrent.locks.StampedLock

class Point {
    private var x = 0.0
    private var y = 0.0
    private val lock = StampedLock()

    fun distanceFromOrigin(): Double {
        var stamp = lock.tryOptimisticRead()    // 1. stamp 받음 (락 X)
        var curX = x; var curY = y              // 2. 그냥 read (race 가능!)
        if (!lock.validate(stamp)) {            // 3. write 가 끼어들었나 검증
            stamp = lock.readLock()             // 4. fallback to read lock
            try {
                curX = x; curY = y
            } finally {
                lock.unlockRead(stamp)
            }
        }
        return sqrt(curX * curX + curY * curY)
    }

    fun move(dx: Double, dy: Double) {
        val stamp = lock.writeLock()
        try {
            x += dx; y += dy
        } finally {
            lock.unlockWrite(stamp)
        }
    }
}
```

### 동작
1. `tryOptimisticRead()` — write lock 보유자 없으면 0 이 아닌 stamp 반환 (있으면 0)
2. 일반 변수 read — *write 가 동시에 일어나면 inconsistent 한 값 볼 수 있음*
3. `validate(stamp)` — stamp 시점부터 지금까지 write 가 한 번도 없었으면 true
4. 실패 시 → 정통 read lock 으로 재시도

### 핵심: read 한 값을 *로컬 복사* 후 validate

```kotlin
// ❌ 잘못된 패턴
var stamp = lock.tryOptimisticRead()
if (lock.validate(stamp)) {
    return doSomethingWith(x, y)  // x, y 를 다시 read! validate 후에 write 끼어들 수 있음
}

// ✅ 올바른 패턴
var stamp = lock.tryOptimisticRead()
val curX = x; val curY = y    // 일단 로컬 복사
if (!lock.validate(stamp)) { /* fallback */ }
return doSomethingWith(curX, curY)
```

## ReadWriteLock 대비 장단점

### 장점
- **read 가 락을 안 잡음** → contention 폭증해도 read throughput 거의 일정
- read lock 의 reader counter 갱신 (CAS) 비용도 절약

### 단점 — *심각하게* 알아야 할 한계

| 한계 | 설명 |
|---|---|
| **재진입 불가** | `readLock()` 들고 또 `readLock()` → 영원히 대기 (deadlock) |
| **Condition 없음** | `wait/await` 패턴 못 만듦 |
| **interrupt 받지 않음** | `lockInterruptibly` 같은 메서드 없음 (Java 10+ 에 일부 추가) |
| **read → write 업그레이드 위험** | `tryConvertToWriteLock(stamp)` 가능하지만 실패 시 unlock 후 재시도 |
| **스택 락이 아님** | unlock 안 하면 monitor 검출도 안 됨 (RuntimeException 아니라 그냥 leak) |
| **fairness 없음** | starvation 가능 |

## 재진입 deadlock 예제

```kotlin
val lock = StampedLock()
val s1 = lock.readLock()
val s2 = lock.readLock()    // 같은 스레드라도 fresh acquire — 정상
lock.unlockRead(s2)
lock.unlockRead(s1)
```

→ readLock 은 재진입 *되긴* 함 (실제로는 새 stamp). 다만 ReentrantLock 의 의미와 다르고, write lock 이 대기 중이면 starvation 발생.

```kotlin
val lock = StampedLock()
val s1 = lock.writeLock()
val s2 = lock.writeLock()   // ❌ deadlock — 같은 스레드인데 영원 대기
```

→ `synchronized` / `ReentrantLock` 처럼 알아서 재진입 안 해줌.

## tryConvert — 락 모드 업그레이드/다운그레이드

```kotlin
var stamp = lock.tryOptimisticRead()
if (!lock.validate(stamp)) {
    stamp = lock.readLock()
}
try {
    while (someCondition) {
        val newStamp = lock.tryConvertToWriteLock(stamp)
        if (newStamp != 0L) {
            stamp = newStamp
            // write
            break
        } else {
            lock.unlockRead(stamp)
            stamp = lock.writeLock()
        }
    }
} finally {
    lock.unlock(stamp)
}
```

복잡도가 커서 잘못 쓰기 쉬움.

## 적합한 상황

| 시나리오 | StampedLock 적합? |
|---|---|
| Read 99%, write 1%, 매우 짧은 critical section (점/벡터 같은 즉시 read) | **적합** |
| Read 50% / write 50% | 부적합 — 일반 락 |
| Critical section 길어서 wait/notify 필요 | 부적합 — Lock + Condition |
| 재진입이 필요 | 부적합 — ReentrantLock |
| 코드 단순성이 우선 | 부적합 — synchronized 또는 ReentrantLock |

## 실무 사용 빈도

매우 낮음. 대부분의 read-heavy 시나리오는:

1. **`ConcurrentHashMap`** — read lock-free, write 분산
2. **immutable + `volatile` swap** — 변경 시 통째로 새 객체로 교체
3. **CAS-based** — 단일 변수 swap

이걸로 안 되는 정말 좁은 케이스에서만 StampedLock.

## 면접 단골

**Q. StampedLock vs ReadWriteLock 의 차이?**

ReadWriteLock 은 항상 락 획득 (reader counter CAS 갱신). StampedLock 은 optimistic read 모드에서 *락 자체를 안 잡고* stamp 만 받아서 read 한 뒤 stamp 검증으로 일관성 확인. read contention 이 매우 심하고 critical section 이 짧으면 후자가 압승. 단 재진입 불가 + Condition 없음 + interrupt 안 받음이라 기능은 더 좁다.

**Q. optimistic read 가 race condition 을 어떻게 다루나?**

read 중 write 가 끼어들면 일관성 없는 값을 볼 수 있다 — 그래서 *로컬 복사* 후 `validate(stamp)` 로 사후 검증. 검증 실패 시 정통 read lock 으로 fallback 해서 안전하게 다시 읽는다. 즉 fast path (lock-free) + slow path (locked) 의 hybrid.

**Q. `tryOptimisticRead` 후 어떤 변수를 다시 읽으면 안 되는 이유?**

validate 가 *그 시점의* stamp 만 검증. validate 통과 후 read 한 변수는 다시 race 위험. 그래서 read 할 모든 데이터를 *validate 전에 로컬 변수로 복사* 후 validate, 통과하면 로컬 데이터 사용, 실패 시 read lock 잡고 재시도. 코드를 깔끔히 분리해야 함.

**Q. StampedLock 을 잘못 쓰면?**

(1) 재진입 시도 → 자기 자신 deadlock. (2) unlock 호출 빼먹음 → leak (synchronized 처럼 자동 unlock 안 됨). (3) optimistic read 후 validate 안 함 → race. (4) read 의 critical section 이 너무 길어서 매번 validate 실패 → fallback 만 동작 → ReadWriteLock 보다 느림. 좁은 use case 라 코드 리뷰 단계에서 정당화가 필요.

## 다음 학습

- [05-locks-reentrant-rwlock.md](05-locks-reentrant-rwlock.md) — ReentrantLock / RWLock
- [11-concurrenthashmap-internals.md](11-concurrenthashmap-internals.md) — read lock-free 의 다른 접근
