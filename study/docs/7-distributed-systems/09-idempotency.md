---
parent: 7-distributed-systems
type: deep
order: 09
created: 2026-05-01
---

# 09. Idempotency — 분산 시스템의 면역체계

> 분산 환경의 모든 호출은 **at-least-once** 가 기본. 따라서 모든 핸들러는 **멱등** 이어야 한다 — 이게 단 하나의 진리.

## 1. 멱등성 정의

> f 가 멱등이다 ⟺ f(x) 와 f(f(x)) 와 f(f(f(x))) 가 모두 같은 결과.
> 구체적: **같은 요청을 여러 번 보내도 시스템 상태와 응답이 동일**.

| 함수 | 멱등? |
|---|---|
| GET /user/123 | ✓ (응답 같음, 상태 변경 X) |
| PUT /user/123 (전체 교체) | ✓ (몇 번 해도 같은 상태) |
| DELETE /user/123 | ✓ (없으면 그냥 없음, 200/204) |
| POST /orders (새 주문 생성) | ✗ (호출마다 새 주문) |
| POST /charge (결제 차감) | ✗ (호출마다 차감) |

## 2. 왜 멱등이 필요한가

### 2.1 At-least-once 메시징의 본질

Kafka, SQS, RabbitMQ 모두 기본은 at-least-once.

```
producer → broker: send → broker ack 손실 → producer 재시도 → 중복 발행
broker → consumer: deliver → consumer 처리 → ack 손실 → broker 재배달
```

→ 어떤 단계든 ack 손실은 항상 가능. 중복은 **막을 수 없음**, **흡수해야** 함.

### 2.2 동기 호출의 timeout

```kotlin
suspend fun charge(orderId: Long, amount: BigDecimal): PaymentResult {
    // 5초 timeout
    return webClient.post().uri("/charge").bodyValue(...).awaitSingle()
    // timeout 발생 → 결제가 됐는지 안 됐는지 모름
    // 재시도 = 이중 결제 위험
}
```

→ 결제 API 가 멱등하지 않으면 timeout = 재시도 = 사용자 두 번 청구.

## 3. 멱등성 구현 4가지 패턴

### 3.1 Natural Idempotency (가장 간단)

연산 자체가 멱등인 경우.

```kotlin
// 절대값 설정 (PUT semantics)
fun setStock(productId: Long, qty: Int) {
    inventoryRepo.update(productId, qty)
}
setStock(1, 100)  // qty = 100
setStock(1, 100)  // qty = 100 (변화 없음)
```

vs 비-멱등:
```kotlin
fun decreaseStock(productId: Long, qty: Int) {
    inventoryRepo.decrease(productId, qty)
}
decreaseStock(1, 5)  // 100 → 95
decreaseStock(1, 5)  // 95 → 90 (위험!)
```

**원칙**: 가능하면 **절대값 (set)** 으로 설계. 차감/증가는 멱등 키 필요.

### 3.2 Idempotency Key (Stripe 식)

API 클라이언트가 unique key 를 헤더로 전달.

```http
POST /charge
Idempotency-Key: 4f2a8c1e-7d92-4b1a-9c3e-...
{ "amount": 10000 }
```

서버는 (key, response) 를 캐시 → 같은 key 재요청 시 캐시된 응답 반환.

```kotlin
@RestController
class PaymentController(
    private val redis: StringRedisTemplate,
    private val paymentService: PaymentService,
    private val mapper: ObjectMapper,
) {
    @PostMapping("/charge")
    fun charge(
        @RequestHeader("Idempotency-Key") key: String,
        @RequestBody req: ChargeRequest,
    ): ResponseEntity<ChargeResponse> {
        val cacheKey = "idem:charge:$key"

        // 1. 캐시된 응답이 있나?
        redis.opsForValue().get(cacheKey)?.let {
            return ResponseEntity.ok(mapper.readValue(it, ChargeResponse::class.java))
        }

        // 2. SETNX 로 in-progress 마커 (race condition 방지)
        val locked = redis.opsForValue().setIfAbsent(
            "$cacheKey:lock", "1", Duration.ofSeconds(30)
        ) ?: false
        if (!locked) {
            // 동시 두 요청 → 두 번째는 409 또는 폴링
            return ResponseEntity.status(HttpStatus.CONFLICT).build()
        }

        try {
            // 3. 실제 처리
            val response = paymentService.charge(req)
            val json = mapper.writeValueAsString(response)
            redis.opsForValue().set(cacheKey, json, Duration.ofHours(24))
            return ResponseEntity.ok(response)
        } finally {
            redis.delete("$cacheKey:lock")
        }
    }
}
```

**보존 기간**: Stripe 는 24시간. 너무 길면 Redis 비용, 너무 짧으면 재시도 미보호.

