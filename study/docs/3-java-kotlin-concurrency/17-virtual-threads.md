---
parent: 3-java-kotlin-concurrency
seq: 17
title: Virtual Threads (Project Loom, JDK 25)
type: deep
created: 2026-05-01
---

# 17. Virtual Threads (Project Loom)

## 핵심 한 줄

Virtual Thread (VT) 는 **JVM 이 직접 스케줄링하는 가벼운 스레드** — 1:1 OS 스레드 매핑이 아니라 *carrier thread* 위에 M:N 매핑. blocking IO 가 자동으로 *unmount* 되어 carrier 를 풀어준다. JDK 21 stable, **JDK 24/25 의 JEP 491 (synchronized pinning 제거) + structured concurrency** 로 큰 제약 거의 해소.

## 문제: 플랫폼 스레드의 한계

전통 Java 스레드 = OS 스레드 1:1.

- 1 thread ≈ 1MB 스택 + 커널 자료구조 (4-8KB)
- 1만 thread ≈ 10GB+ 메모리 + 컨텍스트 스위칭 비용 폭증
- 백엔드의 일반적 패턴: `요청 1 = thread 1, blocking IO 대기` → 풀이 빨리 고갈

기존 해결책:
1. **Reactor / WebFlux** — non-blocking, callback 지옥 + 학습 곡선
2. **Coroutine** — 언어 차원의 우아한 해결, Kotlin 한정
3. **Async I/O** — NIO, completable future 등 손수 작성

→ 다 좋지만 *기존 blocking 코드를 그대로 쓸 순 없음*. **VT 는 그 갭을 메우는 해결책**.

## VT 의 동작

```
플랫폼 스레드 (Carrier Thread, OS thread)
   │
   ├── VT-1 (mounted, 실행 중)
   │     │
   │     ▼ blocking IO 진입
   │     unmount → VT-1 의 stack 을 heap 으로 옮김
   │     carrier 풀려남
   │     ▼
   ├── VT-2 (mounted)
   │
   ... 다른 carrier
   │
   IO 완료 → VT-1 mount 가능 → 임의의 idle carrier 에 mount
```

핵심:
- VT 는 *작은 객체* (수백 B). 수백만 개도 OK
- carrier (= ForkJoinPool worker, default `availableProcessors` 개) 위에 mount
- blocking 호출 시 자동 unmount → carrier 가 다른 VT 처리 가능
- IO 완료 시 다시 어떤 carrier 에 mount (원래 carrier 일 필요 없음)
- 이 동작이 **JDK 표준 IO API (Socket, JDBC, file IO 등) 에 자동 적용** — 일반 코드를 안 바꿔도 됨

## 사용 — Spring Boot 3.2+

### 가장 간단한 방법: 자동 활성화

```yaml
# application.yml
spring:
  threads:
    virtual:
      enabled: true
```

→ Tomcat worker, `@Async` executor, `@Scheduled` executor 가 *자동으로* virtual thread 사용.

### 명시적 사용

```kotlin
// 단발 VT
Thread.startVirtualThread {
    println("hi")
}

// VT factory
val factory = Thread.ofVirtual().name("worker-", 0).factory()
val executor = Executors.newThreadPerTaskExecutor(factory)
// 또는 더 간단하게
val executor = Executors.newVirtualThreadPerTaskExecutor()
```

```java
// 코드 그대로 — VT 위에서 실행
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    IntStream.range(0, 10_000).forEach(i -> {
        executor.submit(() -> {
            // blocking HTTP, JDBC, file IO 모두 OK
            httpClient.send(...);
            jdbcTemplate.query(...);
        });
    });
}  // try-with-resources 가 자동 graceful shutdown
```

## Pinning — 가장 큰 함정 (JEP 491 으로 해소)

### 문제

VT 가 carrier 에 mount 된 상태에서 *unmount 못 하는* 코드를 만나면, blocking IO 가 와도 unmount 안 되고 carrier 를 통째로 점유 → carrier 풀 고갈.

