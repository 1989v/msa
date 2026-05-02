---
parent: 7-distributed-systems
type: deep
order: 15
created: 2026-05-01
---

# 15. Event Sourcing + CQRS + Exactly-Once

> Event Sourcing 은 **"상태는 이벤트의 누적"** 으로 보는 패러다임. CQRS 는 **read 와 write 의 분리**. 둘은 자주 함께 쓰이지만 **별개 패턴**.

## 1. Event Sourcing (ES)

### 1.1 정의

> 도메인 객체의 상태를 저장하는 대신 **상태를 변화시킨 이벤트 시퀀스** 를 저장. 현재 상태는 이벤트들을 재생 (replay) 해서 얻음.

```
전통: order_table { id=1, status='SHIPPED', total=10000 }
ES:   event_store [
        OrderCreated(id=1, items=...),
        ItemsCharged(id=1, amount=10000),
        OrderShipped(id=1)
      ]
```

### 1.2 강점

- **완전한 audit trail** — "왜 이 상태인가" 의 모든 이력
- **시간 여행** — 임의 시점의 상태 재구성 가능
- **새 read model 추가 쉬움** — 같은 이벤트 stream 으로 다른 projection 만들기
- **비즈니스 분석** — 이벤트 단위 분석 가능

### 1.3 단점

- **복잡도 ↑** — 모든 변경을 이벤트로 모델링 (학습곡선)
- **migration 어려움** — 과거 이벤트 스키마 호환성 (event versioning)
- **현재 상태 query 비싼** — replay 비용 → snapshot 으로 해결
- **작은 시스템엔 과도**

### 1.4 Snapshot

100개 이벤트 누적되면 매번 replay 비싸 → 100개마다 snapshot 저장.

```
event_store: [E1, E2, ..., E100, snapshot{state at 100}, E101, E102, ...]
load: snapshot 부터 재생 (E101 부터)
```

### 1.5 ES 적합 도메인

| 적합 | 부적합 |
|---|---|
| 금융 (계좌 잔액 = 거래 내역의 합) | CRUD 단순 도메인 |
| 게임 (캐릭터 상태) | 사용자 프로필 (단순) |
| 사용자 행동 audit (compliance) | 검색/추천 |
| 협업 도구 (Yjs, Figma) | 통계 집계 |
| 워크플로우 / Saga | - |

## 2. CQRS (Command Query Responsibility Segregation)

### 2.1 정의

> Command (쓰기) 와 Query (읽기) 모델을 **분리**. write 는 도메인 모델로, read 는 비정규화된 read model 로.

```
[Write side]
Command → Domain Model → Event → Event Store

[Read side]
Event → Projection → Read Model (denormalized)
Query → Read Model (직접 read)
```

### 2.2 강점

- **read 와 write 가 다른 부하 패턴**: read scale 따로, write scale 따로
- **read model 이 domain 에 종속 X**: read 친화적 비정규화
- **다양한 read model**: ES + ClickHouse + Redis projection 모두 가능
- **read consistency 옵션 다양**: strong (write side) / eventual (read side)

### 2.3 단점

- **데이터 동기화 (eventual consistency)** — read 가 stale
- **복잡도 ↑**
- read model 마다 별도 코드

### 2.4 CQRS ≠ ES

CQRS 와 ES 는 **함께** 자주 쓰이지만 서로 독립:
- CQRS only: write 는 RDBMS, read 는 elastic / redis projection
- ES only: 이벤트만 저장, query 도 같은 store
- ES + CQRS: 가장 강력

## 3. msa 의 CQRS 적용 (ADR-0015)

### 3.1 Inventory 의 CQRS

```
[Command: Reserve]
Inventory.reserve() → DB UPDATE (master)

[Query: Read]
GET /api/inventories/{productId}
  → Redis 조회 (read model, denormalized)
  → miss → DB → Redis 캐시
```

### 3.2 코드 구조

```kotlin
// Write side (InventoryService.execute)
override fun execute(command: ReserveStockUseCase.Command): Result {
    val inventory = inventoryRepository.findByProductIdAndWarehouseId(...)
    inventory.reserve(command.qty)
    val saved = inventoryRepository.save(inventory)
    syncCache(...)  // Write-Through
    outboxPort.save("inventory.stock.reserved", ...)
    return Result(...)
}

// Read side (write-through 갱신)
private fun syncCache(productId: Long, warehouseId: Long, inventory: Inventory) {
    cachePort?.setStock(productId, warehouseId, inventory.getAvailableQty(), inventory.getReservedQty())
}

// Read query
override fun execute(query: GetInventoryUseCase.Query): List<Result> {
    return inventoryRepository.findAllByProductId(query.productId).map { inventory ->
        val cached = cachePort?.getStock(...)  // Redis 우선
        Result(
            availableQty = cached?.availableQty ?: inventory.getAvailableQty(),
            ...
        )
    }
}
```

