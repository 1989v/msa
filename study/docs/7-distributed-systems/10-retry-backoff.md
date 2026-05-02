---
parent: 7-distributed-systems
type: deep
order: 10
created: 2026-05-01
---

# 10. Retry + Exponential Backoff + Jitter

> 무지성 retry 는 **장애를 키운다**. 좋은 retry 는 **(1) 멱등이 보장된 곳에만, (2) 분류된 에러에만, (3) jitter 가 있는 backoff 로** 동작한다.

## 1. Retry 의 3가지 위험

### 1.1 Thundering Herd

서비스 A 가 한 번 슬쩍 느려짐 → 모든 호출자가 동시에 재시도 → A 더 느려짐 → 자기충족적 장애.

```
t0: A 응답 5s (느림)
t5: 1000 client 동시 timeout → 동시 retry
t5: A 에 1000 동시 요청 추가 → A 더 느려짐 → 다시 timeout
```

해법: **jitter** (재시도 시점 분산).

### 1.2 Retry Storm

A 가 살짝 느려져도 호출자 (B) 가 retry → A 부하 ↑ → B 의 응답도 느려짐 → 그 위 (C) 가 retry → ...

해법:
- **Circuit Breaker** 로 빠른 실패
- 호출 체인 위쪽에서만 retry, 아래는 retry 안 함 (권장 패턴)

### 1.3 비-멱등 endpoint 재시도

```kotlin
@Retryable(maxAttempts = 3)
fun charge() = paymentApi.charge(...)  // ← 이중 결제 위험
```

해법: 멱등성 보장 (Idempotency-Key, 자연 멱등) 후에만 retry.

## 2. Backoff 알고리즘 비교

### 2.1 Fixed Delay

```
attempt 1 fail → wait 1s → attempt 2
attempt 2 fail → wait 1s → attempt 3
```

- **간단**, 하지만 thundering herd 약함
- 단발성 장애엔 OK

### 2.2 Exponential Backoff

```
attempt n: wait = base × 2^(n-1)
n=1: 1s
n=2: 2s
n=3: 4s
n=4: 8s
```

- 장애가 길어지면 부하 자동 감소
- max cap 필수 (e.g., 30초)

### 2.3 Exponential Backoff + Full Jitter (AWS 권장)

```
sleep = random(0, base × 2^n)
```

- 동시 retry 가 시간상 **균등 분포** 로 흩어짐 → thundering herd 완화
- AWS SDK, Google SDK 의 기본

### 2.4 Decorrelated Jitter (AWS 의 또 다른 추천)

```
sleep = min(cap, random(base, prev_sleep × 3))
```

- Full Jitter 보다 약간 빠르게 수렴, 분산도 유지
- AWS Architecture Blog 권장

## 3. Jitter 의 효과 시각화

```
no jitter:          ▮▮▮▮▮▮▮▮▮▮  (모든 client 가 같은 시점에 retry)
fixed delay:        ▮▮▮▮▮▮▮▮▮▮
exponential:        ▮ ▮  ▮    ▮      ▮  (혼자라면 OK)
exp + full jitter:  ▮  ▮▮ ▮  ▮▮  ▮ ▮ ▮  (수많은 client 가 시간상 분산)
```

→ **N 개 client 가 동시에 재시도해도** jitter 가 있으면 부하가 시간상 균등 분포.

## 4. 어떤 에러가 retryable 인가

### 4.1 Retryable

| 에러 | 이유 |
|---|---|
| Connection timeout | 일시 네트워크 |
| Read timeout | 서비스 일시 부하 |
| HTTP 5xx | 서버 일시 장애 |
| HTTP 429 (Rate Limit) | Retry-After 헤더 따라 |
| HTTP 503 Service Unavailable | 일시 다운 |
| Kafka NotEnoughReplicasException | ISR 회복 대기 |

### 4.2 Not retryable (즉시 실패)

