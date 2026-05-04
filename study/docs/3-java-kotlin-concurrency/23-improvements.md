---
parent: 3-java-kotlin-concurrency
seq: 23
title: msa 동시성 개선 후보
type: deep
created: 2026-05-01
---

# 23. msa 동시성 개선 후보

> [22-msa-concurrency-patterns.md](22-msa-concurrency-patterns.md) 의 점검 결과를 바탕으로 한 개선 제안 정리. 우선순위 / 영향도 / ADR 필요 여부 표시.

## 개선 제안 종합

| # | 제안 | 대상 | 영향도 | 우선순위 | ADR 필요 |
|---|---|---|---|---|---|
| 1 | Virtual Threads 활성화 (일반 MVC 서비스) | order, product, member, gifticon, wishlist, inventory, fulfillment, auth 등 | 중간 | **높음** | Y (마이너) |
| 2 | Kafka `listener.concurrency` 명시 설정 | 모든 Kafka consumer 보유 서비스 | 낮음 | **높음** | N |
| 3 | `@Scheduled` `TaskScheduler` 풀 빈 명시 등록 | gifticon, inventory, fulfillment, quant | 낮음 | 중간 | N |
| 4 | 분산 락 도입 (Redisson 또는 ShedLock) | multi-replica 잡 (Phase 3 시점) | 높음 | 중간 (Phase 3 직전) | **Y** |
| 5 | Optimistic Lock retry 정책 (`@Retryable`) | inventory Reservation | 낮음 | 중간 | N |
| 6 | `auth/refreshTokenStore` Redis 이전 | auth 서비스 | 중간 | 중간 | Y (마이너) |
| 7 | Reactor 콜백 안 `runBlocking` 제거 (BithumbWebSocketSubscriber) | quant | 낮음 | 낮음 | N |
| 8 | `LongAdder` 적용 (high-frequency counter) | 측정 후 hot path 한정 | 낮음 | 낮음 | N |
| 9 | JFR continuous recording 표준화 | 모든 서비스 | 낮음 | 중간 | N |
| 10 | async-profiler 컨테이너 표준화 | 모든 서비스 | 낮음 | 낮음 | N |

## 우선순위 TOP 3

### 1. Virtual Threads 활성화 — 일반 MVC 서비스

**현재 상태**: msa 는 JDK 25 환경인데 Virtual Threads 미적용. Tomcat 의 default 200 worker 가 blocking IO (HTTP downstream, JDBC) 에 점유되면 throughput 한계.

**개선 (한 줄)**:

```yaml
# {service}/app/src/main/resources/application.yml
spring:
  threads:
    virtual:
      enabled: true
```

**효과**:
- Tomcat worker, `@Async`, `@Scheduled` executor 가 자동 VT 사용
- 동시 connection 한도가 worker 풀이 아닌 *메모리 한도* 로 확장
- blocking IO (JDBC, RestTemplate, Kafka send) 가 carrier 안 점유

**왜 1순위**:
- 코드 변경 거의 0 (yml 한 줄)
- JDK 24 의 JEP 491 으로 `synchronized` pinning 해소 → 실질 위험 거의 없음
- 즉시 측정 가능 (latency p99 / connection 처리량)

**점검 사항**:
- `ThreadLocal` 기반 코드 (Spring Security context, MDC) 가 잘 동작하는지 통합 테스트
- thread dump 형식 변경 (VT 는 `VirtualThread@xxx` 표기)
- 메트릭/로깅 thread 이름 의존 코드 점검
- 외부 라이브러리 (특히 native call 포함) 동작 확인

**제외 대상**:
- gateway (WebFlux/Netty) — VT 무관
- quant (coroutine 메인) — coroutine 이 이미 충분, 별도 검토

**ADR (Architecture Decision Record, 아키텍처 결정 기록)**: ADR-0002 의 런타임 결정 갱신 (가상 스레드 적용 명시)

### 2. Kafka `listener.concurrency` 설정

**현재 상태**: 모든 서비스의 Kafka consumer 가 default `concurrency=1` (`ConcurrentKafkaListenerContainerFactory.setConcurrency` 미호출).

**문제**:
- 토픽 partition 이 N 개여도 1개만 처리 → 처리량이 partition 수보다 낮음
- consumer lag 폭증 시 단일 스레드라 가속 불가
- partition 단위 *순서 보장* 은 어차피 partition 별 1개 listener 라 안 깨짐

**개선**:

```yaml
spring:
  kafka:
    listener:
      concurrency: 3   # 토픽 partition 수와 일치 또는 그 이하
```

또는 listener factory bean 단위:

```kotlin
@Bean
fun kafkaListenerContainerFactory(...): ConcurrentKafkaListenerContainerFactory<String, String> =
    ConcurrentKafkaListenerContainerFactory<String, String>().apply {
        setConsumerFactory(consumerFactory)
        setConcurrency(3)        // ← 추가
        ...
    }
```

**왜 2순위**:
- 즉시 throughput 향상
- 토픽별 partition 수 확인 + 그 이하로 설정 (그 이상은 idle)
- ADR 불필요, 운영 튜닝 영역

**점검 사항**:
- partition 보다 큰 concurrency 는 idle listener 만 늘림 (의미 없음)
- `@KafkaListener` 메서드의 idempotency 보장 (msa 는 ProcessedEvent 패턴으로 OK)
- 같은 partition 의 메시지 순서 보장 유지 (concurrency 가 partition 단위로 분배되므로 OK)

**우선 적용 후보**:
- order: `inventory.reservation.expired` (consumer 처리 시간 길음)
- search: `product.score.update`, `product.indexing` (대량 처리)
- analytics: `event.ingestion` (이벤트 인입 빈도 높음)

### 3. `@Scheduled` TaskScheduler 풀 빈 명시 등록

**현재 상태**: `@EnableScheduling` 만 적용 → default 단일 스레드 TaskScheduler. 같은 서비스에 여러 `@Scheduled` 잡이 있으면 직렬화.

**문제 시나리오**:

```
quant:
  - OutboxRelay (1초 간격)
  - LazyReencryptionJob (60초 간격)
  - AuditChainVerifier (5분 간격)
  - BithumbRestFallbackPoller (10초 간격)
  - OutboxPendingMetric (5초 간격)
```

→ 모두 같은 단일 스레드. OutboxRelay 가 1초 안 끝나면 다른 잡 늦게 시작.

**개선**:

```kotlin
@Configuration
@EnableScheduling
class SchedulingConfig : SchedulingConfigurer {
    override fun configureTasks(taskRegistrar: ScheduledTaskRegistrar) {
        taskRegistrar.setTaskScheduler(taskScheduler())
    }

    @Bean(destroyMethod = "shutdown")
    fun taskScheduler(): ThreadPoolTaskScheduler =
        ThreadPoolTaskScheduler().apply {
            poolSize = 4
            setThreadNamePrefix("scheduled-")
            setRejectedExecutionHandler(ThreadPoolExecutor.CallerRunsPolicy())
            setWaitForTasksToCompleteOnShutdown(true)
            setAwaitTerminationSeconds(30)
            initialize()
        }
}
```

**왜 3순위**:
- 잡 수 늘어날수록 영향 큼 (quant 5개 잡)
- 무관한 잡 격리 → graceful shutdown 도 안전
- ADR 불필요

## 중기 (ADR 필요)

### 4. 분산 락 도입 (Redisson)

**현재 상태**: Redis 분산 락 미구현. msa 는 replicas=1 가정 (Phase 2). Phase 3 multi-replica 시 race / 중복 처리 위험.

**도입 시점**: Phase 3 multi-replica 전.

**시나리오**:
- `@Scheduled` 잡 leader election (모든 replica 가 동시에 OutboxRelay 폴링하면 같은 row 중복 publish)
- audit chain prev_hash 계산 cross-replica 직렬화 (현재 in-process Mutex 만)
- inventory reconcile 의 cross-instance 직렬화

**선택지**:

| 옵션 | 장점 | 단점 |
|---|---|---|
| **Redisson `RLock`** | 자동 watchdog, fencing token 비슷, Java 친화 | 의존성 추가 (3MB+) |
| **Spring Integration RedisLockRegistry** | Spring 표준 | 기능 단순 |
| **ShedLock** | `@SchedulerLock` 어노테이션 한 줄 | `@Scheduled` 전용 |

**권장**:
- 일반 분산 락 → Redisson
- `@Scheduled` 만 → ShedLock (가벼움)

**예시 (Redisson)**:

```kotlin
val lock = redissonClient.getLock("inventory:reconcile")
if (lock.tryLock(0, 30, TimeUnit.SECONDS)) {
    try {
        reconcile()
    } finally {
        lock.unlock()
    }
}
```

**ADR 필요 사항**:
- 키 네임스페이스 컨벤션 (`{service}:{resource}:{id}`)
- 기본 lease time / wait time
- watchdog 활성/비활성 정책
- 장애 시나리오 (Redis 단절 → fail-open vs fail-closed)

### 6. auth `refreshTokenStore` Redis 이전

**현재**: `auth/AuthService.kt:25` 의 `ConcurrentHashMap<String, String> refreshTokenStore`. **단일 인스턴스 가정**.