→ **Write-Through CQRS**. ES 까진 안 감 (event 는 outbox 로 발행하지만 store 는 RDBMS 정통).

### 3.3 Reconciliation

```kotlin
// InventoryReconciliationService
@Scheduled(fixedDelay = 5min)
fun reconcile() {
    for (inv in inventoryRepository.findAll()) {
        val cached = cachePort.getStock(inv.productId, inv.warehouseId)
        if (cached == null || cached != inv) {
            cachePort.setStock(...)  // DB → Redis 정합성 회복
        }
    }
}
```

→ **Eventual Consistency** 로 발생할 수 있는 divergence 를 주기 정합성 회복으로 흡수.

## 4. ES 도입을 검토할 만한 곳 (msa)

| 도메인 | 도입 효과 | 현실적 검토 |
|---|---|---|
| order | 주문 상태 변경 이력 정확히 추적 | 도입 가치 있음, 다만 비용 큼 |
| payment / refund | 회계 audit 매우 중요 | ES 적합도 1순위 |
| auth.role | 누가 언제 어떤 role 부여했는지 | 적합 |
| quant (자동매매) | 거래 내역이 본질적으로 stream | 가장 적합 — 별도 ADR 후보 |
| analytics | 이미 이벤트 기반 | 자연 ES |
| product / search / wishlist | CRUD 단순 | 비추 |

→ 19-improvements.md 에서 **ES 도입 검토 ADR 후보** 로 정리.

## 5. ES 의 Event Versioning

```kotlin
// V1
data class OrderShipped(val orderId: Long, val shippedAt: Instant)

// 6개월 후, V2 — trackingNumber 추가
data class OrderShipped(val orderId: Long, val shippedAt: Instant, val trackingNumber: String?)
```

해법:
- **이벤트 schema versioning** (Avro, Protobuf)
- **upcaster**: 옛 이벤트를 read 시점에 V2 로 변환
- **이벤트는 절대 수정/삭제 안 함** — append-only

## 6. Exactly-Once Semantics — 이게 가능한가

> "메시지가 정확히 한 번만 처리됨"

엄밀히는 **분산 시스템에서 진정한 EOS 는 불가능**. 가능한 건:
1. **At-least-once + Idempotency** = effectively-once (관측상 한 번)
2. **Kafka Transactional Producer + Consumer (read-process-write)** = Kafka 클러스터 안의 EOS (외부 sink 와는 분리)

### 6.1 Kafka EOS 메커니즘

```
producer.transactional.id = "tx-1"
producer.beginTransaction()
producer.send(topic1, ...)
producer.send(topic2, ...)
consumer.commitOffsetsToTransaction(...)
producer.commitTransaction()
```

- Kafka 자체 (여러 partition / topic) 에 대한 atomic write
- **외부 DB 와는 분리** — DB 와 같이 EOS 하려면 Outbox 패턴

### 6.2 Effectively-Once 패턴 (실용적 정답)

```
Producer side: enable.idempotence=true + Outbox + eventId
Consumer side: processed_event/Inbox UNIQUE
DB side:        @Transactional
```

→ msa 가 정확히 이 조합. **사실상 EOS 동등 효과** + 구현 가능성.

## 7. ES + CQRS 코드 스케치 (가상 도입 시)

