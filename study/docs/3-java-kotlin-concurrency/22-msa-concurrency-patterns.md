---
parent: 3-java-kotlin-concurrency
seq: 22
title: msa 코드 동시성 점검
type: deep
created: 2026-05-01
---

# 22. msa 동시성 코드 실측 점검

> 이 파일은 msa 코드를 직접 grep / read 해서 검증한 결과. 명령어를 따라 실행하면서 함께 보면 좋다.

## 점검 결과 요약

| 영역 | 사용 | 상태 |
|---|---|---|
| `@Async` 사용처 | **거의 없음** (검색 결과 0) | OK — coroutine 으로 우회 |
| `@Scheduled` 사용처 | 다수 (gifticon, inventory, fulfillment, quant) | 일부 점검 필요 |
| Kafka `concurrency` 설정 | **없음** (default = 1, partition 단위 직렬) | 점검 필요 |
| JPA `@Version` (Optimistic Lock) | inventory, quant 부분 | OK |
| JPA `@Lock` (Pessimistic Lock) | **없음** | 의도적 |
| Redis 분산 락 (Redisson) | **없음** (Rate Limiter 만 RedisRateLimiter 사용) | 추후 도입 검토 |
| coroutine 사용처 | quant 메인, 일부 다른 서비스 | OK |
| `synchronized` 명시 사용 | 1개 (analytics/EventIngestionConsumer) | OK |
| `ConcurrentHashMap` | 다수 (메트릭 캐시, in-memory store) | OK |
| `AtomicInteger/Long/Reference` | 메트릭 + 상태 추적에 사용 | OK |
| `Mutex` (coroutine) | quant (audit, tenant 단위) | OK |
| Virtual Threads | **미적용** | 검토 필요 → [23-improvements.md](23-improvements.md) |

## 1. `@Async` — 미사용

```bash
grep -rn "@Async\b" --include="*.kt" /Users/gideok-kwon/IdeaProjects/msa | grep -v test
# (출력 없음)
```

→ 직접 `@Async` 안 쓰고 **coroutine + `Dispatchers.IO`** 또는 **명시적 `CoroutineScope`** 로 대체. ADR-0002 의 결정과 일치.

**의의**: `@Async` 의 함정 (default `SimpleAsyncTaskExecutor` = 풀 없음, ThreadLocal 안 따라감) 을 자연 회피.

## 2. `@Scheduled` — 다수 사용

```bash
grep -rn "@Scheduled\b" --include="*.kt" /Users/gideok-kwon/IdeaProjects/msa | grep -v test
```

대표 케이스:
- `gifticon/ExpiryCheckScheduler.kt` — 만료 체크
- `inventory/ReservationExpiryService.kt` — 예약 만료
- `inventory/InventoryReconciliationService.kt` — 재고 정합
- `inventory/OutboxPollingPublisher.kt`, `fulfillment/OutboxPollingPublisher.kt` — outbox relay
- `quant/OutboxRelay.kt`, `quant/LazyReencryptionJob.kt`, `quant/AuditChainVerifier.kt`, `quant/BithumbRestFallbackPoller.kt`, `quant/OutboxPendingMetric.kt` — 다양한 백그라운드 잡

### 점검 포인트

#### A. `TaskScheduler` 명시 빈 등록 여부

Spring 의 default 는 *단일 스레드*. 여러 `@Scheduled` 메서드가 동시에 도달하면 큐잉 → 늦은 실행.

```bash
grep -rn "ThreadPoolTaskScheduler\|TaskScheduler\b" --include="*.kt" msa | grep -v test
# (확인 필요)
```

→ 명시 빈 없으면 **여러 잡이 1개 스레드 공유**. 하나 늦으면 다 늦음.

#### B. `fixedDelay` vs `fixedRate` vs `cron`

```kotlin
@Scheduled(fixedDelay = 60_000L)   // 직전 실행 종료 후 N ms
@Scheduled(fixedRate = 60_000L)    // 직전 실행 시작 시각 + N ms
@Scheduled(cron = "0 0/5 * * * ?") // cron expression
```

`fixedDelay` 는 잡이 길어져도 동시 실행 안 일어남 (next = end + delay). `fixedRate` 는 직전이 늦어지면 다음 잡이 *즉시 시작* → **풀 고갈 위험**.

`quant/LazyReencryptionJob.kt:69` — `fixedDelay` 명시. 좋은 선택.

