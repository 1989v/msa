---
parent: 3-java-kotlin-concurrency
seq: 02
title: synchronized + monitor 패턴
type: deep
created: 2026-05-01
---

# 02. synchronized + monitor

## 핵심 한 줄

`synchronized` 는 **JVM 내장 락(intrinsic lock = monitor)** 을 사용하는 가장 기본적인 동기화 도구. **원자성 + 가시성** 을 동시에 보장하며, JIT 가 적극적으로 최적화한다 (편향 락 → 경량 락 → 중량 락 단계적 inflation; 자세한 건 [10-synchronized-internals.md](10-synchronized-internals.md)).

## monitor 의 정체

모든 Java 객체는 **헤더(Mark Word)에 monitor 슬롯**을 갖는다. monitor 는:

- **소유 스레드 1개** + **재진입(reentrancy) 카운터** + **대기 큐** + **wait 큐** 로 구성.
- **재진입 가능** — 같은 스레드가 같은 락을 여러 번 잡으면 카운터만 증가, deadlock 안 남.

```kotlin
synchronized(lock) {
    synchronized(lock) {  // 같은 스레드라 재진입 OK
        // 카운터 = 2
    }
    // 카운터 = 1
}
// 카운터 = 0, 락 해제
```

## 4가지 사용 형태

```kotlin
class Counter {
    private var count = 0
    private val lock = Any()

    // 1) 인스턴스 메서드 → this 락
    @Synchronized
    fun incA() { count++ }

    // 2) 메서드 안 블록 → this 락
    fun incB() {
        synchronized(this) { count++ }
    }

    // 3) 별도 락 객체
    fun incC() {
        synchronized(lock) { count++ }
    }

    // 4) 클래스 메서드 → 클래스 객체 락
    companion object {
        @JvmStatic
        @Synchronized
        fun staticInc() { /* Counter::class.java 락 */ }
    }
}
```

### 인스턴스 락 vs 클래스 락 — 흔한 함정

```kotlin
class Foo {
    @Synchronized fun a() { /* this 락 */ }
    companion object {
        @JvmStatic @Synchronized fun b() { /* Foo::class.java 락 */ }
    }
}
```

`Foo().a()` 와 `Foo.b()` 는 **다른 락**이다. 같은 데이터를 보호하려면 둘 중 하나로 통일해야 한다.

### `this` 락의 위험

```kotlin
class Service {
    @Synchronized
    fun doWork() { /* ... */ }
}

// 외부에서:
val svc = Service()
synchronized(svc) {  // 같은 락! 외부가 svc 를 잡아버림
    Thread.sleep(60_000)
}
svc.doWork()  // 60초 대기
```

→ 실무에선 **private final 락 객체**를 별도로 두는 게 안전.

```kotlin
private val lock = Any()
fun doWork() = synchronized(lock) { /* ... */ }
```

## wait / notify / notifyAll

`synchronized` 안에서만 호출 가능. monitor 를 놓고 wait 큐에 들어간다.

```kotlin
class BoundedBuffer<T>(private val capacity: Int) {
    private val items = ArrayDeque<T>()
    private val lock = Any()

    fun put(item: T) {
        synchronized(lock) {
            while (items.size == capacity) {  // while! if 아님
                (lock as Object).wait()
            }
            items.addLast(item)
            (lock as Object).notifyAll()
        }
    }

    fun take(): T {
        synchronized(lock) {
            while (items.isEmpty()) {
                (lock as Object).wait()
            }
            val item = items.removeFirst()
            (lock as Object).notifyAll()
            return item
        }
    }
}
```

### 왜 `if` 가 아니라 `while`?

**Spurious wakeup** — `wait()` 은 아무 이유 없이 깨어날 수 있다 (POSIX 명세). 그래서 깨어난 직후 조건을 다시 검증해야 한다. `if` 로 쓰면 spurious wakeup 시 조건이 안 맞는데 진행해버린다.

```java
// 잘못
if (items.isEmpty()) lock.wait();
return items.removeFirst();   // spurious wakeup 시 IndexOutOfBounds

// 정답
while (items.isEmpty()) lock.wait();
return items.removeFirst();
```

### `notify` vs `notifyAll`

- `notify()` — wait 큐에서 *임의의 1개* 만 깨움.
- `notifyAll()` — wait 큐 *전체* 깨움.

기본은 **`notifyAll`**. `notify` 는 깨운 스레드가 마침 조건을 만족하지 못하면 deadlock 위험 (다른 스레드는 영원히 깨어나지 못함). 성능 미세 최적화로 `notify` 쓰는 건 `Lock + Condition` 으로 대체하는 게 안전.

### Kotlin 의 wait/notify 어색함

코틀린은 `Any` 에 `wait/notify` 가 노출 안 된다 (Java `Object` 메서드인데 Kotlin 이 가렸음). 그래서 `(lock as Object).wait()` 처럼 캐스팅 필요. 실무에선 거의 항상 `ReentrantLock + Condition` 또는 `BlockingQueue` 또는 coroutine `Channel` 로 대체한다.

## 락 범위(scope) 줄이기 — 가장 중요한 실무 규칙

```kotlin
// 잘못 — 락 안에서 외부 IO
synchronized(lock) {
    val data = fetchFromRemote()   // HTTP, 100ms
    cache[key] = data              // 0.001ms
}

// 정답 — 락 밖에서 IO, 락 안엔 자료구조 갱신만
val data = fetchFromRemote()
synchronized(lock) {
    cache[key] = data
}
```

**락 안에서 외부 IO 호출 = 사고의 99%**. 락 잡은 스레드가 IO 대기하는 동안 다른 스레드 전부 `BLOCKED` → 풀 고갈 → 서비스 hang. msa 같은 MSA 환경에선 외부 호출이 풀 한 번 잡으면 캐스케이드로 전파된다.

