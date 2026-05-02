---
parent: 7-distributed-systems
type: deep
order: 18
created: 2026-05-01
---

# 18. msa 의 Resilience (ADR-0015) + Gateway Rate Limiting

> Phase 3 마지막. Circuit Breaker, DLQ, Token Bucket, Admission Control 의 실제 구현을 점검.

## 1. ADR-0015 의 9개 영역

```
1. Circuit Breaker (Resilience4j)
2. Dead Letter Queue (Spring Kafka DefaultErrorHandler)
3. Rate Limiting (Gateway Token Bucket + 서비스 RL)
4. CQRS (Inventory read = Redis)
5. Timeout & Retry
6. Bulkhead (서비스별 별도 풀)
7. Graceful Degradation
8. Non-Blocking I/O
9. Observability
```

## 2. Circuit Breaker 구현 — Order 서비스

### 2.1 CircuitBreakerRegistry 빈

`order/.../infrastructure/config/WebClientConfig.kt`:

```kotlin
@Configuration
class WebClientConfig {
    @Value("\${payment.service.url:http://localhost:9090}")
    private lateinit var paymentServiceUrl: String

    @Value("\${product.service.url:http://localhost:8081}")
    private lateinit var productServiceUrl: String

    @Bean("paymentWebClient")
    fun paymentWebClient(): WebClient = WebClient.builder()
        .baseUrl(paymentServiceUrl).build()

    @Bean("productWebClient")
    fun productWebClient(): WebClient = WebClient.builder()
        .baseUrl(productServiceUrl).build()

    @Bean
    fun circuitBreakerRegistry(): CircuitBreakerRegistry {
        val config = CircuitBreakerConfig.custom()
            .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
            .slidingWindowSize(10)
            .failureRateThreshold(50f)
            .waitDurationInOpenState(Duration.ofSeconds(30))
            .permittedNumberOfCallsInHalfOpenState(3)
            .build()
        return CircuitBreakerRegistry.of(config)
    }
}
```

**관찰**:
- 모든 CB 가 같은 config 공유
- WebClient 가 외부 시스템마다 별도 (semantic bulkhead)
- `recordExceptions` / `ignoreExceptions` 설정 없음 → 모든 예외가 실패로 카운트

### 2.2 PaymentAdapter

`order/.../infrastructure/client/PaymentAdapter.kt`:

```kotlin
@Component
class PaymentAdapter(
    @Qualifier("paymentWebClient") private val webClient: WebClient,
    private val circuitBreakerRegistry: CircuitBreakerRegistry,
) : PaymentPort {
    private val circuitBreaker = circuitBreakerRegistry.circuitBreaker("payment-service")

    override suspend fun requestPayment(orderId: Long, amount: BigDecimal): PaymentResult {
        return circuitBreaker.executeSuspendFunction {
            webClient.post().uri("/payments")
                .bodyValue(mapOf("orderId" to orderId, "amount" to amount))
                .retrieve()
                .bodyToMono(PaymentResult::class.java)
                .awaitSingle()
                ?: throw BusinessException(ErrorCode.EXTERNAL_API_ERROR, "결제 응답 없음")
        }
    }
}
```

**좋은 점**:
- `executeSuspendFunction` 으로 코루틴 친화 (block 안 함)
- WebClient + suspend + awaitSingle 의 표준 non-blocking
- 외부 시스템마다 별도 CB 이름 (`payment-service`)

**개선 후보**:
- `BusinessException` (도메인 예외) 도 CB 가 실패로 카운트하면 OPEN 자주 발동 → `ignoreExceptions(BusinessException::class.java)` 추가
- timeout 명시 (현재 WebClient 기본 timeout 만 의존)
- fallback 부재 — OPEN 시 사용자 안내 메시지 변환만

### 2.3 ProductAdapter

`order/.../infrastructure/client/ProductAdapter.kt` (구조 같음):

```kotlin
private val circuitBreaker = circuitBreakerRegistry.circuitBreaker("product-service")
override suspend fun fetchProduct(id: Long): Product { ... }
```

### 2.4 CB 적용 외 영역