#### C. cluster 환경에서 leader election 또는 분산 락

같은 `@Scheduled` 메서드가 *모든 인스턴스* 에서 동시 실행. 멀티 replicas 환경에서 outbox polling 같은 잡은:

- **Phase 2 / replicas=1** 가정 → 단일 인스턴스 (현 quant 명시)
- **Phase 3 multi-replica** → leader election (ShedLock, Redis 분산 락) 또는 sequence 서비스

→ [23-improvements.md](23-improvements.md) 의 분산 락 도입 항목.

## 3. Kafka Consumer Concurrency

```bash
grep -rn "concurrency" /Users/gideok-kwon/IdeaProjects/msa --include="*.yml" --include="*.kt" | grep -v ".github\|build\|test" | grep -i "kafka\|listener\|concurrency"
# (사실상 없음)
```

→ **`spring.kafka.listener.concurrency` 미설정** = default 1.

### 영향

`ConcurrentKafkaListenerContainerFactory` 의 default `concurrency=1`. partition 이 N 개라도 1개 컨테이너만 동작 → partition 1개씩 직렬 처리.

```kotlin
// order/KafkaConfig.kt:59 — concurrency 설정 없음
@Bean
fun kafkaListenerContainerFactory(...): ConcurrentKafkaListenerContainerFactory<String, String> =
    ConcurrentKafkaListenerContainerFactory<String, String>().apply {
        setConsumerFactory(consumerFactory)
        // setConcurrency(N) 없음
        ...
    }
```

### 권장

- partition 수 = N 이면 `concurrency: N` 까지 설정 (그 이상은 의미 없음, 일부 listener idle)
- 처리 시간 긴 토픽은 `concurrency` 늘려 throughput 확보
- 단 같은 partition 의 메시지 *순서 보장* 은 1개 listener 가 처리 → partition 단위 순서는 안 깨짐

```yaml
# 예시 application.yml 보강
spring:
  kafka:
    listener:
      concurrency: 3      # 토픽 partition 수와 일치 또는 그 이하
      ack-mode: RECORD
```

→ [23-improvements.md](23-improvements.md) 항목.

## 4. JPA `@Version` (Optimistic Lock)

```kotlin
// inventory/InventoryJpaEntity.kt:30
@Version
@Column(nullable = false)
var version: Long = 0
```

좋은 패턴 — 재고 갱신은 Optimistic Lock 으로 충돌 시 throw `OptimisticLockingFailureException`. 호출자가 retry 처리.

```kotlin
// quant/ExchangeCredentialEntity.kt — comment
// "낙관적 잠금을 적용한다 (별도 `@Version` 컬럼 도입 없이 비즈니스 컬럼으로 충돌 감지)"
```

→ kek_version 같은 비즈니스 컬럼으로 versioning. WHERE clause 에 expected version 명시 + UPDATE return value 0 → 충돌. 이게 전형적인 *application-level optimistic locking*.

### 함정 점검

#### A. retry 정책

Optimistic Lock 실패 시:
- 즉시 throw → 사용자에게 5xx 또는 재시도 요청
- 자동 retry → `@Retryable(OptimisticLockingFailureException)` (spring-retry)
- backoff retry → expontential backoff + max attempts

→ inventory 의 Reservation 같은 high-contention 도메인은 *자동 retry* 패턴 검토 가치.

#### B. `@Lock(LockModeType.OPTIMISTIC_FORCE_INCREMENT)`

read-only 트랜잭션에서도 version 증가시키고 싶을 때. 거의 안 쓰임.

## 5. JPA `@Lock` (Pessimistic Lock) — 미사용

```bash
grep -rn "@Lock\b" --include="*.kt" /Users/gideok-kwon/IdeaProjects/msa | grep -v test
# (출력 없음)
```

→ Pessimistic Lock (`PESSIMISTIC_WRITE`, `SELECT FOR UPDATE`) 사용 안 함. 의도적 — Optimistic 으로 충돌 retry 가 일반적으로 더 throughput 좋음.

도입 고려 시점:
- 충돌이 매우 빈번해서 retry 가 누적되어 latency 폭증
- Phantom read 방지 (range 조건 + insert)
- 외부 시스템 reconcile 같이 *반드시 전체 직렬화* 필요한 경우

## 6. Redis 분산 락 — 미사용 (Redisson 없음)

