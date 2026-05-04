---
parent: 16-async-nonblocking-io
seq: 13
title: Virtual Threads 와 WebFlux 의 가치 재평가
type: deep
created: 2026-05-01
---

# 13. Virtual Threads 와 WebFlux 의 가치 재평가

## TL;DR

- **Virtual Threads (Project Loom, JDK 21+)** = OS thread 가 아닌 *유저 공간 스케줄링* thread, 거의 무한히 띄울 수 있음
- **사실상 thread-per-request 의 단순함 + 비동기의 throughput 을 동시에 제공**
- VT 등장으로 **WebFlux 의 가치 영역이 축소** — 대부분 MVC + VT 가 같은 throughput, 더 단순
- 한계: **pinning** (synchronized / native call), JNI / FFI 사용 라이브러리, 일부 ThreadLocal 패턴
- 우리 msa 의 *MVC 서비스들* 이 VT 활성화하면 thread pool 한계 거의 사라짐 — [18 글](18-improvements.md) 참고
- 이 주제는 **#3 동시성 학습 (별도 토픽)** 과 cross-ref. 여기서는 *IO (Input/Output, 입출력) 모델 관점만* 정리

---

## 1. Virtual Threads 가 무엇인가

JDK 21 GA, JEP 444. 짧게:

```java
Thread.startVirtualThread(() -> { ... });  // 한 줄로 VT 생성
ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
```

특징:
- *OS thread 가 아님* — JVM 이 user-space 에서 스케줄링
- carrier thread (= ForkJoinPool) 위에 N:M 매핑
- *blocking 호출이 carrier 를 점유하지 않음* — JVM 이 unmounting → mount 재배치
- 메모리: VT 1 개 ~수 KB (OS thread 는 ~1MB)

```
        carrier thread (= OS thread, ForkJoinPool worker)
        ┌───────────────────────────────────────┐
        │                                        │
        │   [VT 1] ─ blocking ─ unmount         │
        │        │                                │
        │        ▼                                │
        │   [VT 2 mounted] ─ work ─ unmount      │
        │        │                                │
        │        ▼                                │
        │   [VT 3 mounted] ...                   │
        └───────────────────────────────────────┘
```

→ blocking 호출이 *thread 자체를 점유하지 않는다*. 이것이 핵심.

---

## 2. 같은 일을 두 가지 방식으로

### MVC + 일반 thread

```kotlin
@GetMapping("/user/{id}")
fun get(@PathVariable id: Long): User {
    val user = userRepo.findById(id)            // JDBC blocking
    val orders = orderClient.findOrders(user)    // HTTP blocking
    return user.withOrders(orders)
}
```

- thread pool 200 개에 의해 동접 200 limit
- 각 요청은 thread 를 *200ms 내내* 점유 (JDBC 100ms + HTTP 100ms)

### MVC + Virtual Threads (Spring Boot 3.2+)

```kotlin
// application.yml
// spring.threads.virtual.enabled: true
```

같은 코드. 그런데:
- VT 는 거의 무한히 생성 가능 (메모리 제한까지)
- `findById` 가 JDBC blocking 하면 VT 가 *unmount* → carrier 가 다른 VT 로 전환
- **5000 동시 요청도 carrier thread 16 개 (CPU 코어 만큼) 면 충분**

코드는 *완전히 동일* 하지만 throughput 은 WebFlux 와 비슷.

---

## 3. WebFlux 와 비교

| 항목 | WebFlux | MVC + VT |
|---|---|---|
| 동시 connection | 무제한 | 무제한 |
| Throughput | 높음 | 비슷 (~동등) |
| Memory | 낮음 (Channel + ByteBuf) | 약간 더 높음 (VT stack) |
| 코드 스타일 | functional / reactive | imperative |
| 디버깅 | 어려움 (operator hop) | 일반 stack trace |
| 학습 곡선 | 가파름 | 거의 0 |
| ThreadLocal | 안 됨 (Context 사용) | 됨 |
| backpressure | 자동 | 명시 필요 (큐 크기 등) |
| Streaming | 자연스러움 | Servlet async 또는 SSE |
| **CPU-bound** | 손해 (EventLoop 막힘) | 비슷 (carrier 막힘) |
| **Blocking 라이브러리** | boundedElastic 분리 | 그대로 OK |

