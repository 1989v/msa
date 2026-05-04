---
parent: 3-java-kotlin-concurrency
seq: 09
title: JMM — happens-before / synchronizes-with
type: deep
created: 2026-05-01
---

# 09. Java Memory Model (JMM) — happens-before

## 핵심 한 줄

JMM (Java Memory Model, 자바 메모리 모델) 은 **"멀티스레드에서 한 스레드의 write 가 언제 다른 스레드의 read 에 보이는지"** 의 형식 명세다. 핵심은 **happens-before 관계** — 두 액션 사이에 hb 가 성립하면 앞 액션의 모든 효과가 뒤 액션에서 보인다.

## 왜 필요한가

CPU 와 컴파일러는 single-thread 의 결과만 보존하는 한 자유롭게 재배열한다 (as-if-serial). 멀티스레드에선 다른 스레드 입장에서 그 재배열이 가시화되어 황당한 결과를 초래한다.

```kotlin
// Thread A
x = 1
ready = true

// Thread B
if (ready) {
    print(x)   // 1을 출력? 0을 출력할 수도 있음!
}
```

JMM 보장 없이는 (`ready` 와 `x` 둘 다 일반 변수) Thread A 의 두 write 가 재배열되어 B 가 `ready=true, x=0` 을 볼 수 있다.

## happens-before 의 정의 (간단판)

> A happens-before B ⇔ A 의 모든 메모리 효과가 B 에서 *반드시* 보이고, A 의 *상대적 순서* 가 B 보다 앞이라고 *프로그램이 추론할 수 있다*.

happens-before 는 **transitive** (A→B, B→C 이면 A→C) 이고 **partial order** (모든 액션이 서로 비교 가능한 건 아님).

## 핵심 규칙 8가지

### 1. Program Order Rule
같은 스레드 안에서 코드 순서대로 happens-before. 단 컴파일러/CPU 재배열은 single-thread 시맨틱을 보존하는 한 허용.

### 2. Monitor Lock Rule
`unlock(M)` happens-before *후속* `lock(M)` (같은 monitor M).

```kotlin
synchronized(m) { x = 1 }       // unlock m 시점에 x=1 commit
synchronized(m) { print(x) }    // lock m 후 x 보장
```

### 3. Volatile Variable Rule
volatile field 의 write happens-before *후속* read.

```kotlin
@Volatile var ready = false
data = expensiveComputation()    // (1)
ready = true                     // (2) volatile write

// 다른 스레드
if (ready) {                     // (3) volatile read
    use(data)                    // (1) 보장됨 — (1) hb (2) hb (3) → (1) hb (3)
}
```

### 4. Thread Start Rule
`Thread.start()` happens-before 해당 thread 가 실행하는 *어떤 액션*. 즉 부모가 자식 시작 전 한 모든 setup 이 자식에서 보인다.

### 5. Thread Termination Rule
thread 의 *마지막 액션* happens-before 다른 스레드가 `join()` 으로 그 종료를 감지. 즉 join 이 끝나면 worker 가 한 모든 일이 보인다.

```kotlin
val results = mutableListOf<Int>()    // 일반 list
val worker = Thread {
    results.add(1)
    results.add(2)
}
worker.start()
worker.join()
println(results)   // [1, 2] 보장
```

### 6. Interruption Rule
`Thread.interrupt()` happens-before 인터럽트 받는 코드.

### 7. Finalizer Rule
객체 생성자 종료 happens-before `finalize()`. (실무 무관, 표준 명세 완전성 차원)

### 8. Transitivity
A→B, B→C ⇒ A→C.

## happens-before 의 함정

### 함정 1 — 두 변수 다 일반이면 보장 없음

```kotlin
var x = 0
var y = 0

// Thread A
x = 1; y = 1

// Thread B
println(y); println(x)
```

`y` 가 1 인데 `x` 가 0 으로 보일 수 있다 — A 의 두 write 가 재배열되거나, B 의 두 read 가 재배열될 수 있음.