```bash
grep -rn "redisson\|RLock" --include="*.kt" /Users/gideok-kwon/IdeaProjects/msa | grep -v test
# (출력 없음 — 코드 외 docs 만 언급)
```

→ Redisson 의존성 없음. msa 의 분산 락은 현재 미구현.

### 현재 Redis 사용처
- gateway `RedisRateLimiter` — Spring Cloud Gateway 의 token bucket
- gateway `AuthenticationGatewayFilter` — Redis blacklist (JWT)

→ rate limit 은 락이 아니라 *token bucket*. 진짜 분산 락은 없다.

### 도입 검토 케이스
- 멀티 replica 환경의 `@Scheduled` 잡 leader election
- 동일 자원에 대한 cross-instance 직렬화 (예: tenant 단위 audit chain — 현재는 replicas=1 가정)
- inventory 의 high-contention reconcile

선택지:
- **Redisson `RLock`** — Java 친화 API, 자동 fencing token, watchdog
- **Spring Integration Redis Lock**
- **ShedLock** (`@Scheduled` 잡 전용)

→ [23-improvements.md](23-improvements.md).

## 7. Coroutine 사용처

```bash
grep -rn "suspend fun\|launch\|async\b\|runBlocking" --include="*.kt" /Users/gideok-kwon/IdeaProjects/msa | grep -v test/ | wc -l
```

대표 패턴:

### A. quant — 코루틴 메인

```kotlin
// quant/NotificationDispatcher.kt
private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
job = scope.launch {
    while (isActive) {
        try {
            val item = queue.dequeue()
            sender.send(item)
        } catch (ce: CancellationException) {
            throw ce
        } catch (ex: Exception) {
            log.error(ex) { "loop error" }
        }
    }
}
```

→ structured concurrency + SupervisorJob + CancellationException rethrow + 일반 예외 흡수. 정공법.

### B. ClickHouseAuditLogPublisher — Mutex + ConcurrentHashMap

```kotlin
private val tenantLocks = ConcurrentHashMap<String, Mutex>()
override suspend fun publish(event: AuditEvent) {
    val mutex = tenantLocks.computeIfAbsent(event.tenantId) { Mutex() }
    mutex.withLock { /* ... */ }
}
```

→ tenant 단위 직렬화 (audit chain 보호). 단일 JVM 가정. multi-replica 시 분산 락 필요.

### C. WebSocket subscriber — runBlocking 안에서

```kotlin
// BithumbWebSocketSubscriber.kt:266
runBlocking { hub.emit(tick) }   // reactor 콜백 안에서 suspend 호출
```

→ Reactor netty 콜백이 *non-suspend* 라 `runBlocking` 으로 다리. **콜백 스레드 (Reactor IO worker) 를 잠깐 점유**. 시세 emit 이 빠르면 OK, 느려지면 Reactor 풀에 영향. 트래픽 늘면 점검.

## 8. `synchronized` 명시 사용

```bash
grep -rn "synchronized\b" --include="*.kt" /Users/gideok-kwon/IdeaProjects/msa | grep -v test/ | grep -v "//"
# 1건: analytics/EventIngestionConsumer.kt:27
```

```kotlin
// analytics/EventIngestionConsumer.kt
synchronized(bufferLock) {
    buffer.add(event)
    if (buffer.size >= batchSize) {
        flush()
    }
}
```

점검:
- Kafka consumer 가 단일 스레드 (concurrency=1) 면 락 자체 불필요 (한 스레드만 호출)
- 만약 `flush()` 가 ClickHouse insert 면 *락 안 외부 IO* — 위험
- Kafka concurrency 늘리거나 다른 path 에서 호출 가능성 있으면 OK

→ flush 가 무엇을 하는지 read 권장. 락 안 외부 IO 면 [02-synchronized-monitor.md](02-synchronized-monitor.md) 의 안티패턴.

## 9. `ConcurrentHashMap` 사용처

```bash
grep -rn "ConcurrentHashMap" --include="*.kt" /Users/gideok-kwon/IdeaProjects/msa | grep -v test/ | wc -l
# 십수 곳
```

대표:
- `quant/QuantMetrics.kt` — `ingestCounters`, `rotationCounters`, `wsConnectionStates` (메트릭 캐시)
- `quant/MarketDataHub.kt` — `latestTicks` (시세 latest)
- `auth/AuthService.kt` — `refreshTokenStore`, `blacklist` (in-memory, 단일 인스턴스)
- `agent-viewer/InMemoryStateStore.kt` — agent session