> **연관 ADR** — `quant` 의 ADR-0020 "Transactional 외부 IO 분리" 가 정확히 같은 원리. 락이든 트랜잭션이든 "외부 IO 와 동시에 잡지 말라" 는 동일.

## Double-Checked Locking — 반드시 `volatile`

지연 초기화의 표준 패턴. 그러나 `volatile` 빼면 **JMM 위반으로 깨진 인스턴스 노출**.

```kotlin
class Lazy {
    @Volatile  // 필수!
    private var instance: Foo? = null

    fun get(): Foo {
        val local = instance       // 1차 read (volatile)
        if (local != null) return local
        return synchronized(this) {
            val l = instance       // 2차 read
            if (l != null) l else {
                val n = Foo()      // (a) 객체 할당
                                   // (b) 생성자 실행
                instance = n       // (c) 참조 대입
                                   // volatile 없으면 (a)(c) → (b) 재배열 가능
                                   // 다른 스레드가 부분 초기화된 인스턴스 봄
                n
            }
        }
    }
}
```

→ 차라리 Kotlin `lazy { }` 또는 `object` 싱글톤 (둘 다 thread-safe) 쓰는 게 안전.

## msa 코드 사례

```kotlin
// analytics/EventIngestionConsumer.kt:27
synchronized(bufferLock) {
    buffer.add(event)
    if (buffer.size >= batchSize) {
        flush()
    }
}
```

- 단일 컨슈머 스레드에서만 호출되면 사실 락 불필요지만, `flush()` 가 별도 스케줄러에서도 호출될 수 있어 보호.
- `flush()` 는 락 안에서 호출 → ClickHouse 인서트가 락 안에 들어가면 위험. 코드 검토 시 flush 가 in-memory swap 인지 외부 IO 인지 확인 필요.

## ReentrantLock 으로 대체해야 하는 시점

| 요건 | synchronized | ReentrantLock |
|---|---|---|
| 가장 단순한 동기화 | 충분 | 과함 |
| `tryLock(timeout)` 필요 | 불가 | 가능 |
| `lockInterruptibly()` 필요 | 불가 (`synchronized` 는 interrupt 안 받음) | 가능 |
| Fair lock | 불가 | 가능 |
| 다중 Condition (다른 조건별 wait queue) | `notifyAll` 만 가능 | `Condition` N 개 가능 |
| JIT 최적화 (편향/경량 락) | 매우 강함 | 일반 ReentrantLock |

대부분 `synchronized` 로 충분. `ReentrantLock` 은 위 요건 중 하나 이상이 필요할 때만.

## `synchronized` 의 실수 패턴

### 1. 박싱된 정수 락

```kotlin
private val lock: Long = 1L  // ❌ Long 박싱, 같은 박싱 인스턴스 보장 안 됨
synchronized(lock) { ... }
```

→ 락 객체는 **불변(non-mutable) reference, 명확한 식별성**. `Any()` 또는 명시적 `Object()` 권장.

### 2. String 락

```kotlin
synchronized("MY_LOCK") { ... }  // ❌ String pool, 다른 코드가 같은 리터럴로 락 가능
```

### 3. 락 객체를 외부에 노출

```kotlin
class Foo {
    val lock = Any()   // ❌ public, 외부가 잡을 수 있음
}
```

## 면접 단골

**Q. `synchronized` 의 가시성 보장은 어떻게 동작하나?**

JMM 의 **monitor lock rule** — `unlock` 은 후속 같은 monitor 의 `lock` 에 happens-before 한다. 즉 락 해제 직전의 모든 메모리 변경은 락 획득 직후의 코드에서 *반드시* 보이게 된다. 그래서 `synchronized` 는 락 자체의 상호배제뿐 아니라 가시성도 같이 해결한다.

**Q. `synchronized` 와 `ReentrantLock` 성능 차이?**

JDK 6 이후로는 거의 비슷. JIT 가 `synchronized` 를 편향 락 → 경량 락 → 중량 락으로 단계 inflation 하면서 contention 낮을 땐 ReentrantLock 보다 빠르기까지 하다. JDK 15 부터 편향 락이 deprecate, JDK 18 부터 default off (JEP 374). 그래도 여전히 `synchronized` 가 표현력은 부족해도 단순함과 JIT 최적화 측면에서 1순위.

**Q. `synchronized` 가 interrupt 를 못 받는다는 건 무슨 의미?**

`synchronized` 진입 대기 중 `BLOCKED` 상태에선 `Thread.interrupt()` 를 호출해도 깨어나지 못한다. 락이 풀려야만 진행. 반면 `ReentrantLock.lockInterruptibly()` 는 interrupt 신호를 받으면 `InterruptedException` 을 throw 하면서 빠져나온다. 그래서 응답성이 중요한 경로에선 `ReentrantLock` 쪽이 안전.

**Q. monitor 와 mutex 차이?**

monitor 는 mutex (상호배제) + condition variable (wait/notify) 을 묶어놓은 *고수준* 추상. JVM 의 monitor 는 OS 의 mutex 를 *경쟁 시에만* 사용 (heavyweight lock 단계). contention 낮을 땐 CAS 만으로 락 흉내내고 OS mutex 까지 안 내려간다 (lightweight lock).

## 다음 학습

- [03-volatile-memory-visibility.md](03-volatile-memory-visibility.md) — 가시성만 필요할 때
- [05-locks-reentrant-rwlock.md](05-locks-reentrant-rwlock.md) — `ReentrantLock`, `Condition`
- [10-synchronized-internals.md](10-synchronized-internals.md) — Mark Word, lock 진화
