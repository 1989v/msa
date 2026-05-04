---
parent: 7-distributed-systems
type: deep
order: 17
created: 2026-05-01
---

# 17. msa 의 멱등 Consumer (ADR-0012) + 재고 SSOT (ADR-0013)

> Phase 3 계속. 멱등 처리와 재고 SSOT 가 어떻게 코드에 녹아 있는지를 본다.

## 1. ADR-0012 의 결정 사항

```
1. 모든 Kafka 이벤트에 eventId (UUID) 필드
2. processed_event 테이블 (DB UNIQUE 기반)
3. Consumer 가 eventId 로 중복 체크 + 비즈니스 로직 + INSERT (같은 tx)
4. 7일 보관 정책 (스케줄러로 cleanup)
```

## 2. processed_event 테이블 — 코드 검증

```sql
-- ADR-0012 명세
CREATE TABLE processed_event (
    event_id    VARCHAR(36) PRIMARY KEY,
    topic       VARCHAR(100) NOT NULL,
    processed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_processed_at (processed_at)
);
```

JPA Entity (`fulfillment/.../ProcessedEventJpaEntity.kt`, `inventory` 도 동일):

```kotlin
@Entity
@Table(name = "processed_event")
class ProcessedEventJpaEntity(
    @Id @Column(length = 36) val eventId: String,
    @Column(nullable = false, length = 100) val topic: String,
    @Column(nullable = false) val processedAt: LocalDateTime = LocalDateTime.now(),
)
```

- PK 가 `eventId` 이므로 DB UNIQUE 보장
- TTL 없음 → cleanup 배치 필요 (7일)
- **검증 결과 (2026-05-01)**: `processed_event` 를 정리하는 `@Scheduled` 배치는 `inventory` / `fulfillment` 어디에도 **존재하지 않음**. `inventory` 의 스케줄러는 `ReservationExpiryService`(`inventory/app/.../application/reservation/service/ReservationExpiryService.kt:24`) 와 `InventoryReconciliationService`(`inventory/app/.../application/inventory/service/InventoryReconciliationService.kt:18`) 둘 뿐이며, `processed_event` 와 무관. → ADR (Architecture Decision Record, 아키텍처 결정 기록)-0012 명세 (7일 보관) 미구현 — 도입 필요 (19-improvements §7).

## 3. Outbox 측 eventId 주입

`fulfillment/.../OutboxPollingPublisher.kt`:

```kotlin
val enrichedPayload = objectMapper.readTree(event.payload).let { node ->
    (node as ObjectNode).put("eventId", event.eventId)
    objectMapper.writeValueAsString(node)
}
kafkaTemplate.send(event.eventType, event.aggregateId.toString(), enrichedPayload)
```

→ outbox row 의 `eventId` 컬럼을 payload JSON 에 주입 후 발행. consumer 는 `node.get("eventId")` 로 읽음.

**관찰**:
- outbox 테이블에 `event_id` 컬럼이 별도 존재
- payload 에는 처음엔 없을 수 있고, 발행 시 주입
- → 직렬화 타입이 ObjectNode 로 강제됨, payload 가 JSON 객체여야 함. 만약 array/primitive 면 깨질 수 있음 (현재 도메인 이벤트는 모두 object 라 OK)

## 4. Consumer 측 멱등 처리 패턴 (반복 코드)

각 consumer 의 공통 시작부:

```kotlin
@KafkaListener(topics = [...])
fun on(record: ConsumerRecord<String, String>) {
    val event = mapper.readValue(record.value(), Event::class.java)

    if (event.eventId.isNotBlank() && processedEventRepo.existsById(event.eventId)) {
        log.info("Duplicate event detected, skipping: eventId={}", event.eventId)
        return
    }

    // 비즈니스 로직
    useCase.execute(...)

    if (event.eventId.isNotBlank()) {
        processedEventRepo.save(ProcessedEventJpaEntity(event.eventId, "topic.name"))
    }
}
```

**중복 코드** — common 모듈로 추출 가능 (ADR-0012 의 4번 항목: "공통 모듈 제공" 인데 현재 코드엔 in-place 로 보임).