`computeIfAbsent` 람다 안 무거운 작업 없음 — OK.

> ⚠️ `auth/AuthService.kt` 의 in-memory `refreshTokenStore` 는 **multi-replica 시 부정확** — 다른 인스턴스의 token 정보가 없어서 refresh 실패 가능. Redis 또는 DB 로 이전 필요. 현재는 단일 인스턴스 가정.

## 10. AtomicInteger/Long/Reference

```bash
grep -rn "Atomic\(Integer\|Long\|Reference\|Boolean\)" --include="*.kt" msa | grep -v test/ | wc -l
```

대표:
- `quant/OutboxPendingMetric.kt:34` — `pending = AtomicLong(0)` (gauge)
- `quant/QuantMetrics.kt:239` — `wsConnectionStates: ConcurrentHashMap<String, AtomicInteger>`
- `quant/BithumbWebSocketSubscriber.kt:106-107` — `state, previousState: AtomicReference<ConnectionState>`
- `search/EsBulkDocumentProcessor.kt:26-27` — `processedCount, errorCount: AtomicLong`

모두 적절한 사용 — 단일 변수 atomic swap, 메트릭 카운터, 상태 enum 변경.

`AtomicLong` 카운터 중 *초당 수천 건+* 인 hot path 가 있다면 `LongAdder` 로 교체 가치. 측정 후 결정.

## 11. Virtual Threads — 미적용

```bash
grep -rn "spring.threads.virtual\|StartVirtualThread\|ofVirtual\b" --include="*.yml" --include="*.kt" msa
# (출력 없음)
```

→ JDK 25 환경인데 Virtual Threads 미적용. Spring Boot 3.2+ 부터 1줄로 활성화 가능. 적용 가능 영역:

- 일반 MVC 서비스 (order, product, member, gifticon, wishlist 등) — Tomcat worker 자동 VT 화
- coroutine 의 `Dispatchers.IO` — `newVirtualThreadPerTaskExecutor` 로 교체 검토
- gateway (WebFlux) — Netty event loop 라 VT 무관

→ [23-improvements.md](23-improvements.md) 의 1순위.

## msa 운영 진단 명령 모음

```bash
# 1. Tomcat thread pool 상태
kubectl exec <pod> -- curl -s localhost:8082/actuator/metrics/tomcat.threads.busy
kubectl exec <pod> -- curl -s localhost:8082/actuator/metrics/tomcat.threads.config.max

# 2. HikariCP 상태
kubectl exec <pod> -- curl -s localhost:8082/actuator/metrics/hikaricp.connections.active
kubectl exec <pod> -- curl -s localhost:8082/actuator/metrics/hikaricp.connections.pending

# 3. Kafka consumer lag
kubectl exec <pod> -- curl -s localhost:8082/actuator/metrics/kafka.consumer.records.lag.max

# 4. 스레드 덤프 (5초 간격 3회)
for i in 1 2 3; do
  kubectl exec <pod> -- jcmd 1 Thread.print -l > /tmp/dump-$i.txt
  sleep 5
done

# 5. async-profiler — lock contention
kubectl exec <pod> -- /opt/async-profiler/profiler.sh -e lock -d 60 -f /tmp/locks.html 1
kubectl cp <pod>:/tmp/locks.html ./locks.html
```

## 면접 자산 — "msa 의 동시성 패턴 한 줄 요약"

> "msa 는 ADR-0002 에 따라 Spring MVC + JPA blocking + Kotlin coroutine (외부 IO) + Tomcat 가상 스레드 (검토 단계) 조합. `@Async` 직접 사용은 회피하고 명시적 CoroutineScope 또는 SharedFlow + Channel 패턴. 분산 락 미구현 (replicas=1 가정), JPA Optimistic Lock 으로 재고/credential 충돌 처리. Kafka consumer concurrency 미설정 (default 1) → 토픽별 throughput 점검 필요. 운영 진단은 `jcmd Thread.print -l` 5초 간격 3회 + async-profiler lock mode 가 표준."

## 다음 학습

- [23-improvements.md](23-improvements.md) — 개선 후보 정리
- [24-interview-qa.md](24-interview-qa.md) — 면접 Q&A
