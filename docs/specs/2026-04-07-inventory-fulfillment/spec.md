# Spec: Inventory + Fulfillment Service

**Date**: 2026-04-07
**Status**: DRAFT
**Author**: Claude + kgd

---

## 1. 개요

기존 MSA Commerce Platform에 재고관리(Inventory) + 풀필먼트(Fulfillment) 서비스를 추가한다.
예약 기반 재고 모델과 상태 머신 기반 풀필먼트를 Clean Architecture + Nested Submodule 구조로 구현한다.

---

## 2. 모듈 구조

### 2.1 Gradle Modules

```
settings.gradle.kts 추가:
  "inventory:domain"
  "inventory:app"
  "fulfillment:domain"
  "fulfillment:app"
```

### 2.2 Inventory 패키지 구조

```
inventory/
├── domain/                         ← :inventory:domain (순수 Kotlin)
│   └── src/main/kotlin/com/kgd/inventory/domain/
│       ├── inventory/
│       │   ├── model/
│       │   │   ├── Inventory.kt          # Aggregate Root
│       │   │   ├── InventoryId.kt        # Value Object (productId + warehouseId)
│       │   │   └── Quantity.kt           # Value Object
│       │   ├── event/
│       │   │   └── InventoryEvent.kt     # Domain Events (sealed)
│       │   └── exception/
│       │       └── InventoryException.kt
│       └── reservation/
│           ├── model/
│           │   ├── Reservation.kt        # Entity
│           │   └── ReservationStatus.kt  # Enum
│           ├── event/
│           │   └── ReservationEvent.kt
│           └── exception/
│               └── ReservationException.kt
│
└── app/                            ← :inventory:app (Spring Boot)
    └── src/main/kotlin/com/kgd/inventory/
        ├── application/
        │   ├── inventory/
        │   │   ├── usecase/
        │   │   │   ├── ReserveStockUseCase.kt
        │   │   │   ├── ReleaseStockUseCase.kt
        │   │   │   ├── ConfirmStockUseCase.kt
        │   │   │   ├── ReceiveStockUseCase.kt
        │   │   │   └── GetInventoryUseCase.kt
        │   │   ├── service/
        │   │   │   └── InventoryService.kt
        │   │   ├── port/
        │   │   │   ├── InventoryRepositoryPort.kt
        │   │   │   ├── ReservationRepositoryPort.kt
        │   │   │   └── OutboxPort.kt
        │   │   └── dto/
        │   │       └── InventoryDtos.kt
        │   └── reservation/
        │       ├── usecase/
        │       │   └── ExpireReservationsUseCase.kt
        │       └── service/
        │           └── ReservationExpiryService.kt
        ├── infrastructure/
        │   ├── persistence/
        │   │   ├── inventory/
        │   │   │   ├── entity/InventoryJpaEntity.kt
        │   │   │   ├── repository/InventoryJpaRepository.kt
        │   │   │   └── adapter/InventoryRepositoryAdapter.kt
        │   │   ├── reservation/
        │   │   │   ├── entity/ReservationJpaEntity.kt
        │   │   │   ├── repository/ReservationJpaRepository.kt
        │   │   │   └── adapter/ReservationRepositoryAdapter.kt
        │   │   └── outbox/
        │   │       ├── entity/OutboxJpaEntity.kt
        │   │       ├── repository/OutboxJpaRepository.kt
        │   │       └── adapter/OutboxAdapter.kt
        │   ├── messaging/
        │   │   ├── InventoryEventConsumer.kt
        │   │   ├── OutboxPollingPublisher.kt
        │   │   └── event/InventoryKafkaEvents.kt
        │   └── config/
        │       ├── DataSourceConfig.kt
        │       ├── KafkaConfig.kt
        │       └── SchedulerConfig.kt
        └── presentation/
            └── inventory/
                ├── controller/InventoryController.kt
                └── dto/InventoryRequestDtos.kt
```

### 2.3 Fulfillment 패키지 구조