### 개선 후보: AOP / Decorator 추출

```kotlin
// 가상 도입
@Component
class IdempotentEventHandler(
    private val processedEventRepo: ProcessedEventJpaRepository,
) {
    fun <T> handle(eventId: String, topic: String, action: () -> T): T? {
        if (eventId.isNotBlank() && processedEventRepo.existsById(eventId)) {
            log.info("duplicate skipped: $eventId")
            return null
        }
        val result = action()
        if (eventId.isNotBlank()) {
            processedEventRepo.save(ProcessedEventJpaEntity(eventId, topic))
        }
        return result
    }
}

// 사용
@KafkaListener(topics = ["..."])
fun on(record: ...) {
    val event = mapper.readValue(...)
    idempotent.handle(event.eventId, "...") {
        useCase.execute(...)
    }
}
```

## 5. 트랜잭션 경계 — 같은 tx 내에서 중복 체크 + 비즈니스 + INSERT?

ADR-0012 의 명시:
> "비즈니스 로직 실행 + processed_event INSERT (같은 트랜잭션)"

**현재 코드 분석**:

```kotlin
// inventory/InventoryEventConsumer.kt
@KafkaListener(topics = ["order.order.completed"])
fun onOrderCompleted(record: ...) {
    if (processedEventRepo.existsById(event.eventId)) return  // 외부

    for (item in event.items) {
        reserveStockUseCase.execute(...)   // ← 각 reserve 가 @Transactional (별도 tx)
    }

    processedEventRepo.save(ProcessedEventJpaEntity(...))   // ← 외부, 또 다른 tx
}
```

**잠재 이슈**:
- 메서드 자체는 `@Transactional` 이 아님
- `reserveStockUseCase.execute` 와 `processedEventRepo.save` 가 분리된 tx
- → `reserve` 는 성공했는데 `processedEvent.save` 가 실패하면 다음 재배달 시 **이중 reserve** 가능

**개선 후보**:
- `@Transactional` 을 onOrderCompleted 에 적용 → 전체 atomic
- 또는 IdempotentEventHandler 가 tx 경계 캡슐화

## 6. ADR-0013 — Product-Inventory SSOT

```
Inventory 가 재고 SSOT
Product.stock = Inventory 이벤트 기반 read-only 캐시
```

### 6.1 Inventory 이벤트 → Product 동기화

**검증 결과 (2026-05-01)**: 실제 파일은 `product/app/src/main/kotlin/com/kgd/product/messaging/InventoryStockSyncConsumer.kt:11` (이름이 `InventoryEventConsumer` 가 아니라 `InventoryStockSyncConsumer`). 핵심 로직 (요약):

```kotlin
@KafkaListener(
    topics = ["inventory.stock.reserved", "inventory.stock.released", "inventory.stock.received"],
    groupId = "product-stock-sync",
    containerFactory = "kafkaListenerContainerFactory",
)
fun onInventoryStockChanged(record: ConsumerRecord<String, String>) {
    val node = objectMapper.readTree(record.value())
    val productId = node.get("productId").asLong()
    val availableQty = node.get("availableQty")?.asInt()
    if (availableQty != null) {
        syncProductStockUseCase.execute(SyncProductStockUseCase.Command(productId, availableQty))
    }
}
```

→ 그리고 `Product.syncStock(availableQty)` 는 `product/domain/src/main/kotlin/com/kgd/product/product/model/Product.kt:36` 에 실재. ADR-0013 의 SSOT 흐름 (Inventory → Product) 코드 확인 완료.

**주의**: 본 consumer 는 **멱등 체크 (`processedEventRepository`) 가 없음** — `Product.syncStock` 이 자연스러운 idempotent set 연산이라 안전하지만, ordering 문제로 stale availableQty 가 덮어쓸 가능성 존재 (개선 후보).

### 6.2 Product.stock 동기화 메서드

`product/domain/.../Product.kt`:
- `Product.decreaseStock()` 제거 (ADR-0013 결정)
- `Product.syncStock(availableQty)` 추가

→ Product 의 stock 변경은 **오직 inventory 이벤트로만** 일어남. 다른 곳에서 호출 시 컴파일 에러 또는 Linter 가 잡아야 함.