| 에러 | 이유 |
|---|---|
| HTTP 4xx (400, 401, 403, 404, 422) | 클라이언트 에러, retry 무의미 |
| 인증/인가 실패 | 자격 변경 없이 재시도 무의미 |
| 비즈니스 예외 (재고 부족, 결제 거절) | 도메인 결과 |
| 직렬화 / 파싱 에러 | 코드 버그 |

### 4.3 분류 코드 예시

```kotlin
fun isRetryable(e: Throwable): Boolean = when (e) {
    is ConnectException, is SocketTimeoutException -> true
    is WebClientResponseException -> {
        e.statusCode.is5xxServerError || e.statusCode == HttpStatus.TOO_MANY_REQUESTS
    }
    is BusinessException -> false
    else -> false
}
```

## 5. Retry 코드 예시 (Kotlin + Resilience4j)

```kotlin
import io.github.resilience4j.retry.Retry
import io.github.resilience4j.retry.RetryConfig
import io.github.resilience4j.kotlin.retry.executeSuspendFunction
import java.time.Duration
import kotlin.random.Random

val retryConfig: RetryConfig = RetryConfig.custom<Any>()
    .maxAttempts(4)  // 최초 1 + retry 3
    .intervalFunction { attempt ->
        // exponential + full jitter
        val base = 200L  // ms
        val maxDelay = 5000L
        val expo = base * (1L shl (attempt - 1))  // 200, 400, 800, ...
        val capped = minOf(expo, maxDelay)
        Random.nextLong(0, capped)
    }
    .retryOnException { e -> isRetryable(e) }
    .build()

val retry = Retry.of("payment-call", retryConfig)

suspend fun chargeWithRetry(orderId: Long, amount: BigDecimal): PaymentResult =
    retry.executeSuspendFunction {
        paymentAdapter.requestPayment(orderId, amount)
    }
```

### 주의사항

- `maxAttempts` 은 최초 시도 포함 횟수
- `executeSuspendFunction` 이 코루틴-친화 (block 안 함)
- **Circuit Breaker 와 결합** 시: CB → Retry → 실제 호출 (아래 6장)

## 6. Retry + CB + Bulkhead 결합 순서

Resilience4j 의 데코레이터 순서 (안쪽이 먼저 실행):

```
Bulkhead    ← 동시 호출 수 제한 (가장 바깥)
Retry       ← 재시도 (중간)
CircuitBreaker  ← 차단 검사 (가장 안쪽, 실제 호출 직전)
```

이유:
- Retry 안에 CB 가 있어야 retry 호출 하나하나마다 CB 검사
- Bulkhead 가 가장 바깥 (전체 동시 요청 수 제한)

```kotlin
val decorated = Bulkhead.decorateSupplier(bh,
    Retry.decorateSupplier(retry,
        CircuitBreaker.decorateSupplier(cb) { actualCall() }
    )
)
```

## 7. Retry 와 Idempotency 의 짝꿍

```
Retry 는 멱등 endpoint 에만
멱등 endpoint 는 Idempotency-Key 또는 자연 멱등으로 보장
→ 두 개는 항상 함께
```

비-멱등 endpoint 에 retry = 데이터 손상 보장.

## 8. Kafka Consumer Retry

Spring Kafka 의 `DefaultErrorHandler` + `FixedBackOff` / `ExponentialBackOff`.

```kotlin
@Bean
fun errorHandler(deadLetterRecoverer: DeadLetterPublishingRecoverer): DefaultErrorHandler {
    val backOff = FixedBackOff(1000L, 3L)  // 1초 간격, 3회 재시도
    return DefaultErrorHandler(deadLetterRecoverer, backOff).apply {
        addNotRetryableExceptions(
            BusinessException::class.java,
            IllegalArgumentException::class.java,
        )
    }
}
```

→ 3회 retry 실패 시 DLT (Dead Letter Topic) 으로. ADR-0015 의 표준.

## 9. HTTP Retry-After 헤더 존중

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

서버가 "60초 후 다시" 알려주면 그걸 따르는 게 표준.