요약: *대부분 시나리오에서 MVC + VT 가 같은 throughput 을 더 단순하게 제공*. WebFlux 의 우위는 *streaming / backpressure / fan-out* 같은 reactive 적 강점에 한정.

---

## 4. Pinning — VT 의 함정

VT 가 *carrier 에서 unmount 못하는* 경우 = **pinning**. 이때 carrier 가 막혀서 다른 VT 가 못 mount.

### 원인

1. **synchronized 블록 안에서 blocking 호출**
   ```kotlin
   synchronized(lock) {
       jdbc.query()  // ← VT pinned, carrier 점유
   }
   ```
   → `ReentrantLock` 으로 교체 (JDK 21+ 는 `Lock` 도 unmount 지원)

2. **native method (JNI) 안에서 blocking**
   - JNI 호출 중엔 unmount 불가
   - 일부 SSL 라이브러리, 데이터베이스 드라이버 (구버전), 압축 라이브러리

3. **`Object.wait()` 사용** (synchronized 와 같이 쓰임)

JDK 24~25 에서 synchronized pinning 해소 작업 진행 중. 24 부터는 거의 모든 synchronized 가 unmount 가능.

### 진단

```bash
java -Djdk.tracePinnedThreads=full -jar app.jar
# 또는 JFR
java -XX:StartFlightRecording=filename=app.jfr -jar app.jar
```

`jcmd <pid> Thread.dump_to_file -format=json /tmp/dump.json` 으로 VT dump 도 가능.

---

## 5. 다른 함정

### ThreadLocal scaling

VT 가 1만 개 생기면 ThreadLocal 도 1만 개. 메모리 폭증 가능.

- ThreadLocal 이 무거운 객체 들고 있으면 위험
- `ScopedValue` (JDK 21 preview, 22+ stable) 사용 권장
- Spring 도 점진적으로 ScopedValue 채택 중

### Connection pool 압박

```kotlin
// HikariCP default = 10
// VT 5000 개가 동시에 connection 요청 → 4990 개 대기
```

- DB connection pool 은 thread 수와 무관, *DB 가 받을 수 있는 connection 수* 가 한계
- VT 라고 해서 connection 늘려야 하는 건 아님 — 오히려 *순수 IO 대기가 줄어 connection 회전이 더 빨라짐*
- 다만 saturation 시 throughput 한계는 connection pool 이 결정

---

## 6. Spring Boot 3.2+ 활성화

`application.yml`:

```yaml
spring:
  threads:
    virtual:
      enabled: true
```

이 한 줄로:
- Tomcat / Jetty의 request thread 가 VT 로 전환
- `@Async` 메서드가 VT 에서 실행
- `TaskExecutor` 자동 변경

> 우리 msa 의 product/order/search 등 (MVC) 은 Spring Boot 버전 확인 후 이 옵션만 켜도 *큰 변화* 가능. ADR 검토 필요 — [18 글](18-improvements.md) 에서 다룸.

---

## 7. 시나리오별 VT 의 영향

### A. 단순 CRUD + JDBC

| | MVC (전) | MVC + VT |
|---|---|---|
| 동시성 | 200 (Tomcat default) | ~수만 |
| Throughput at 1K 동접 | 큐잉 발생 | 그대로 처리 |

→ **확실한 이득**

### B. 외부 API fan-out

```kotlin
val a = restClient.get("/a")  // 100ms
val b = restClient.get("/b")  // 100ms
val c = restClient.get("/c")  // 100ms
// 직렬: 300ms
```

VT 라도 직렬 호출은 그대로 300ms. 병렬화하려면:

```kotlin
val tasks = listOf(
    executor.submit { restClient.get("/a") },
    executor.submit { restClient.get("/b") },
    executor.submit { restClient.get("/c") },
)
val results = tasks.map { it.get() }  // 100ms (병렬)
```

또는 Java 21 의 **Structured Concurrency** (`StructuredTaskScope`) 사용. WebFlux 의 `Mono.zip` 와 동등한 표현력 제공.

### C. SSE / WebSocket