## 7. Optimistic Lock — @Version 검증

`inventory/app/.../InventoryJpaEntity.kt`:

```kotlin
@Entity
@Table(name = "inventory")
class InventoryJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false)
    val productId: Long,

    @Column(nullable = false)
    val warehouseId: Long,

    @Column(nullable = false)
    var availableQty: Int,

    @Column(nullable = false)
    var reservedQty: Int,

    @Version
    @Column(nullable = false)
    var version: Long = 0,
)
```

→ JPA `@Version` 이 자동으로 update 시 `WHERE version = ?` 추가. 다른 tx 가 먼저 변경했으면 `OptimisticLockException`.

### 동시 reserve 시나리오

```
TX1: SELECT inventory (version=5, available=10)
TX2: SELECT inventory (version=5, available=10)
TX1: inventory.reserve(qty=3) → available=7
TX1: UPDATE inventory SET available=7, version=6 WHERE id=? AND version=5  → 1 row
TX2: inventory.reserve(qty=4) → available=6
TX2: UPDATE inventory SET available=6, version=6 WHERE id=? AND version=5  → 0 row
TX2: → OptimisticLockException
```

→ TX2 가 fail → 재시도 (호출자가 retry 또는 사용자에게 "실패, 재시도" 안내).

## 8. Redis fast-path 의 위치

`InventoryService.execute(ReserveStockUseCase.Command)`:

```kotlin
// Redis fast-path: 사전 검증
cachePort?.let { cache ->
    val cacheResult = cache.reserveStock(command.productId, command.warehouseId, command.qty)
    if (cacheResult == null) {
        log.debug { "Redis fast-path: 재고 부족" }
        // 그래도 DB 로 진행 (캐시가 stale 일 수 있음)
    }
}
val inventory = inventoryRepository.findByProductIdAndWarehouseId(...)  // SSOT 는 DB
inventory.reserve(...)
```

**관찰**:
- Redis 가 "재고 부족" 이라도 DB 로 진행 — DB 가 SSOT
- Redis fast-path 의 목적은 **DB 부담 감소** (대부분의 reserve 시도가 캐시 사전 검증으로 거름)
- 캐시가 **권위적 결정 안 함** — 안전한 설계

## 9. Reconciliation 으로 정합성 회복

`InventoryReconciliationService`:

```kotlin
@Scheduled(fixedDelayString = "\${inventory.reconciliation.interval-ms:300000}")
fun reconcile() {
    if (cachePort == null) return
    for (inventory in inventoryRepository.findAll()) {
        val cached = cachePort.getStock(...)
        if (cached == null || cached.availableQty != inventory.getAvailableQty() ...) {
            log.warn { "Reconciliation mismatch: ..." }
            cachePort.setStock(...)
        }
    }
}
```

→ Eventual divergence 자동 회복. **Eventual Consistency 의 표준 보강**.

## 10. Producer Idempotence 설정

**검증 결과 (2026-05-01)**: `inventory/app/src/main/kotlin/com/kgd/inventory/infrastructure/config/KafkaConfig.kt:29-37` 에서 코드로 명시:

```kotlin
ProducerConfig.ACKS_CONFIG to "all",
ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG to true,
ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION to 5,
ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG to 120000,
```

`fulfillment/app/src/main/kotlin/com/kgd/fulfillment/infrastructure/config/KafkaConfig.kt:29-33` 도 동일.
**주의**: `retries` 는 명시적으로 설정 안 했음 — `enable.idempotence=true` 일 때 Kafka Producer 가 자동으로 `retries=Integer.MAX_VALUE` 로 강제하므로 의도는 같음.

→ Kafka 차원 producer 멱등성. 단, **eventId 가 메시지 본문에 있으니** consumer 측 dedup 이 진짜 보장.

## 11. 진단 종합

