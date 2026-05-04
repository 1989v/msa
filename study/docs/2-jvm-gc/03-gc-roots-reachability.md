---
parent: 2-jvm-gc
seq: 03
title: GC Root + Reachability — 무엇이 살아있고 무엇이 죽었는가
type: deep
created: 2026-05-01
---

# 03. GC Root + Reachability

## TL;DR

GC (Garbage Collection, 가비지 컬렉션) 가 "이 객체 살았네/죽었네"를 판단하는 기준은 **참조 카운트가 아니라 도달성**이다. **GC Root** 라는 고정된 시작점에서 출발해 참조를 따라가며 만난 객체는 "live". 못 만난 객체는 "garbage". 참조에는 4단계 강도(Strong/Soft/Weak/Phantom)가 있어서, 같은 객체라도 어떤 참조로 잡혀있느냐에 따라 GC 행동이 달라진다.

```
   GC Roots                    Live Objects (도달 가능)
   ┌──────────────┐           ┌────┐    ┌────┐    ┌────┐
   │ Stack frames │ ───────► │ A  │ ──►│ B  │ ──►│ C  │
   │ Static fields│           └────┘    └────┘    └────┘
   │ JNI handles  │ ───────► ┌────┐
   │ Active threads│          │ D  │
   └──────────────┘           └────┘

                              Garbage (도달 불가) ─→  E ←→ F  (서로만 참조)
                                                    └────┘
                                                    cycle 도 GC 됨
```

---

## 1. GC Root 의 정체

### 정의

**다른 객체에 의해 참조되지 않으면서, 그 자체로 "여기서 도달 가능한 건 모두 살아있다"고 선언되는 출발점**.

### 종류

| 종류 | 예시 |
|---|---|
| **Local Variables** | 활성 스레드 스택 프레임의 지역변수가 가리키는 객체 |
| **Active Threads** | `Thread` 객체 자체 (실행 중이면 root) |
| **Static Fields** | 클래스의 static 필드가 가리키는 객체 |
| **JNI References** | C/C++ 코드가 잡고 있는 Java 객체 |
| **Synchronization Monitors** | `synchronized`로 잠긴 객체 |
| **System Class Loader** | 부트스트랩 클래스로더가 로드한 클래스 |
| **Class** | 로드된 클래스 자체 (Metaspace 안에 있음) |

### 특징

- Root 는 **GC 가 절대 회수하지 않는다** (회수 대상이 아님)
- Root 자체는 GC 알고리즘 외부의 약속 — JVM (Java Virtual Machine, 자바 가상 머신) 이 "여긴 시작점"이라고 표시
- Root 의 양은 적다 (수천~수만 개 정도) — 그래서 mark phase 의 시작이 빠름

### 실수 — "내 코드가 들고 있는 게 Root" 가 아니다

내 코드의 객체 참조는 root **에서 도달 가능한 것일 뿐**. Root 자체는 JVM 이 정의. 면접에서 "내가 만든 변수도 root 인가요?" 라는 질문을 받으면, "활성 스레드 스택 프레임의 지역변수 / static 필드라면 root 입니다" 가 정답.

---

## 2. Reachability Analysis (도달성 분석)

### Mark Phase 의 동작

```
1. 모든 GC Root 를 grey queue 에 넣는다.
2. queue 가 비어있을 때까지:
     a. 객체 X 를 꺼낸다.
     b. X 를 black (살아있음) 으로 표시.
     c. X 가 참조하는 모든 객체 Y 중, white 인 것을 grey 로 만들어 queue 에 넣음.
3. 끝나면 black = live, white = garbage.
```

이걸 **Tri-color marking** 이라고 한다.

```
처음 상태: 전부 white
GC Root 시작: Root 를 grey

[White]   [Grey]   [Black]
객체들      Root      (없음)

처리 진행 중:
[White]   [Grey]                       [Black]
   F      A,B 의 자식들                  Root, A, B

종료:
[White]   [Grey]                       [Black]
 E, F      (없음)                       Root, A, B, C, D
```