### 3.3 멱등 Consumer (Inbox / processed_event)

Kafka Consumer 가 같은 메시지를 두 번 받는 시나리오 방어. msa 의 ADR (Architecture Decision Record, 아키텍처 결정 기록)-0012.

```sql
CREATE TABLE processed_event (
    event_id    VARCHAR(36) PRIMARY KEY,
    topic       VARCHAR(100) NOT NULL,
    processed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_processed_at (processed_at)
);
```

```kotlin
// msa/inventory/InventoryEventConsumer.kt 의 실제 패턴
@Component
class InventoryEventConsumer(
    private val reserveStock: ReserveStockUseCase,
    private val processedEventRepo: ProcessedEventJpaRepository,
    private val mapper: ObjectMapper,
) {
    @KafkaListener(topics = ["order.order.completed"])
    fun on(record: ConsumerRecord<String, String>) {
        val event = mapper.readValue(record.value(), OrderCompletedEvent::class.java)

        // 1. 이미 처리됐나?
        if (processedEventRepo.existsById(event.eventId)) {
            log.info("duplicate skipped: {}", event.eventId)
            return
        }

        // 2. 비즈니스 로직 + processed_event INSERT 가 같은 트랜잭션
        for (item in event.items) {
            reserveStock.execute(ReserveStockUseCase.Command(
                orderId = event.orderId,
                productId = item.productId,
                qty = item.quantity,
                warehouseId = 1L,
            ))
        }
        processedEventRepo.save(ProcessedEventJpaEntity(event.eventId, "order.order.completed"))
    }
}
```

### 3.4 DB UNIQUE constraint

비즈니스 키 자체가 unique 하면 자연 멱등.

```sql
CREATE TABLE reservation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    UNIQUE KEY uk_order_product (order_id, product_id)
);
```

```kotlin
try {
    reservationRepo.save(reservation)
} catch (e: DataIntegrityViolationException) {
    // 이미 예약되어 있음 → 멱등 skip
    log.info("duplicate reservation: orderId={}", reservation.orderId)
}
```

→ 가장 안전. **항상 가능하면 자연키 unique 설계**.

## 4. SETNX vs DB UNIQUE — 어떤 게 좋은가

| 차원 | Redis SETNX | DB UNIQUE |
|---|---|---|
| 속도 | 빠름 (ms) | 보통 (트랜잭션 + index) |
| 영속성 | TTL 후 휘발 | 영구 |
| 일관성 | Redis 단일 master 면 OK | 강함 |
| 장애 시 | Redis 다운 = 전체 장애 | DB 가용성에 의존 |
| 보관 정책 | TTL 자동 | 별도 cleanup 필요 |

**ADR-0012 의 결정**: DB UNIQUE (processed_event) 를 선택. 이유: "Redis 장애 시 보장 불가, DB 가 더 안전".

→ 단, 보관 정책 (msa 는 7일) 으로 무한 누적 방지.

## 5. Idempotency Key 의 미묘한 함정

### 5.1 같은 key + 다른 body

```http
POST /charge
Idempotency-Key: abc-123
{ "amount": 10000 }

POST /charge
Idempotency-Key: abc-123
{ "amount": 99999 }   ← 다른 금액!
```

→ Stripe: **422 Unprocessable Entity** 반환 (key 재사용 + body mismatch).

해법: 캐시에 (key, body_hash, response) 같이 저장. mismatch 시 reject.

### 5.2 In-progress 동시성

같은 key 두 요청이 거의 동시에 도달.

```
req1: 캐시 없음 → 처리 시작 (10초 걸림)
req2 (5초 후): 캐시 없음 → 처리 시작 (이중 처리!)
```

해법: SETNX in-progress lock + 두 번째 요청은 폴링 또는 409.

### 5.3 처리 중 죽음

req 처리 중 서버가 죽음 → in-progress 마커만 남음. → TTL 로 자동 풀림 (e.g., 30초).

## 6. Saga + 멱등성 = 안전

```
Saga 의 각 단계는 At-least-once 시도
  → 동일 단계 중복 가능
  → 멱등이 없으면 saga 전체 정합성 깨짐
```

msa 의 흐름:

```kotlin
// 1. order 가 OrderCompleted 발행 (Outbox + eventId)
outbox.save(eventType="order.order.completed", payload=mapper.writeValueAsString(event.copy(eventId=UUID.randomUUID())))

// 2. inventory 가 consume → eventId 로 중복 체크 → reserve
// 3. inventory 가 StockReserved 발행 (eventId 새로 생성)
// 4. fulfillment 가 consume → eventId 로 중복 체크 → 풀필먼트 생성
```

각 단계가 모두 멱등이라야 어디서 재시도 / 중복이 발생해도 정합성 유지.

## 7. HTTP 메서드별 멱등성

