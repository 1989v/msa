---
parent: 3-java-kotlin-concurrency
seq: 03
title: volatile 와 메모리 가시성
type: deep
created: 2026-05-01
---

# 03. volatile 와 메모리 가시성

## 핵심 한 줄

`volatile` 은 **가시성과 순서(reordering 금지)** 만 보장한다. **원자성은 보장 안 한다**. 그래서 단일 read/write 는 안전하지만 `count++` 같은 복합 연산엔 부족하다.

## 왜 가시성이 문제인가

각 CPU 코어는 자체 캐시 (L1/L2) 를 가지고, 메모리 갱신을 자기 캐시에만 반영한 채 한참 후에 메인 메모리로 flush 한다. 다른 코어에서 도는 스레드는 **이전 캐시 값을 무한히 볼 수 있다**.

```
Thread A (Core 1)              Thread B (Core 2)
  flag = true                    while(!flag) {}
       │                              │
       ▼                              ▼
  ┌──────┐                       ┌──────┐
  │ L1   │ flag=true             │ L1   │ flag=false (캐시된 값)
  └──┬───┘                       └──┬───┘
     │ (언젠가 flush)                │ (언젠가 invalidate)
     ▼                              ▼
  ┌────────────────────────────────────┐
  │  Main Memory                        │
  └────────────────────────────────────┘
```

→ B 의 루프가 **영원히 안 끝날 수** 있다. 컴파일러는 거기서 더 나아가서 `flag` read 를 루프 밖으로 꺼낼 수도 있다 (호이스팅).

## volatile 의 효과

```kotlin
@Volatile var flag: Boolean = false
```

1. **read 마다 메인 메모리에서 가져옴** (또는 캐시 invalidate 후 다시 fetch)
2. **write 즉시 메인 메모리에 flush**
3. **재배열(reordering) 금지** — volatile read 이전 코드는 read 뒤로 못 옮김, volatile write 이후 코드는 write 앞으로 못 옮김 (JMM (Java Memory Model, 자바 메모리 모델) happens-before)
4. **64-bit 변수 atomicity** — JLS 상 `long`/`double` 의 read/write 는 32-bit JVM (Java Virtual Machine, 자바 가상 머신) 에선 두 번에 나눠 일어날 수 있는데(tearing), `volatile` 붙이면 단일 atomic 으로 보장

## 가시성만 보장 — 원자성 X

```kotlin
@Volatile var count = 0
fun inc() { count++ }   // ❌ thread-safe 아님
```

`count++` 는 사실 **3단계** — read, +1, write. volatile 은 각 read/write 가 메인 메모리를 보게만 보장하지, 세 단계 사이에 다른 스레드가 끼어드는 걸 못 막는다.

```
Thread A: read count(0) → +1 → ... → write 1
Thread B:                     read count(0) → +1 → write 1
                                                       ↓
                              둘 다 1 을 썼지만 결과는 1 (2가 아님)
```

→ `AtomicInteger` 또는 `synchronized` 또는 `LongAdder` 사용.

## 사용 가이드라인

`volatile` 이 *충분한* 경우:

1. **write 가 read 와 무관** — 다른 read 결과를 갖고 write 안 함
2. **단일 변수 read/write** — 복합 연산 (read+modify+write) 아님
3. **불변 신호 플래그** — `shutdown`, `running`, `initialized` 같은 1회성 상태 변경

`volatile` 이 *부족한* 경우:

1. **counter 증가** → `AtomicLong` / `LongAdder`
2. **여러 변수 동시 갱신** (예: `x` 와 `y` 가 항상 같이 변해야 함) → `synchronized` / `Lock`
3. **read 한 값에 의존해 write** → CAS (Compare-And-Swap, 비교-교환) 또는 락

## 정석 패턴 1: shutdown flag

```kotlin
class Worker : Thread() {
    @Volatile private var running = true

    override fun run() {
        while (running) {
            doWork()
        }
    }

    fun shutdown() { running = false }
}
```

- `running` 은 단순 플래그. `volatile` 충분.
- `synchronized` 쓸 수도 있지만 overkill — read 가 압도적으로 많은 hot path.

## 정석 패턴 2: Double-Checked Locking

```kotlin
class Holder {
    @Volatile private var instance: Foo? = null

    fun get(): Foo = instance ?: synchronized(this) {
        instance ?: Foo().also { instance = it }
    }
}
```

`@Volatile` 없으면 (a) 객체 할당 → (c) 참조 대입 → (b) 생성자 실행 으로 재배열될 수 있다 (JMM 가 허용). 다른 스레드가 1차 read 에서 non-null 을 받지만 *생성자가 끝나기 전의 객체* 를 본다. 자세한 건 [02-synchronized-monitor.md](02-synchronized-monitor.md) 참고.

> Kotlin 에선 그냥 `by lazy { }` 또는 `object` 싱글톤 쓰는 게 더 안전. `lazy` 의 기본 모드는 `LazyThreadSafetyMode.SYNCHRONIZED` 로 내부적으로 같은 패턴.

## 정석 패턴 3: write-once 초기화

```kotlin
class Cache {
    @Volatile private var data: Map<String, String>? = null

    fun init(d: Map<String, String>) { data = d }   // 1회만 호출
    fun get(key: String) = data?.get(key)
}
```