| 항목 | 상태 | 비고 |
|---|---|---|
| eventId 모든 이벤트에 부여 | ✓ | outbox publisher 가 주입 |
| processed_event 테이블 | ✓ | inventory, fulfillment 양쪽 |
| 멱등 체크 코드 | ✓ (in-place) | 공통 모듈 추출 후보 |
| 같은 tx 안 비즈니스+INSERT | △ | 메서드 레벨 @Transactional 미적용 → 개선 후보 |
| 자연 멱등 보강 | ✓ | fulfillment 의 findByOrderIdAndWarehouseId, processedEvent UNIQUE |
| Optimistic Lock | ✓ | @Version |
| SSOT 정의 (Product/Inventory) | ✓ | ADR-0013 |
| Reconciliation | ✓ | InventoryReconciliationService |
| processed_event cleanup | ✗ | 검증 결과: 미존재 — 도입 필요 (inventory/fulfillment 어디에도 cleanup 스케줄러 없음) |

## 12. 개선 후보 5선

### 12.1 IdempotentEventHandler 공통 모듈

```kotlin
// common 모듈
@Component
class IdempotentEventHandler(
    private val processedEventRepo: ProcessedEventJpaRepository,
) {
    @Transactional
    fun <T> handle(eventId: String, topic: String, action: () -> T): T? { ... }
}
```

→ 6개 consumer 메서드의 ~10줄 boilerplate 제거.

### 12.2 onXxx 메서드 @Transactional 추가

```kotlin
@KafkaListener(...)
@Transactional
fun onFulfillmentShipped(...) { ... }
```

→ 멱등 체크 + 비즈니스 + processedEvent.save 가 한 tx.

### 12.3 processed_event TTL 정책 명시화

- ADR-0012 명세는 7일이지만 코드/스키마에 cleanup 스케줄러 명시 필요
- partition (날짜별) 로 만들어 DROP partition 으로 효율적 삭제

### 12.4 warehouseId 라우팅

- `warehouseId = 1L` 하드코딩 → 다중 창고 시 라우팅 (지역, 재고, SLA (Service Level Agreement, 서비스 수준 협약) 기준)

### 12.5 Saga 추적 (trace_id 전파)

- OpenTelemetry 로 모든 이벤트에 trace_id / span_id 전파
- Kafka header 로 propagate
- → 한 주문의 흐름을 Jaeger 에서 한눈에

## 13. 면접 답변 자료화

### Q. "msa 에서 멱등성을 어떻게 보장?"

> "ADR-0012 가 표준입니다.
> 1. 모든 Kafka 이벤트에 UUID eventId
> 2. Outbox 발행 시 publisher 가 eventId 를 payload 에 주입
> 3. Consumer 는 processed_event 테이블 (PK = eventId) 로 dedup
> 4. 비즈니스 키 자연 멱등 (e.g., findByOrderIdAndWarehouseId) 도 추가 방어
> 5. Optimistic Lock 으로 동시 reserve race 방어
> 6. Producer 측 enable.idempotence + acks=all 로 발행 중복 방지"

### Q. "재고가 두 곳에 있는데 어떻게 일관성 유지?"

> "ADR-0013 으로 Inventory 가 SSOT, Product.stock 은 비정규화 read cache 로 정의. Inventory 변경 시 Kafka 이벤트 발행 → Product 가 consume 해서 stock 갱신. Eventual Consistency 라 일시적 불일치는 허용, 사용자 UI 에 '대략적 재고' 명시.
> Inventory 내부에서도 Redis 캐시 + DB 를 같이 쓰지만 DB 가 SSOT, Redis 는 fast-path 로만. 정합성은 InventoryReconciliationService 배치로 자동 회복."

### Q. "재고 동시 차감 어떻게 처리?"

> "InventoryJpaEntity 에 `@Version` 으로 Optimistic Lock. 동시에 두 reserve 가 같은 row 를 변경하려 하면 한쪽이 OptimisticLockException → 호출자가 재시도하거나 사용자에 '실패' 안내. Redis fast-path 가 대부분의 race 를 사전 거름."

## 14. 한 줄 진단

> ADR-0012 + ADR-0013 의 구현 = **eventId + processed_event + @Version + write-through Redis + reconciliation**.
> 보강 후보: **공통 IdempotentEventHandler 모듈 추출, consumer 메서드 @Transactional, processed_event cleanup 명시화**.