VT 1 connection = 1 VT 라도 *수만 connection* 처리 가능.

```kotlin
@GetMapping("/notifications", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
fun stream(): SseEmitter {
    val emitter = SseEmitter(0L)  // never timeout
    Thread.startVirtualThread {
        while (!Thread.currentThread().isInterrupted) {
            emitter.send(getNextEvent())
            Thread.sleep(1000)
        }
    }
    return emitter
}
```

WebFlux 가 거의 독점하던 SSE 영역도 VT 로 가능해짐.

---

## 8. WebFlux 가 *여전히* 의미 있는 경우

- **수직 backpressure 가 자동으로 필요할 때** — 큰 file streaming, body 가 매우 큰 요청
- **operator chain 의 표현력이 필요할 때** — 복잡한 retry / timeout / fallback / circuit breaker 조합
- **이미 reactive 로 짠 코드가 많을 때** — 일관성을 위해
- **R2DBC + 복잡한 쿼리가 필요한 시스템** (드물지만 존재)

이 외엔 *VT 가 더 단순하고 throughput 비슷*.

---

## 9. msa 적용 매트릭스

| 서비스 | 현재 | VT 권장 | WebFlux 유지? |
|---|---|---|---|
| gateway | WebFlux | - | **유지** (라우팅 / fan-out / SSE 가능성) |
| product | MVC | ✓ | - |
| order | MVC + suspend (coroutine) | △ (coroutine 와 공존 검토) | - |
| search | MVC | ✓ | - |
| member, wishlist, gifticon | MVC | ✓ | - |
| auth | MVC | ✓ | - |
| quant | MVC | ✓ | - |
| analytics, charting | MVC / Python | analytics: ✓, charting: N/A | - |

> Coroutine 사용 서비스 (order 의 suspend 함수 등) 는 VT 와 *공존 가능*. Coroutine dispatcher 가 VT executor 위에서 도는 형태. 다만 굳이 둘 다 쓸 이유는 없으니 점진적 정리 검토.

---

## 10. 면접 답변 템플릿

**Q. Virtual Threads 가 나오면서 WebFlux 의 의미는?**

> "WebFlux 의 가치 영역이 줄어들었습니다. WebFlux 가 빛났던 *thread pool 한계 → 동시성 한계* 시나리오를 VT 가 *훨씬 단순하게* 해결합니다.
>
> 구체적으로:
> - VT 는 OS thread 가 아닌 user-space 스케줄링 — 메모리 ~수 KB, 거의 무한 생성
> - blocking 호출 시 carrier thread 에서 *unmount* 되어 다른 VT 에 자리 양보
> - 결과: thread-per-request 의 *단순한 코드* + WebFlux 와 *비슷한 throughput*
>
> 다만 VT 도 함정이 있습니다 — synchronized 안 blocking 시 *pinning*, JNI native 호출, ThreadLocal scaling. JDK 24~25 에서 pinning 이 거의 해소되는 중.
>
> WebFlux 가 여전히 의미 있는 경우는 *수직 backpressure 가 필요한 streaming*, *복잡한 operator chain* (retry / fallback / circuit breaker 조합), 그리고 *이미 reactive 로 통일된 시스템* 정도입니다.
>
> 우리 msa 도 *Gateway 만 WebFlux 유지*, MVC 서비스들은 Spring Boot 3.2 의 `spring.threads.virtual.enabled=true` 한 줄로 큰 throughput 향상이 가능합니다."

---

## 11. 핵심 포인트

- VT = user-space scheduling, blocking 시 unmount
- MVC + VT = thread-per-request 단순함 + 비동기 throughput
- WebFlux 가치 영역 축소 — streaming / backpressure / fan-out 정도로 한정
- Pinning (synchronized, JNI, native) 가 함정 — JDK 24~ 해소 중
- Spring Boot 3.2+ 의 `spring.threads.virtual.enabled` 한 줄로 활성화
- 우리 msa: Gateway WebFlux 유지, 나머지 MVC + VT 권장

## 다음 학습

- [14-coroutine-vs-reactor.md](14-coroutine-vs-reactor.md) — Kotlin Coroutine vs Reactor 비교