```kotlin
fun parseRetryAfter(headers: HttpHeaders): Duration? {
    val value = headers.getFirst(HttpHeaders.RETRY_AFTER) ?: return null
    return value.toLongOrNull()?.let { Duration.ofSeconds(it) }
        ?: try {
            val date = ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME)
            Duration.between(ZonedDateTime.now(), date).takeIf { !it.isNegative }
        } catch (_: Exception) { null }
}
```

## 10. Retry 의 한계 — Budget

서비스 전체에서 retry 가 차지하는 트래픽 비율을 제한해야 함.

```
retry budget = retries / total requests
budget > 10% 면 시스템이 정상 작동 못 한다는 신호 → CB OPEN 등 더 강한 조치
```

Envoy / Istio 같은 service mesh 가 retry budget 을 직접 지원.

## 11. msa 적용 진단

### 11.1 동기 호출

| 호출 | retry 정책 | 평가 |
|---|---|---|
| order → payment | CB only, retry 없음 (ADR-0015) | OK — 결제는 멱등 보장 어려워 |
| order → product | CB only | OK |
| 다른 인터널 동기 호출 | 거의 없음 | - |

### 11.2 Kafka Consumer

| Consumer | retry 정책 |
|---|---|
| 모든 consumer | DefaultErrorHandler + FixedBackOff(1s, 3) → DLT |

→ ADR-0015 표준. 단, **ExponentialBackOff + Jitter** 로 업그레이드 검토 가치 있음.

## 12. 안티패턴 모음

```kotlin
// 1. 무한 retry
while (true) {
    try { call() ; break } catch (e: Exception) { /* retry */ }
}

// 2. jitter 없는 retry
Thread.sleep(1000L * attempt)  // 모든 client 가 동기화돼서 retry

// 3. 모든 에러 retry
catch (e: Exception) { retry() }  // 4xx 도 retry

// 4. 비-멱등 endpoint retry
@Retryable
fun createOrder() { ... }   // 매번 새 주문 생성

// 5. Retry 안에 무거운 작업
@Retryable
fun processFile() {
    parseHugeFile()        // ← 매 retry 마다 다시 파싱
    callExternalApi()
}
```

## 13. 면접 5문답

### Q1. "Exponential Backoff 가 왜 jitter 가 필요한가요?"

> "수많은 client 가 동시에 retry 하면 같은 시점에 부하가 스파이크 (thundering herd). full jitter (`sleep = random(0, cap)`) 로 시간상 분산시키면 부하가 균등해져 회복이 빠름."

### Q2. "어떤 에러를 retry 해도 되나요?"

> "**일시적 (transient)** 에러만. 5xx, timeout, 429, connection error. 4xx (특히 400, 401, 403, 422) 는 retry 무의미. 비즈니스 예외도 retry 안 함."

### Q3. "Retry 와 Circuit Breaker 의 순서?"

> "Resilience4j 데코레이터로 Retry → CircuitBreaker (안쪽). retry 호출 하나하나마다 CB 검사가 들어가야 함. CB 가 OPEN 이면 retry 도 의미 없으니 즉시 실패."

### Q4. "비-멱등 endpoint 를 retry 해야 하면?"

> "두 가지 옵션. (1) **Idempotency-Key** 를 매 retry 같은 값으로 보냄 → 서버가 dedup. (2) endpoint 자체를 멱등으로 재설계 (PUT semantics, eventId)."

### Q5. "msa 의 Kafka Consumer retry 정책은?"

> "ADR-0015 표준: FixedBackOff(1s, 3 attempts) → DLT. 개선 후보로 ExponentialBackOff(1s → 8s) + Jitter 가 thundering herd 에 더 안전."

## 14. 한 줄 요약

> Retry 의 3원칙: **(1) 멱등 보장, (2) retryable 에러만, (3) jitter 있는 exponential backoff**.
> 무지성 retry 는 장애 증폭기. CB / Bulkhead / Idempotency 와 함께 가야 안전.