White 로 남은 E, F 가 garbage. **둘이 서로만 참조해도** GC 됨 — 참조 카운트 방식의 단점(순환 참조 누수)이 없는 이유.

### Concurrent Marking 의 도전

ZGC/Shenandoah/G1 (Garbage-First Collector) 의 concurrent phase 에서는 **mark 하는 동안에도 mutator(앱 스레드)가 객체 참조를 바꾼다**. 잘못하면 살아있는 객체를 garbage 로 표시할 위험 → **write barrier** / **load barrier** 로 해결. 6, 7번 파일에서 상세.

---

## 3. 참조의 4단계 강도

JVM 은 같은 객체라도 어떤 종류 참조로 잡혀 있느냐에 따라 다르게 다룬다.

### Strong Reference (기본)

```kotlin
val x = Foo()  // 강한 참조. x 살아있는 동안 Foo 는 절대 GC 안 됨
```

99% 의 코드가 이거. **GC 가 회수하지 않는 유일한 종류.**

### Soft Reference (`SoftReference`)

```kotlin
val ref: SoftReference<BigCache> = SoftReference(loadCache())
// ...
val cache = ref.get()  // null 일 수도 있음
```

- **메모리 부족 시에만** GC가 회수 (정확히는 Old 가 거의 차서 OOM (Out Of Memory, 메모리 부족) 직전)
- 캐시에 적합 — 메모리 여유 있으면 살리고, 부족하면 버림
- 단점: GC 가 정말 마지막에야 회수 → Old 에 오래 머물러 promotion 압박. 실무에선 Caffeine 같은 명시적 캐시가 더 낫다

### Weak Reference (`WeakReference`)

```kotlin
val ref: WeakReference<Foo> = WeakReference(target)
// 다음 GC 사이클에서 target 의 다른 strong reference 가 없으면 회수
```

- **다음 GC 라운드에 무조건 회수** (메모리 여유 무관)
- `WeakHashMap` 의 키 — 키 객체가 외부에서 GC 되면 자동으로 엔트리 사라짐
- ThreadLocal 누수 방지 등에서 사용

### Phantom Reference (`PhantomReference`)

```kotlin
val queue = ReferenceQueue<Foo>()
val ref = PhantomReference(target, queue)
// target 이 GC 된 후, queue 에서 ref 가 알림옴 → finalize 대체로 자원 정리
```

- `get()` 은 **항상 null** — 실제 객체에 접근 불가
- 회수 시점 알림용 — `Cleaner` API 의 내부 구현
- DirectByteBuffer 의 native 메모리 해제가 이걸로 동작

### 요약 표

| 종류 | GC 시점 | 용도 |
|---|---|---|
| Strong | 절대 회수 안 함 | 일반 변수 |
| Soft | 메모리 부족 시 | 캐시 |
| Weak | 다음 GC 시 | WeakHashMap, ThreadLocal 정리 |
| Phantom | GC 후 알림 | Cleaner, finalizer 대체 |

---

## 4. Reachable 의 단계

객체는 다음 5단계 중 하나:

```
Strongly reachable     ─→  살아있음. GC 대상 아님
Softly reachable       ─→  메모리 부족하면 회수
Weakly reachable       ─→  다음 GC 에 회수
Phantom reachable      ─→  finalize/cleanup 대기
Unreachable            ─→  garbage. 다음 GC 에 비움
```

이 단계는 **각 GC cycle 에서 재계산**된다. 한번 weakly reachable 이라도 strong 참조가 다시 생기면 strongly reachable 로 복귀.

---

## 5. finalize() 와 Cleaner

### finalize() (deprecated)

```java
@Override
protected void finalize() {
    // 객체가 GC 직전에 호출됨 — 약속된 적 없음
}
```

- JDK 9 deprecated, JDK 18 removable 표시
- **호출 보장 없음** (JVM 종료 전에 GC 안 되면 finalize 안 불림)
- finalize 가 객체를 다시 살릴 수 있어 GC 가 한 사이클 더 필요 (resurrection)
- 실무 금지

### Cleaner (대체)