| Method | RFC 7231 멱등 정의 |
|---|---|
| GET | ✓ |
| HEAD | ✓ |
| OPTIONS | ✓ |
| PUT | ✓ |
| DELETE | ✓ |
| POST | ✗ (기본) |
| PATCH | ✗ (기본, 구현 의존) |

→ POST 를 멱등으로 만들고 싶으면 **Idempotency-Key 헤더** 표준 사용.

## 8. 메시지 producer 의 멱등성

### 8.1 Kafka Producer

```yaml
spring.kafka.producer:
  acks: all
  enable-idempotence: true   # 같은 producer 의 같은 메시지 중복 발행 방지
  retries: Integer.MAX_VALUE
  max-in-flight-requests-per-connection: 5
```

`enable.idempotence=true` 가 보장하는 것:
- 같은 producer instance 의 같은 메시지가 broker 에 중복 저장 안 됨
- producer 가 재시작하면? → 새 producer ID 라 안 됨

→ **producer 의 idempotence 만으론 부족**. **eventId** 를 메시지 본문에 박아서 consumer 측에서 dedup 해야 완전.

### 8.2 Outbox 패턴

DB tx commit + Kafka publish 의 원자성. 14번에서 자세히.

## 9. 멱등성 안티패턴

### 9.1 timestamp 기반 dedup

```kotlin
if (event.timestamp == lastProcessed.timestamp) skip()  // ← 위험
```

→ 같은 timestamp 의 다른 이벤트가 있을 수 있음. **eventId (UUID)** 로.

### 9.2 in-memory dedup map

```kotlin
val processed = ConcurrentHashMap<String, Boolean>()  // ← 재시작 시 사라짐
```

→ 재시작 시 dedup 무효화. **DB / Redis 영속 저장**.

### 9.3 application-level retry + 비-멱등 endpoint

```kotlin
@Retryable(maxAttempts = 3)
fun charge() {
    paymentApi.charge(...)  // ← 이중 결제 위험
}
```

→ 재시도는 멱등 endpoint 에만. 또는 Idempotency-Key 동봉.

## 10. msa 프로젝트 멱등성 진단

| Consumer | 멱등 처리 | eventId 출처 | 평가 |
|---|---|---|---|
| inventory.InventoryEventConsumer | ✓ processed_event | OrderCompletedEvent.eventId | 양호 |
| fulfillment.FulfillmentEventConsumer | ✓ processed_event | inventory.stock.reserved.eventId | 양호 |
| product (stock 동기화 consumer) | △ ES doc id 자연 멱등 | - | OK |
| search (indexing consumer) | △ ES doc id 자연 멱등 | - | OK |

| Producer | 멱등 처리 | 평가 |
|---|---|---|
| 모든 Outbox 발행 | enable.idempotence + eventId | 양호 |
| order → payment 동기 호출 | Idempotency-Key 미사용 | **개선 필요** |

→ 19-improvements.md 에서 order → payment 의 Idempotency-Key 도입 제안.

## 11. 면접 5문답

### Q1. "멱등성이 왜 그렇게 중요한가요?"

> "분산 환경의 모든 메시징과 동기 호출은 at-least-once 가 기본 가정이라 중복은 **항상** 발생. 멱등이 없으면 timeout 시 재시도가 이중 결제, 이중 예약 같은 사고로 직결됩니다."

### Q2. "어떻게 보장하시나요?"

> "4가지 패턴 조합:
> 1. **자연 멱등** (PUT 절대값 set)
> 2. **DB UNIQUE** (비즈니스 키 unique)
> 3. **Idempotency-Key** 헤더 (외부 API)
> 4. **processed_event** 테이블 (Kafka consumer)
> msa 는 4번이 표준 (ADR-0012)."

### Q3. "Idempotency-Key 의 보관 기간은?"

> "Stripe 표준 24시간. 너무 길면 Redis 비용, 짧으면 재시도 미보호. msa 는 processed_event 7일 (ADR-0012)."

### Q4. "같은 key 다른 body 면?"

> "Stripe 식 422 Unprocessable Entity. 캐시에 body hash 같이 저장 → mismatch 시 reject."

### Q5. "Kafka Producer enable.idempotence 가 다 해결하지 않나?"

> "아니요. (1) 같은 producer instance 안에서만 보장 (재시작하면 새 producer ID), (2) consumer 측 중복 (재배달) 은 별개. 따라서 **eventId + processed_event** 가 추가로 필요."

## 12. 한 줄 요약

> 멱등성은 분산 시스템의 **면역체계**. 모든 핸들러는 **eventId/Idempotency-Key + 영속 저장소 + 자연 멱등 설계** 로 무장.
> 멱등 없는 Saga / Retry / 메시징은 모두 사고로 가는 직행 티켓.