JDK 21 까진 두 경우 pinning:
1. `synchronized` 블록 안에서 blocking IO
2. native frame (JNI) 위에서 blocking IO

```java
// JDK 21 — pinning
synchronized (lock) {
    httpClient.send(req);   // ❌ unmount 못 함, carrier 점유
}
```

해결책 (JDK 21):
- `synchronized` 를 `ReentrantLock` 으로 교체
- 또는 IO 를 락 밖으로 분리

```java
// JDK 21 — 안전
ReentrantLock lock = new ReentrantLock();
lock.lock();
try {
    httpClient.send(req);   // OK, ReentrantLock 은 VT-friendly
} finally {
    lock.unlock();
}
```

### JEP 491 (JDK 24, 2025) — synchronized pinning 제거

JDK 24 부터 **`synchronized` 블록 안 blocking IO 도 unmount 가능**. 사실상 pinning 의 90% 가 해소.

JDK 25 에선 stable + 추가 최적화. msa 같은 프로젝트가 거의 손 안 대고 VT 채택 가능.

```java
// JDK 25 — OK!
synchronized (lock) {
    httpClient.send(req);   // pinning 안 됨
}
```

### 잔여 pinning 케이스

- **native frame (JNI)** — 외부 라이브러리, GraalVM substrate 등
- **`Object.wait()`** — JEP 491 에서 다뤄짐, JDK 25 에선 unmount

→ 일반 Java/Kotlin 백엔드 코드는 VT pinning 거의 신경 안 써도 됨.

## VT 가 빛나는 시나리오

| 시나리오 | VT 효과 |
|---|---|
| HTTP 요청 → 외부 API 5번 호출 (각 100ms) | thread 점유 0.5초가 → 거의 무료 |
| JDBC 쿼리 다수 직렬 실행 | 같은 효과 |
| Kafka Consumer (block on poll) | concurrency 많이 늘려도 OK |
| 수만 동시 connection (long-poll, websocket) | 풀이 부족하지 않음 |

## VT 가 안 빛나는 시나리오

| 시나리오 | 이유 |
|---|---|
| CPU bound 작업 | VT 도 결국 carrier 한정. CPU 만큼만 진행. ForkJoinPool 또는 일반 풀 더 효율 |
| 매우 짧은 task | VT 생성 비용 (수백 B) 도 무시 못 함. CPU bound 풀이 나음 |
| 락 contention 매우 심한 코드 | VT 가 mount 대기로 idle. 락 경합이 진짜 문제 |
| native call 중심 | pinning 위험 |

## VT vs Coroutine

| 측면 | Virtual Threads | Coroutine |
|---|---|---|
| 언어 | Java 21+ (Kotlin 도 사용 가능) | Kotlin (suspend) |
| 코드 변경 | 거의 없음 (blocking API 그대로) | suspend 함수로 마킹 |
| 1개 비용 | 수백 B | 수십 B (더 가벼움) |
| 동시성 한도 | 수백만 | 수백만+ |
| backpressure | 없음 (natural blocking) | suspend 자연 |
| structured concurrency | JEP 480 (preview) | 표준 |
| cancellation | `Thread.interrupt()` | `cancel()` + 협력적 |
| 학습 | 거의 없음 | 중간 |

→ Kotlin 프로젝트면 **둘 다 쓸 수 있음**. coroutine 위에 VT carrier 를 두면 더 효율 (`Dispatchers.IO` 가 VT executor 라면 IO 시 carrier 로 unmount).

## msa 적용 검토

| 영역 | 현재 | VT 도입 시 |
|---|---|---|
| **MVC 일반 서비스** (order, product, member 등) | Tomcat NIO worker pool (default 200) | `spring.threads.virtual.enabled=true` 한 줄로 무제한 worker |
| **`@Async`** | (msa 거의 미사용) | 자동 VT |
| **`@Scheduled`** | 단일 thread / 작은 풀 | VT factory 명시 시 가능 |
| **Kafka Consumer** | concurrency 설정 (partition 수) | 큰 변화 없음 — partition 수가 limiter |
| **gateway (WebFlux)** | Netty event loop | **VT 무관** — 이미 non-blocking |
| **quant (coroutine)** | Dispatchers.IO | `Dispatchers.IO` 를 VT executor 로 교체 가능 |