```kotlin
class ResourceHolder(handle: NativeHandle) : AutoCloseable {
    companion object {
        private val cleaner = java.lang.ref.Cleaner.create()
    }
    private val cleanable = cleaner.register(this) {
        // PhantomReference 가 트리거 — 안전한 정리
        handle.close()
    }
    override fun close() { cleanable.clean() }
}
```

- `try-with-resources` / `use {}` 와 결합
- finalize 보다 안전, 명시적 close + GC 시 백업 정리

---

## 6. 도달성과 메모리 누수

### Java 에서 "메모리 누수" 의 정의

> **더 이상 사용 안 하는데 GC Root 에서 도달 가능한 객체** — JVM은 살아있다고 판단하지만 비즈니스 관점에선 죽은 객체.

### 패턴 1 — Static 컬렉션

```kotlin
object EventBus {
    val listeners = mutableListOf<Listener>()  // static field → GC Root
    fun subscribe(l: Listener) { listeners.add(l) }
    // unsubscribe 가 없거나 호출 안 되면 영구 누적
}
```

### 패턴 2 — ThreadLocal

```kotlin
val tl = ThreadLocal<HeavyObject>()

@RestController
class C {
    @GetMapping("/x")
    fun x() {
        tl.set(HeavyObject())   // remove() 안 하면 스레드 재사용 시 누적
    }
}
```

Tomcat 처럼 스레드를 재사용하는 환경에서 ThreadLocal 누수는 단골. **반드시 `tl.remove()` finally 블록**.

### 패턴 3 — ClassLoader 누수

웹앱 hot-reload 시 옛 ClassLoader 가 GC 안 되면 그 ClassLoader 가 로드한 모든 클래스 + Metaspace 가 같이 살아남음 → Metaspace OOM.

### 진단

MAT 의 **Leak Suspects Report** 가 GC Root 부터 의심 객체까지의 **shortest path** 를 보여줌. 13번 파일 상세.

---

## 7. msa 컨텍스트

### 흔한 누수 후보 영역

1. **Spring Bean 의 long-lived 컬렉션** — `@Service` 클래스의 `MutableMap` (싱글톤이라 영구)
2. **Kafka Consumer 의 ConcurrentHashMap 멱등성 키** — TTL 없으면 영구 누적
3. **Caffeine/Guava cache 무한대** — `maximumSize` 없는 캐시
4. **CompletableFuture 체인 미정리** — 콜백이 외부 객체를 강참조

### 검증 패턴

`common/` 의 멱등성 처리(ADR (Architecture Decision Record, 아키텍처 결정 기록)-0012)는 Redis 기반 — JVM 메모리에 영구 누적되지 않음. 좋은 패턴.

```kotlin
// common 의 멱등성 컨슈머 패턴 (Redis 기반)
val key = "idempotent:${event.id}"
if (redisTemplate.opsForValue().setIfAbsent(key, "1", Duration.ofHours(24)) != true) {
    return  // 중복 — JVM 메모리 0 추가
}
process(event)
```

---

## 8. 자주 헷갈리는 포인트

| 오해 | 실제 |
|---|---|
| "참조 카운트로 GC 한다" | JVM 은 도달성 분석. 참조 카운트는 cycle 못 잡음 |
| "WeakReference 는 메모리 부족 시 회수" | 그건 SoftReference. Weak 는 무조건 다음 GC |
| "내 변수는 GC Root" | 활성 스레드의 스택 프레임 변수만 root |
| "static 변수는 영원" | ClassLoader 가 GC 되면 그 클래스의 static 도 GC 됨 |
| "finalize 로 자원 해제 보장" | 보장 없음. AutoCloseable + Cleaner 사용 |
| "순환 참조면 누수" | JVM 은 도달성 기반이라 cycle GC 됨. C++/Python(refcount)과 다름 |

---

## 다음 학습

- [04-gc-algorithms-basics.md](04-gc-algorithms-basics.md) — 도달성 기반 알고리즘들
- [13-heap-dump-mat.md](13-heap-dump-mat.md) — MAT 로 GC Root 부터 leak path 추적
- [12-oom-five-types.md](12-oom-five-types.md) — 도달 가능한데 비즈니스적으로 죽은 객체 = 누수형 OOM