| 호출 | CB? | 비고 |
|---|---|---|
| order → payment | ✓ | |
| order → product | ✓ | |
| inventory → product (있다면) | ✗ | 검증 결과 (2026-05-01): inventory 코드에 product HTTP 호출 없음 (역방향 — product 가 inventory 이벤트 consume) |
| Kafka producer | X | (CB 부적합 영역) |
| Redis 호출 | X | RedisTemplate 직접, fail-open 처리 |
| ES indexing | X | retry + DLT 로 처리 |

## 3. Gateway Rate Limiting

### 3.1 RateLimiterConfig

`gateway/.../config/RateLimiterConfig.kt`:

```kotlin
@Configuration
class RateLimiterConfig {

    @Bean
    fun ipKeyResolver(): KeyResolver = KeyResolver { exchange ->
        Mono.just(exchange.request.remoteAddress?.address?.hostAddress ?: "unknown")
    }

    @Bean
    @Primary
    fun userKeyResolver(): KeyResolver = KeyResolver { exchange ->
        Mono.just(
            exchange.request.headers.getFirst("X-User-Id")
                ?: exchange.request.remoteAddress?.address?.hostAddress
                ?: "unknown"
        )
    }

    /**
     * Redis Token Bucket Rate Limiter.
     * replenishRate: 100 tokens/sec
     * burstCapacity: 200 tokens (allows short bursts)
     * requestedTokens: 1 token per request
     */
    @Bean
    fun redisRateLimiter(): RedisRateLimiter =
        RedisRateLimiter(100, 200, 1)
}
```

**관찰**:
- Token Bucket 알고리즘 (Spring Cloud Gateway 표준)
- 100 RPS replenish + 200 burst → 대부분의 인터널 트래픽엔 충분, 외부 크롤러/봇엔 약간 부족
- userKeyResolver 가 `X-User-Id` 우선, 없으면 IP — 인증 후/전 모두 대응
- `@Primary` 로 Spring Cloud Gateway 의 RequestRateLimiter 가 자동 선택

### 3.2 GatewayRouteConfig — 적용 라우트

```kotlin
.route("inventory-service") { r ->
    r.path("/api/inventories/**")
        .filters { f ->
            f.filter(authFilter.apply(sellerConfig()))
                .requestRateLimiter { config ->
                    config.setRateLimiter(redisRateLimiter)
                    config.setKeyResolver(userKeyResolver)
                    config.setDenyEmptyKey(false)
                }
                .stripPrefix(0)
        }
        .uri("http://inventory:8085")
}
```

**관찰**:
- **inventory route 만** RL 적용
- 다른 route (order, product, search 등) 는 RL 없음
- → Flash sale 같은 트래픽 폭증 시점에 다른 route 도 영향 받을 수 있음
- → 도메인별 RL config 분리 + 전체 RL fallback 필요

### 3.3 Redis Token Bucket Lua

Spring Cloud Gateway 가 내부적으로 사용하는 Lua (실제 OSS 코드 발췌):

```lua
local tokens_key = KEYS[1]
local timestamp_key = KEYS[2]
local rate = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local fill_time = capacity/rate
local ttl = math.floor(fill_time*2)

local last_tokens = tonumber(redis.call("get", tokens_key))
if last_tokens == nil then
  last_tokens = capacity
end

local last_refreshed = tonumber(redis.call("get", timestamp_key))
if last_refreshed == nil then
  last_refreshed = 0
end

local delta = math.max(0, now-last_refreshed)
local filled_tokens = math.min(capacity, last_tokens+(delta*rate))
local allowed = filled_tokens >= requested
local new_tokens = filled_tokens
local allowed_num = 0
if allowed then
  new_tokens = filled_tokens - requested
  allowed_num = 1
end

redis.call("setex", tokens_key, ttl, new_tokens)
redis.call("setex", timestamp_key, ttl, now)

return { allowed_num, new_tokens }
```

→ **single round-trip + atomic**. SET + INCR 로 했으면 race 났을 부분.

## 4. Admission Control

`inventory/.../infrastructure/admission/AdmissionControlFilter.kt`:

```kotlin
@Component
class AdmissionControlFilter(
    private val redisTemplate: StringRedisTemplate?,
    @Value("\${inventory.admission.max-concurrent-reservations:1000}")
    private val maxConcurrentReservations: Long,
) : OncePerRequestFilter() {
    companion object {
        private const val ACTIVE_RESERVATIONS_KEY = "inventory:active-reservations"
        private const val HTTP_TOO_MANY_REQUESTS = 429
    }

    override fun doFilterInternal(request, response, chain) {
        if (!isReservationRequest(request)) { chain.doFilter(...); return }
        if (redisTemplate == null) { chain.doFilter(...); return }  // fail-open

        val current = try {
            redisTemplate.opsForValue().increment(ACTIVE_RESERVATIONS_KEY) ?: 0
        } catch (e: Exception) {
            log.warn("Redis increment failed, bypassing")
            chain.doFilter(...); return
        }

        try {
            if (current > maxConcurrentReservations) {
                decrementSafely()
                response.status = HTTP_TOO_MANY_REQUESTS
                response.writer.write("""{"code":"TOO_MANY_REQUESTS"}""")
                return
            }
            chain.doFilter(request, response)
        } finally {
            decrementSafely()
        }
    }

    private fun isReservationRequest(request: HttpServletRequest): Boolean =
        request.method == "POST" && request.requestURI.endsWith("/reserve")
}
```

**관찰**:
- **Inflight counter** (현재 처리 중인 reservation 수) 기반
- Token Bucket 과 보완 — Token 은 도착 속도, Admission 은 동시성
- `fail-open`: Redis 죽으면 통과 (서비스 가용성 우선)
- 단순 `INCR` (token bucket Lua 만큼 정교하지 않음) — 충분히 atomic

**개선 후보**:
- "재고 1.2 배" 룰 (ADR-0015 명세) 이 코드에 미구현 — 단순 max 1000
- 도메인별로 max 다르게 (warehouse 별 capacity 등)

## 5. DLQ (Dead Letter Queue)

**검증 결과 (2026-05-01)**: `fulfillment/app/src/main/kotlin/com/kgd/fulfillment/infrastructure/config/KafkaConfig.kt:54-68` (그리고 `inventory/.../KafkaConfig.kt:58-72` 동일):

```kotlin
@Bean
fun kafkaListenerContainerFactory(
    consumerFactory: ConsumerFactory<String, String>,
    kafkaTemplate: KafkaTemplate<String, Any>,
): ConcurrentKafkaListenerContainerFactory<String, String> =
    ConcurrentKafkaListenerContainerFactory<String, String>().apply {
        setConsumerFactory(consumerFactory)
        containerProperties.ackMode = ContainerProperties.AckMode.RECORD
        setCommonErrorHandler(
            DefaultErrorHandler(
                DeadLetterPublishingRecoverer(kafkaTemplate),
                FixedBackOff(1000L, 3L),
            )
        )
    }
```

**관찰** (ADR-0015 표준):
- FixedBackOff 1s × 3 → DLT (`{topic}-dlt` Spring Kafka 기본 형식)
- AckMode.RECORD — 한 메시지마다 ACK
- **`addNotRetryableExceptions` 는 코드에 미적용** — 검증 결과: 전체 msa 코드베이스 어디에도 없음. 즉 BusinessException 도 1초 × 3회 재시도 후 DLT. 즉시 DLT 하려면 추가 필요 (개선 후보).
- DLT 모니터링 + 재처리는 Phase 3-4 로 명시

**개선 후보**:
- ExponentialBackOff (1s → 2s → 4s) + Jitter
- DLT consumer 로 Slack 알림
- DLT 재처리 API (운영자가 수동 retry)

## 6. CQRS (Inventory Read Model)

이미 17 장에서 상세 분석. 핵심:

```
Write: InventoryRepository (DB master) + Outbox
Read:  InventoryCachePort (Redis) → fallback DB
Sync:  Write-Through + Reconciliation 5 분 주기
```

## 7. Non-Blocking I/O

ADR-0015 8번 항목 — Order 가 표준:

```kotlin
// Port (suspend)
interface PaymentPort {
    suspend fun requestPayment(orderId: Long, amount: BigDecimal): PaymentResult
}

// Adapter (awaitSingle)
override suspend fun requestPayment(...): PaymentResult {
    return circuitBreaker.executeSuspendFunction {
        webClient.post()...awaitSingle()
    }
}

// Controller (suspend endpoint)
@PostMapping
suspend fun handle(@RequestBody req: Request): ResponseEntity<...> { ... }
```

→ 톰캣 servlet thread 가 IO 동안 점유되지 않음. **#16 Async/IO 의 표준 적용**.

## 8. Bulkhead 현황