해결: `x` 또는 `y` 를 volatile 로, 또는 `synchronized`.

### 함정 2 — DCL 에 volatile 빼먹기

```kotlin
class LazyInit {
    private var ref: Foo? = null   // ❌ volatile 없음

    fun get(): Foo {
        if (ref == null) {
            synchronized(this) {
                if (ref == null) ref = Foo()
            }
        }
        return ref!!
    }
}
```

`ref = Foo()` 는 (a) 객체 메모리 할당, (b) 생성자 실행, (c) ref 에 참조 대입 → (a)(c)(b) 재배열 가능. 다른 스레드가 락 밖 1차 read 에서 *생성자 안 끝난 객체* 를 만짐.

해결: `ref` 를 `@Volatile`. ([03-volatile-memory-visibility.md](03-volatile-memory-visibility.md) 참고)

### 함정 3 — final 안 쓰면 immutable 객체도 race

```kotlin
class Point(val x: Int, val y: Int)   // val = final, 안전

class BadPoint {
    var x = 0      // ❌ final 아님
    var y = 0
    init { x = 1; y = 2 }
}
```

`BadPoint()` 생성 후 다른 스레드에 publish 하면 `x=0, y=0` 으로 볼 수도 있다 (생성자 안 finished).

`val` (final) 은 JMM 의 **final field semantics** 로 안전. 생성자 종료 시점에 모든 final field 의 값이 다른 스레드에 보장된다 (단 생성자 안에서 `this` 가 escape 하면 안 됨).

### 함정 4 — partially constructed object escape

```kotlin
class Foo {
    init {
        registry.register(this)   // ❌ 생성자 안에서 this leak
        // ... 추가 초기화
    }
}
```

`registry` 가 다른 스레드에서 `this` 를 보고 method 호출 시 *초기화 안 끝난* 객체 사용. final field 도 보장 안 됨.

해결: 생성 완료 후 명시적 register — factory method 패턴.

```kotlin
class Foo private constructor() {
    companion object {
        fun create(): Foo = Foo().also { registry.register(it) }
    }
}
```

## synchronizes-with

JMM 명세 용어. **두 액션 사이의 동기화 이벤트** 를 형식적으로 지칭:
- `volatile` write → 후속 `volatile` read 의 같은 변수
- `unlock` → 후속 `lock` 의 같은 monitor
- `Thread.start` → thread 의 첫 액션
- thread 의 마지막 액션 → `join` 반환

happens-before 는 (program order ∪ synchronizes-with)\* (transitive closure).

## 실무 시각화: publication 패턴

가장 자주 쓰는 happens-before 활용은 "data publication".

```
Thread A:                       Thread B:
  data = compute()  (P1)          if (ready) {        (V2)
  ready = true      (V1)             use(data)        (P2)
                                  }
```

V1 (volatile write) hb V2 (volatile read of same var). + program order: P1 hb V1, V2 hb P2. 따라서 transitivity 로 P1 hb P2 → P2 에서 P1 의 결과 보장.

→ **volatile flag 하나로 그 앞의 모든 일반 데이터를 publish** 가능.

## as-if-serial 과의 관계

- **as-if-serial**: 단일 스레드 입장에서 보면 코드 순서대로 실행된 것처럼 보여야 한다 (재배열은 single-thread 시맨틱 보존하는 한 허용).
- **happens-before**: 멀티스레드 입장에서 보장되는 *최소* 순서.

→ as-if-serial 은 컴파일러/CPU 의 *권리*, happens-before 는 프로그래머가 *기대할 수 있는* 보장.

## sequential consistency 환상은 깨졌다

순진한 모델: "모든 read/write 가 글로벌 단일 순서로 인터리빙됨." 이게 sequential consistency.

JMM 은 SC 가 *아니다*. 성능 위해 약화시켰다. SC 와 JMM 의 차이가 가장 잘 드러나는 예: Dekker's algorithm, Peterson's lock, double-checked locking. 모두 SC 가정 하에선 동작하지만 JMM 에선 깨진다.