**문제**: replicas 늘리면 refresh 가 다른 인스턴스로 라우팅 시 store miss → refresh 실패.

**개선**: Redis 로 이전 (TTL = refresh token 만료 시간).

```kotlin
class RedisRefreshTokenStore(private val redis: ReactiveStringRedisTemplate) {
    suspend fun save(jti: String, userId: String, ttl: Duration) {
        redis.opsForValue().set("refresh:$jti", userId, ttl).awaitSingle()
    }
    suspend fun get(jti: String): String? = redis.opsForValue().get("refresh:$jti").awaitSingleOrNull()
    suspend fun revoke(jti: String) { redis.delete("refresh:$jti").awaitSingle() }
}
```

**ADR**: 토큰 운영 (refresh rotation + reuse detection) — 13-crypto-jwt-sso 의 19-improvements.md 항목 5와 연계.

## 단기 (운영 튜닝)

### 5. Optimistic Lock 자동 retry

**현재**: inventory `InventoryJpaEntity` 에 `@Version` 적용. 충돌 시 `OptimisticLockingFailureException` 그대로 throw.

**개선**:

```kotlin
import org.springframework.retry.annotation.Backoff
import org.springframework.retry.annotation.Retryable

@Service
class ReservationService {
    @Retryable(
        OptimisticLockingFailureException::class,
        maxAttempts = 3,
        backoff = Backoff(delay = 50, multiplier = 2.0)
    )
    fun reserve(productId: Long, qty: Int) { /* ... */ }
}
```

**ADR 불필요** — 내부 retry, 외부 시맨틱 동일 (성공 또는 5xx).

**대안**: 도메인 레벨 명시 retry — try-catch + while 루프. 더 control 가능.

### 7. WebSocket runBlocking 제거 (quant)

**현재**: `BithumbWebSocketSubscriber.kt:266` 에서 Reactor 콜백 안 `runBlocking { hub.emit(...) }`.

**문제**:
- Reactor netty IO worker 가 잠시 blocking
- emit 이 SharedFlow 라 보통 빠르지만, subscriber 가 backpressure 걸면 블록 지속
- worker 풀이 작은 Reactor 환경에선 영향 가능

**개선**: emit 자체를 별도 channel 로 fan-out, 콜백은 channel.trySend.

```kotlin
private val tickChannel = Channel<Tick>(capacity = 1024, BufferOverflow.DROP_OLDEST)

scope.launch {
    for (tick in tickChannel) {
        hub.emit(tick)
    }
}

// 콜백
tickChannel.trySend(tick)   // non-blocking, full 시 oldest drop
```

→ Reactor worker 즉시 풀어줌. emit backpressure 가 worker 영향 없음.

### 8. `LongAdder` 적용 (측정 후)

high-frequency counter 가 hot path 면 `AtomicLong → LongAdder`.

검토 후보:
- `quant/EsBulkDocumentProcessor.processedCount` — bulk 처리 경로, 빈도 측정 필요
- 메트릭 카운터 (Micrometer 가 이미 striped, 영향 작음)

**측정 우선** — 무조건 교체 X. async-profiler `-e cpu` 로 hot path 확인 후.

### 9. JFR Continuous Recording 표준화

**제안**: 모든 서비스의 Deployment 에 JVM 옵션 추가.

```yaml
# deployment.yaml
env:
  - name: JAVA_TOOL_OPTIONS
    value: -XX:StartFlightRecording=disk=true,maxsize=256m,maxage=2h,settings=profile,filename=/tmp/recording.jfr
```

→ 사고 발생 시 직전 2시간 JFR 즉시 확보.

**저장**: pod 재시작 시 사라짐. 사고 직후 `kubectl cp` 로 빠른 회수 절차 마련.

## 면접 자산 — "동시성 개선 우선순위"

> "msa 의 동시성 개선 우선순위는 (1) Virtual Threads 활성화 — JDK 25 + Spring Boot 3.2+ 환경에서 yml 한 줄로 일반 MVC 서비스의 connection 처리 capacity 가 worker pool 한계에서 메모리 한계로 확장. JDK 24 의 JEP 491 으로 synchronized pinning 도 해소. (2) Kafka concurrency 설정 — 현재 default 1, partition 수 만큼 늘려 throughput 회수. (3) Phase 3 multi-replica 전 Redisson 분산 락 도입으로 leader election + audit chain cross-replica 직렬화. 모두 ADR 거쳐 영향도 평가하고 측정 기반 결정."

## 다음 학습

- [24-interview-qa.md](24-interview-qa.md) — 면접 Q&A