```
fulfillment/
├── domain/                         ← :fulfillment:domain (순수 Kotlin)
│   └── src/main/kotlin/com/kgd/fulfillment/domain/
│       └── fulfillment/
│           ├── model/
│           │   ├── FulfillmentOrder.kt   # Aggregate Root
│           │   └── FulfillmentStatus.kt  # Enum + 상태 머신
│           ├── event/
│           │   └── FulfillmentEvent.kt   # Domain Events (sealed)
│           └── exception/
│               └── FulfillmentException.kt
│
└── app/                            ← :fulfillment:app (Spring Boot)
    └── src/main/kotlin/com/kgd/fulfillment/
        ├── application/
        │   └── fulfillment/
        │       ├── usecase/
        │       │   ├── CreateFulfillmentUseCase.kt
        │       │   ├── TransitionFulfillmentUseCase.kt
        │       │   └── GetFulfillmentUseCase.kt
        │       ├── service/
        │       │   └── FulfillmentService.kt
        │       ├── port/
        │       │   ├── FulfillmentRepositoryPort.kt
        │       │   └── OutboxPort.kt
        │       └── dto/
        │           └── FulfillmentDtos.kt
        ├── infrastructure/
        │   ├── persistence/
        │   │   ├── fulfillment/
        │   │   │   ├── entity/FulfillmentOrderJpaEntity.kt
        │   │   │   ├── repository/FulfillmentOrderJpaRepository.kt
        │   │   │   └── adapter/FulfillmentRepositoryAdapter.kt
        │   │   └── outbox/
        │   │       ├── entity/OutboxJpaEntity.kt
        │   │       ├── repository/OutboxJpaRepository.kt
        │   │       └── adapter/OutboxAdapter.kt
        │   ├── messaging/
        │   │   ├── FulfillmentEventConsumer.kt
        │   │   ├── OutboxPollingPublisher.kt
        │   │   └── event/FulfillmentKafkaEvents.kt
        │   └── config/
        │       ├── DataSourceConfig.kt
        │       └── KafkaConfig.kt
        └── presentation/
            └── fulfillment/
                ├── controller/FulfillmentController.kt
                └── dto/FulfillmentRequestDtos.kt
```

---

## 3. Domain Model 상세

### 3.1 Inventory (Aggregate Root)

```kotlin
class Inventory private constructor(
    val id: Long? = null,
    val productId: Long,
    val warehouseId: Long,
    private var availableQty: Int,
    private var reservedQty: Int,
    val version: Long = 0
) {
    companion object {
        fun create(productId: Long, warehouseId: Long, initialQty: Int): Inventory
    }

    fun reserve(qty: Int): InventoryEvent.StockReserved  // available 부족 시 InsufficientStockException
    fun release(qty: Int): InventoryEvent.StockReleased  // reserved 부족 시 예외
    fun confirm(qty: Int): InventoryEvent.StockConfirmed // reserved → 확정 차감
    fun receive(qty: Int): InventoryEvent.StockReceived  // 입고
    fun getAvailableQty(): Int
    fun getReservedQty(): Int
}
```

### 3.2 Reservation (Entity)

```kotlin
class Reservation private constructor(
    val id: Long? = null,
    val orderId: Long,
    val productId: Long,
    val warehouseId: Long,
    val qty: Int,
    private var status: ReservationStatus,
    val expiredAt: LocalDateTime,
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    companion object {
        fun create(orderId: Long, productId: Long, warehouseId: Long, qty: Int, ttlMinutes: Long = 30): Reservation
    }

    fun confirm(): ReservationEvent.Confirmed
    fun cancel(): ReservationEvent.Cancelled
    fun expire(): ReservationEvent.Expired
    fun isExpired(): Boolean
    fun getStatus(): ReservationStatus
}

enum class ReservationStatus {
    ACTIVE, CONFIRMED, CANCELLED, EXPIRED
}
```

### 3.3 FulfillmentOrder (Aggregate Root)

```kotlin
class FulfillmentOrder private constructor(
    val id: Long? = null,
    val orderId: Long,
    val warehouseId: Long,
    private var status: FulfillmentStatus,
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    companion object {
        fun create(orderId: Long, warehouseId: Long): FulfillmentOrder
    }

    fun transition(to: FulfillmentStatus): FulfillmentEvent  // 유효하지 않은 전이 시 예외
    fun cancel(): FulfillmentEvent.Cancelled
    fun getStatus(): FulfillmentStatus
}

enum class FulfillmentStatus {
    PENDING, PICKING, PACKING, SHIPPED, DELIVERED, CANCELLED;

    fun canTransitionTo(next: FulfillmentStatus): Boolean = when (this) {
        PENDING -> next == PICKING || next == CANCELLED
        PICKING -> next == PACKING || next == CANCELLED
        PACKING -> next == SHIPPED || next == CANCELLED
        SHIPPED -> next == DELIVERED
        DELIVERED, CANCELLED -> false
    }
}
```

---

## 4. API 설계

### 4.1 Inventory API

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/inventories` | 재고 생성 (입고) |
| POST | `/api/inventories/receive` | 추가 입고 |
| POST | `/api/inventories/reserve` | 재고 예약 |
| POST | `/api/inventories/release` | 예약 해제 |
| POST | `/api/inventories/confirm` | 예약 확정 |
| GET | `/api/inventories/{productId}` | 재고 조회 |
| GET | `/api/inventories/{productId}/warehouses/{warehouseId}` | 창고별 재고 조회 |

### 4.2 Fulfillment API

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/fulfillments` | 풀필먼트 생성 |
| PATCH | `/api/fulfillments/{id}/transition` | 상태 전이 |
| PATCH | `/api/fulfillments/{id}/cancel` | 취소 |
| GET | `/api/fulfillments/{id}` | 풀필먼트 조회 |
| GET | `/api/fulfillments/orders/{orderId}` | 주문별 풀필먼트 조회 |

---

## 5. Kafka 이벤트 토픽