### 권장 1순위: 일반 MVC 서비스

```yaml
# order/app/src/main/resources/application.yml
spring:
  threads:
    virtual:
      enabled: true
```

부수 효과:
- thread 이름이 `VirtualThread@xxx` 로 바뀜 → 로깅 / MDC 영향 점검
- thread dump 출력이 다름 (VT 는 별도 표시)
- `ThreadLocal` 사용처는 안전성 재검토 (VT 는 매 task 마다 새 VT, ThreadLocal pool reuse 시나리오 완화)

### 권장 2순위: coroutine 코드의 Dispatchers.IO 교체

```kotlin
// JDK 25 + Loom
val virtualThreadDispatcher = Executors.newVirtualThreadPerTaskExecutor()
    .asCoroutineDispatcher()

withContext(virtualThreadDispatcher) {
    blockingJdbcCall()
}
```

- `Dispatchers.IO` 는 default 64+ thread 풀
- VT executor 는 수만 동시
- coroutine + VT 조합 → 둘의 가벼움 누적

## 면접 단골

**Q. Virtual Thread 가 뭔가?**

JDK 21 stable 의 새 thread 모델. 기존 플랫폼 스레드처럼 보이지만 *carrier thread (ForkJoinPool worker)* 위에 mount/unmount 되는 가벼운 스레드. blocking IO 호출 시 자동 unmount → carrier 가 다른 VT 처리. 1개 비용 수백 B 라 수백만 개 동시 실행 가능. 기존 blocking 코드를 거의 안 바꿔도 됨.

**Q. VT 의 pinning 이 뭐고 어떻게 해결?**

VT 가 carrier 에 *mount 된 채 unmount 못 하는* 상황. JDK 21 에선 `synchronized` 블록 + native frame 에서 발생. 해결은 (1) `ReentrantLock` 으로 교체, (2) IO 를 락 밖으로 분리. JDK 24 의 JEP 491 으로 `synchronized` pinning 이 제거되어 JDK 25 에선 거의 무관. 이게 VT 채택의 큰 trigger.

**Q. VT vs Reactor?**

Reactor 는 non-blocking 패러다임 — callback chain 으로 코드 구조 자체가 바뀜. VT 는 *blocking 코드를 그대로 쓰면서* 효과적으로 만든다. 학습 곡선 낮고 기존 코드 호환. Reactor 는 backpressure 등 finer control 이 필요한 streaming 에서 여전히 가치. 새 프로젝트라면 VT + 표준 blocking API 가 1순위 선택.

**Q. VT 가 CPU bound 에도 도움 되나?**

거의 안 됨. carrier 수가 CPU 코어 수로 한정 → CPU bound task 는 carrier 만큼만 동시 실행. 일반 ForkJoinPool 또는 명시적 CPU pool 이 더 효율적. VT 의 가치는 *blocking IO 의 thread 점유 비용 제거*.

**Q. msa 같은 프로젝트가 VT 채택 시 점검할 것?**

(1) `synchronized` 안 blocking IO — JDK 25 면 OK, JDK 21 면 ReentrantLock 으로. (2) `ThreadLocal` — VT 는 매 task 새 VT 라 풀 재사용 leak 위험 완화, 다만 SecurityContextHolder 등 framework 메커니즘 동작 검증. (3) thread dump 출력 형식 변경. (4) JNI/native 라이브러리 의존성. (5) 메트릭/로깅 thread 이름 의존 코드. 일반 MVC 면 `spring.threads.virtual.enabled=true` 한 줄로 큰 효과.

## 다음 학습

- [18-reactor-vs-coroutine.md](18-reactor-vs-coroutine.md) — Reactor 와 비교
- [22-msa-concurrency-patterns.md](22-msa-concurrency-patterns.md) — msa 코드 적용 점검
- [23-improvements.md](23-improvements.md) — VT 도입 제안