## ARM/x86 의 차이

| 측면 | x86 | ARM |
|---|---|---|
| 일반 read/write 재배열 | 강력한 순서 (TSO) | 약함 — 재배열 적극적 |
| volatile 의 비용 | 거의 없음 (write 만 lock) | 메모리 배리어 명시 필요, 비쌈 |
| DCL 의 위험성 | 운 좋게 작동할 수도 | 거의 항상 깨짐 |

→ **x86 에서만 테스트하면 ARM (M1, AWS Graviton) 에서 깨지는 코드** 를 만들 수 있다. JMM 명세 기준으로 판단해야 portable.

## msa 와 JMM

msa 의 일반 코드는 (1) Spring 이 알아서 동기화 (Bean lifecycle, transaction), (2) 명시적 ConcurrentHashMap / Atomic / coroutine Mutex 사용으로 **JMM 디테일을 직접 다룰 일이 거의 없다**. 다만:

- **싱글톤 lazy init** (`by lazy`, Spring `@Lazy`) — 내부적으로 DCL + volatile 패턴 사용 (안전)
- **`@Cacheable`** — Spring 이 ConcurrentHashMap 또는 외부 캐시
- **WebSocket subscriber 의 `AtomicReference<ConnectionState>`** — happens-before 보장 활용 (`quant/BithumbWebSocketSubscriber.kt`)
- **`@Volatile shutdown`** flag — 명시적 사용 거의 없음, coroutine `Job.cancel` 로 대체

## 면접 단골

**Q. happens-before 가 뭔가, 일상 표현으로?**

"이 시점에 있던 일은 저 시점에서 *반드시* 보인다" 는 보장. 한 스레드의 write 가 다른 스레드의 read 에 보이는 조건이 happens-before. JMM 이 보장하는 건 happens-before 가 *성립할 때만* 가시성과 순서다. 안 성립하면 컴파일러/CPU 가 자유롭게 재배열할 수 있다.

**Q. volatile 이 어떻게 happens-before 를 만드나?**

JMM 의 volatile variable rule — volatile write 는 *후속* 같은 변수의 volatile read 와 synchronizes-with 관계. 거기에 program order 를 transitivity 로 연결하면, write 앞의 모든 일반 액션이 read 뒤의 모든 액션에 보인다. 이게 "volatile flag 로 데이터 publish" 패턴의 형식적 근거.

**Q. final 필드의 안전성?**

생성자가 끝나는 시점에 모든 final 필드는 다른 스레드에서 보장된 값으로 보인다. *단* 생성자 안에서 this 가 escape 안 했을 때만. immutable value 객체 (`data class` 의 모든 val 프로퍼티) 는 자동으로 안전하게 publish.

**Q. JMM 과 sequential consistency 차이?**

SC 는 모든 메모리 액션이 글로벌 단일 순서로 인터리빙되는 모델. JMM 은 그보다 약함 — happens-before 로만 순서 보장. 그래서 SC 가정 하에서 동작하던 코드 (Dekker, DCL without volatile) 가 JMM 에선 깨질 수 있다. 약함의 대가는 성능 (재배열 자유).

**Q. x86 에서 동작하던 코드가 ARM 에서 깨지는 사례?**

DCL 에서 volatile 빼먹은 버그가 대표. x86 은 strong memory model (TSO) 라 우연히 작동할 때가 많지만 ARM 은 weak model 이라 재배열이 적극적이라 깨진다. M1 맥, AWS Graviton 에서 production 돌리는 회사가 늘면서 이슈 부각. JMM 명세 기준으로 작성하면 자동으로 ARM safe.

## 다음 학습

- [10-synchronized-internals.md](10-synchronized-internals.md) — JMM 보장의 구현체
- [11-concurrenthashmap-internals.md](11-concurrenthashmap-internals.md) — happens-before 가 잘 적용된 사례