| 토픽 | 발행 서비스 | 수신 서비스 | 설명 |
|------|-----------|-----------|------|
| `inventory.stock.reserved` | inventory | fulfillment | 재고 예약 완료 → 풀필먼트 생성 |
| `inventory.stock.released` | inventory | - | 예약 해제 |
| `inventory.stock.confirmed` | inventory | - | 확정 차감 |
| `inventory.reservation.expired` | inventory | order | 예약 만료 → 주문 취소 |
| `fulfillment.order.created` | fulfillment | - | 풀필먼트 생성 |
| `fulfillment.order.shipped` | fulfillment | inventory | 출고 → 재고 확정 차감 |
| `fulfillment.order.delivered` | fulfillment | - | 배송 완료 |
| `fulfillment.order.cancelled` | fulfillment | inventory | 취소 → 예약 해제 |

기존 토픽과의 연동:
- `order.order.completed` → inventory가 소비 → 재고 예약

### 5.1 End-to-End 이벤트 흐름 (구현 완료)

```
Order 생성 → COMPLETED
  │
  ├─ order.order.completed (items 포함)
  │   └─ Inventory Consumer: 상품별 재고 예약 (warehouseId=1 기본)
  │       └─ inventory.stock.reserved (outbox)
  │           └─ Fulfillment Consumer: 풀필먼트 생성 (PENDING)
  │
  ├─ 풀필먼트 상태 전이 (PICKING → PACKING → SHIPPED)
  │   └─ fulfillment.order.shipped (outbox)
  │       └─ Inventory Consumer: 주문 전체 예약 확정 (confirmByOrder)
  │
  ├─ 풀필먼트 취소
  │   └─ fulfillment.order.cancelled (outbox)
  │       └─ Inventory Consumer: 주문 전체 예약 해제 (releaseByOrder)
  │
  └─ 예약 만료 (스케줄러, 30분 TTL)
      └─ inventory.reservation.expired (outbox)
          └─ Order Consumer: 주문 취소 → order.order.cancelled 발행
```

### 5.2 서비스별 Kafka Consumer/Producer 매핑

| 서비스 | Consumer (수신) | Producer (발행) |
|--------|----------------|----------------|
| order | `inventory.reservation.expired` | `order.order.completed`, `order.order.cancelled` |
| inventory | `order.order.completed`, `fulfillment.order.shipped`, `fulfillment.order.cancelled` | `inventory.stock.*`, `inventory.reservation.expired` (outbox) |
| fulfillment | `inventory.stock.reserved` | `fulfillment.order.*` (outbox) |

---

## 6. Outbox 패턴

### 6.1 Outbox 테이블 (서비스별 독립)

```sql
CREATE TABLE outbox_event (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id BIGINT NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSON NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING, PUBLISHED
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    published_at DATETIME(6) NULL,
    INDEX idx_outbox_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 6.2 Outbox Polling Publisher

- `@Scheduled(fixedDelay = 1000)` 로 PENDING 이벤트 조회
- Kafka 발행 성공 시 status → PUBLISHED
- 실패 시 retry (최대 3회 후 FAILED)

---

## 7. DB 스키마

### 7.1 inventory_db

```sql
CREATE TABLE inventory (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    warehouse_id BIGINT NOT NULL,
    available_qty INT NOT NULL DEFAULT 0,
    reserved_qty INT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE INDEX uk_product_warehouse (product_id, warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE reservation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    warehouse_id BIGINT NOT NULL,
    qty INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    expired_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_reservation_order (order_id),
    INDEX idx_reservation_status_expired (status, expired_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 7.2 fulfillment_db

```sql
CREATE TABLE fulfillment_order (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    warehouse_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    INDEX idx_fulfillment_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 8. 인프라 변경

### 8.1 docker-compose.infra.yml 추가

- `mysql-inventory-master` (port 3328)
- `mysql-inventory-replica` (port 3329)
- `mysql-fulfillment-master` (port 3330)
- `mysql-fulfillment-replica` (port 3331)

### 8.2 docker-compose.yml 추가

- `inventory` 서비스 (port 8085)
- `fulfillment` 서비스 (port 8088)

### 8.3 Gateway 라우팅 추가

- `/api/inventories/**` → inventory-service
- `/api/fulfillments/**` → fulfillment-service

---

## 9. 서비스 포트 할당

| 서비스 | 포트 |
|--------|------|
| discovery | 8761 |
| product | 8081 |
| order | 8082 |
| search | 8083 |
| **inventory** | **8085** |
| **fulfillment** | **8088** |

---

## 10. Phase 로드맵

Phase별 상세 범위, 우선순위, 의존 관계, 전환 기준은 [`roadmap.md`](./roadmap.md) 참조.

| Phase | 핵심 목표 | 상태 |
|-------|----------|------|
| **Phase 1** | MVP — e2e 이벤트 흐름 동작 | 완료 |
| **Phase 2** | 운영 안정성 + 멀티 창고 | 미착수 |
| **Phase 3** | 성능 최적화 (10만 TPS) | 미착수 |
| **Phase 4** | 고도화 (멀티 리전, 물류 최적화) | 미착수 |