| 자원 | 격리 | 평가 |
|---|---|---|
| HikariCP per service | ✓ | service 별 max=10, min=2 |
| WebClient per external | ✓ | `@Qualifier`로 paymentWebClient/productWebClient |
| Kafka Consumer Group | ✓ | service 별 group |
| Resilience4j Bulkhead 인스턴스 | △ (미적용) | 명시적 동시성 제한 부재 |

**개선 후보**: Resilience4j Bulkhead 적용 — 외부 호출당 max concurrent 명시.

```kotlin
@Bean
fun bulkheadRegistry(): BulkheadRegistry =
    BulkheadRegistry.of(BulkheadConfig.custom()
        .maxConcurrentCalls(20)
        .maxWaitDuration(Duration.ofMillis(50))
        .build())

// PaymentAdapter
private val bulkhead = bulkheadRegistry.bulkhead("payment-service")
private val cb = circuitBreakerRegistry.circuitBreaker("payment-service")

override suspend fun requestPayment(...): PaymentResult {
    return Bulkhead.executeSuspendFunction(bulkhead) {
        cb.executeSuspendFunction {
            webClient.post()...
        }
    }
}
```

## 9. Observability

ADR-0015 9번:

| 항목 | 도구 | 상태 |
|---|---|---|
| Health Check | Spring Actuator | ✓ |
| CB 상태 | Actuator `/circuitbreakers` | ✓ |
| Kafka Consumer Lag | Kafka metrics | △ (Prometheus 연동 명시 X) |
| DLQ 메시지 수 | topic monitoring | △ |

→ Phase 4 의 Prometheus + Grafana 대시보드는 향후. trace_id 전파도 OpenTelemetry 도입 검토.

## 10. 진단 종합표

| 영역 | 적용 | 강점 | 개선 후보 |
|---|---|---|---|
| Circuit Breaker | ✓ order→payment, product | 외부마다 별도 CB, suspend 친화 | ignoreExceptions, fallback 명시 |
| DLQ | ✓ FixedBackOff + DLT | 표준화 | ExponentialBackOff + Jitter, DLT consumer 알림 |
| Rate Limiting (GW) | ✓ inventory route | Redis Lua atomic, key resolver 분리 | 다른 route 도 적용, Flash sale 모드 외부화 |
| Admission Control | ✓ inventory reserve | inflight counter 직접 측정 | 1.2배 룰 코드화, 도메인별 max |
| CQRS | ✓ inventory | Write-Through + Reconciliation | event-driven projection 도 검토 |
| Bulkhead | △ semantic only | per-service 풀 분리 | Resilience4j Bulkhead 명시 |
| Non-Blocking I/O | ✓ order | suspend + WebClient + awaitSingle | 다른 service 도 점진 적용 |
| Observability | △ | actuator 노출 | Prometheus, OpenTelemetry, trace_id 전파 |

## 11. 면접 답변 자료화

### Q. "msa 의 Resilience 전략 한 문장으로?"

> "Order 의 외부 동기 호출 (payment, product) 에는 Resilience4j Circuit Breaker, Kafka Consumer 에는 FixedBackOff + DLT, Gateway 에는 Redis Token Bucket Rate Limiter, Inventory 의 reserve 에는 Redis 카운터 기반 Admission Control, 모든 stateful 호출은 suspend + WebClient 로 non-blocking 처리. (ADR-0015)."

### Q. "Token Bucket 이 어떻게 동시성 안전?"

> "Spring Cloud Gateway 가 Redis Lua script 로 단일 round-trip + atomic 으로 token 보충 + 차감 + TTL 갱신을 한 번에 수행. SET + INCR 분리하면 race 가능."

### Q. "왜 Resilience4j Bulkhead 를 안 쓰나?"

> "현재는 semantic bulkhead — service 별 별도 WebClient/HikariCP/Kafka group 으로 자연 격리. 명시적 동시성 제한 (max concurrent calls) 까진 안 적용. 외부 호출 폭주 시점에 추가 도입 가능."

## 12. 한 줄 진단

> ADR-0015 = **CB + DLQ + Token Bucket + Admission Control + CQRS + Non-Blocking** 의 종합 패키지.
> 코드 구현은 80% 충실. 보강 후보는 **Bulkhead 명시화 + ExponentialBackOff + Observability (OpenTelemetry trace) + Flash sale 모드 외부화**.