- 초기화 1회 → 이후 read-only
- volatile 로 가시성만 확보, 락 불필요

## happens-before 와 volatile

JMM 의 **volatile variable rule** — `volatile` write 는 *후속* `volatile` read 에 happens-before. 즉:

```
Thread A:                   Thread B:
  data = computeData()        if (ready) {
  ready = true   // volatile     use(data)  // <- data 보장됨
                              }
```

`ready = true` 가 volatile write 이고 `if (ready)` 가 volatile read 라면, A 의 *모든* 이전 write (`data = ...`) 가 B 의 *이후* read 에 보인다. 이게 "publication 패턴" — volatile flag 하나로 *그 앞의 모든 데이터* 를 안전하게 publish 할 수 있다.

```kotlin
class Publisher {
    private var data: Map<String, String>? = null
    @Volatile private var ready = false

    fun publish(d: Map<String, String>) {
        data = d
        ready = true        // volatile write
    }

    fun read(): Map<String, String>? {
        return if (ready) data else null   // ready true 면 data 보장
    }
}
```

## happens-before 안 되는 케이스

```kotlin
// 두 변수 다 volatile 이 아니면
var x = 0
var y = 0

// Thread A
x = 1
y = 1

// Thread B
println(y)   // 1
println(x)   // 0?  → CPU/컴파일러가 재배열했을 수 있음
```

JMM 은 이런 재배열을 허용한다. **두 변수의 순서가 중요하면 둘 중 하나라도 volatile** 하거나 `synchronized` 로 묶거나 `Atomic` 사용.

## Kotlin `@Volatile` 주의

- Kotlin `@Volatile` 은 JVM 의 `volatile` 로 컴파일.
- **프로퍼티에만** — 로컬 변수에 못 붙임.
- `lateinit var` 와 같이 못 씀.
- val 에 못 붙음 (final 은 자체적으로 안전 publication 보장).

## 64-bit tearing — 거의 사라진 함정

JLS 17.7: 32-bit JVM 에서 `long`/`double` 의 read/write 는 *두 번에 나눠* 일어날 수 있다. 그래서 한 스레드가 64-bit 의 *상위 32-bit + 하위 32-bit* 가 다른 write 시점의 값으로 섞인 (= "찢어진") 값을 볼 수 있다.

```kotlin
var bigValue: Long = 0    // 32-bit JVM 에선 tearing 가능
@Volatile var safeBig: Long = 0  // 64-bit atomic 보장
```

64-bit JVM 에선 native 가 64-bit 단위 read/write 라 tearing 없음. 실무에선 OS/JVM 이 거의 다 64-bit 라 거의 무시 가능. 단 **API 명세에 "no tearing"** 이라고 적으려면 volatile 명시.

## msa 코드 예시

```kotlin
// 가상 예: shutdown 플래그
class OutboxRelay {
    @Volatile private var stopped = false

    fun start() {
        scope.launch {
            while (!stopped && isActive) {
                pollAndPublish()
                delay(1000)
            }
        }
    }

    fun stop() { stopped = true }
}
```

`quant/OutboxRelay.kt` 같은 백그라운드 잡에서 흔한 패턴. coroutine 의 `isActive` 만으로도 충분하지만 외부에서 명시적으로 종료할 수 있게 별도 플래그 두는 경우.

## 면접 단골

**Q. `volatile` 만으로 thread-safe 한 카운터 구현 가능한가?**

불가. `count++` 는 read-modify-write 3단계라 volatile 의 가시성만으론 부족. `AtomicInteger` 의 `incrementAndGet()` 또는 `synchronized` 로 묶거나, contention 매우 높은 경우 `LongAdder` 가 정답.

**Q. `volatile` 의 reordering 방지가 정확히 무슨 의미?**

JIT (Just-In-Time compilation, 즉시 컴파일)/CPU 가 명령어 재배열 (out-of-order execution) 을 통해 성능을 끌어올리는데, `volatile` write 앞에 있던 일반 write 는 *write 뒤로 옮길 수 없고*, `volatile` read 뒤에 있는 일반 read 는 *read 앞으로 옮길 수 없다*. 이걸 메모리 배리어 (memory barrier) 라고 부르고, x86 에선 `volatile` write 가 mfence 또는 lock prefix 명령어로 컴파일된다.

**Q. final 필드와 volatile 의 차이?**

`final` 은 *생성자 종료 시점에* 안전 publication 보장 — 생성된 객체 참조가 다른 스레드에 보이는 순간 final 필드 값도 함께 보인다. `volatile` 은 임의 시점의 read/write 마다. final 은 "한 번 정해지고 안 바뀜", volatile 은 "계속 바뀌는데 매번 보장". 둘 다 가시성을 다루지만 lifecycle 이 다르다.

**Q. Kotlin 의 `lateinit` 이 thread-safe 한가?**

기본은 아니다. `lateinit var` 는 단순 보통 변수 + 초기화 검사. 멀티스레드 환경에서 동시에 초기화하면 race. 안전한 1회 초기화는 `by lazy { }` 또는 명시적 `@Volatile + DCL`. `lazy` 의 기본 모드는 thread-safe.

## 다음 학습

- [04-atomic-cas.md](04-atomic-cas.md) — 원자적 read-modify-write
- [09-jmm-happens-before.md](09-jmm-happens-before.md) — happens-before 전체 규칙