```kotlin
// Event
sealed interface OrderEvent {
    val orderId: Long
    val timestamp: Instant
    data class Created(override val orderId: Long, val items: List<Item>, override val timestamp: Instant) : OrderEvent
    data class ItemsCharged(override val orderId: Long, val amount: BigDecimal, override val timestamp: Instant) : OrderEvent
    data class Shipped(override val orderId: Long, val trackingNumber: String, override val timestamp: Instant) : OrderEvent
    data class Cancelled(override val orderId: Long, val reason: String, override val timestamp: Instant) : OrderEvent
}

// Aggregate (state from events)
class OrderAggregate(val id: Long) {
    private var status: OrderStatus = OrderStatus.PENDING
    private var amount: BigDecimal = BigDecimal.ZERO

    fun apply(event: OrderEvent) {
        when (event) {
            is OrderEvent.Created -> { status = OrderStatus.CREATED }
            is OrderEvent.ItemsCharged -> { status = OrderStatus.PAID; amount = event.amount }
            is OrderEvent.Shipped -> { status = OrderStatus.SHIPPED }
            is OrderEvent.Cancelled -> { status = OrderStatus.CANCELLED }
        }
    }

    companion object {
        fun loadFromEvents(events: List<OrderEvent>): OrderAggregate {
            val agg = OrderAggregate(events.first().orderId)
            events.forEach { agg.apply(it) }
            return agg
        }
    }
}

// Repository
class OrderEventStore(private val jpa: OrderEventJpaRepository) {
    fun load(orderId: Long): OrderAggregate {
        val events = jpa.findAllByOrderIdOrderByVersionAsc(orderId).map { it.toEvent() }
        return OrderAggregate.loadFromEvents(events)
    }

    fun append(orderId: Long, event: OrderEvent, expectedVersion: Long) {
        val maxVersion = jpa.findMaxVersionByOrderId(orderId) ?: 0
        if (maxVersion != expectedVersion) throw OptimisticLockException(...)
        jpa.save(OrderEventJpaEntity.fromEvent(event, version = expectedVersion + 1))
    }
}

// Projection (read model)
@Component
class OrderListReadModelProjection(
    private val readRepo: OrderListReadModelRepository,
) {
    @KafkaListener(topics = ["order-events"])
    fun on(event: OrderEvent) {
        when (event) {
            is OrderEvent.Created -> readRepo.save(...)
            is OrderEvent.Shipped -> readRepo.updateStatus(event.orderId, "SHIPPED")
            // ...
        }
    }
}
```

## 8. ES 의 함정

### 8.1 GDPR / 개인정보 삭제

ES = append-only → 개인정보 이벤트 삭제 곤란.

해법:
- 개인정보는 별도 table (mutable), 이벤트엔 reference 만
- Crypto-shredding: 이벤트 내 개인정보를 암호화 → 키 삭제 시 복구 불가

### 8.2 거대한 stream

aggregate 가 수백만 이벤트 누적 → snapshot 필수.

### 8.3 Eventual Consistency 의 UX

- 사용자가 주문 후 즉시 list page 가면 안 보일 수 있음 → "처리 중" 또는 RYW 처리

## 9. ES vs Outbox 비교

| 차원 | Event Sourcing | Outbox |
|---|---|---|
| 이벤트의 역할 | **상태 자체** | 발행 보장 메커니즘 |
| 비즈니스 데이터 | event store 만 | 정통 RDBMS table + outbox |
| Read | projection 또는 replay | 정통 RDBMS query |
| 복잡도 | 매우 높음 | 보통 |
| 적용 비용 | 큼 (전면 재설계) | 작음 (테이블 추가) |
| 추천 | critical / audit 도메인 | 거의 모든 MSA 분산 tx |

→ msa 는 **Outbox 까지** 도입. ES 는 별도 ADR 후보 (특히 quant).

## 10. 면접 6문답

### Q1. "Event Sourcing 의 본질?"

> "상태를 직접 저장하지 않고 상태를 변화시킨 이벤트 시퀀스를 저장. 현재 상태 = 이벤트들의 replay. 완전한 audit trail + 시간 여행 + 새 read model 추가 용이가 강점."

### Q2. "CQRS 와 ES 의 관계?"

> "별개 패턴. CQRS = read/write 모델 분리, ES = 상태 = 이벤트 누적. 자주 함께 쓰이지만 따로 쓸 수도 있음. msa 는 CQRS 만 (inventory 의 read model = Redis), ES 는 미적용."

### Q3. "Exactly-Once Semantics 가 가능한가?"

> "엄밀한 EOS 는 분산 시스템에서 불가능. 실용적으로는 **at-least-once + 멱등** = effectively-once. msa 는 Outbox + enable.idempotence + processed_event 로 사실상 EOS 동등."

### Q4. "Kafka transactional producer 가 EOS 보장 아닌가?"

> "Kafka 안의 read-process-write (여러 topic atomic) 만 보장. 외부 DB 와는 분리. DB-Kafka EOS 는 Outbox 가 답."

### Q5. "ES 를 도입하면 좋은 도메인?"

> "(1) 금융/회계 — audit 절대, (2) 사용자 행동 / compliance, (3) 워크플로우 / Saga 추적, (4) 협업 도구. msa 에선 quant (자동매매) 이 1순위 후보."

### Q6. "ES 의 가장 큰 함정?"

> "Event versioning. 6개월 후 새 필드 추가 시 옛 이벤트와 호환성. → upcaster + Avro/Protobuf schema 진화 + 이벤트 절대 수정 X."

## 11. 한 줄 요약

> Event Sourcing 은 **상태=이벤트 누적** 패러다임, CQRS 는 **read/write 모델 분리**, EOS 는 **at-least-once + 멱등** 으로 흉내.
> msa 는 CQRS + Outbox + 멱등 Consumer 로 **effectively-once** 달성. ES 는 별도 ADR 후보.
