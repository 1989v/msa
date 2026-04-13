# 2. Distributed Systems Patterns

> 운영 환경에서 발생하는 분산 시스템 장애를 5가지 패턴으로 방어

---

## Circuit Breaker (Resilience4j)

외부 서비스 호출 실패 시 빠른 실패(fast-fail)로 cascading failure 방지.

**설정**:
- Sliding window: COUNT_BASED (10 calls)
- Failure threshold: 50%
- OPEN → HALF_OPEN: 30초
- HALF_OPEN test calls: 3회

**코드 위치**:
- `order/app/src/.../infrastructure/client/` — 결제/상품 서비스 호출
- 설정: `order/app/src/main/resources/application.yml`

```kotlin
// Kotlin Coroutines + Resilience4j 조합
circuitBreakerRegistry
    .circuitBreaker("payment-service")
    .executeSuspendFunction {
        paymentClient.processPayment(command)
    }
```

**적용 대상**: order → payment (외부), order → product (내부)

**근거**: `docs/adr/ADR-0015-resilience-strategy.md`

---

## Saga Choreography (이벤트 기반)

주문→재고→풀필먼트 간 트랜잭션을 중앙 오케스트레이터 없이 이벤트로 조율.

```
Order                Inventory              Fulfillment
  │                      │                       │
  ├─order.completed──→   │                       │
  │                      ├─stock.reserved────→   │
  │                      │                       ├─order.created
  │                      │                       ├─order.shipped
  │                      │                       ├─order.delivered
  │                      │   ←─stock.confirmed───┤
  │                      │                       │
  │  (실패 시)            │                       │
  ├─order.cancelled──→   │                       │
  │                      ├─stock.released────→   │
  │                      │                       ├─order.cancelled
```

**코드 위치**:
- Producer: `order/app/src/.../infrastructure/messaging/`
- Consumer: `inventory/app/src/.../infrastructure/messaging/`
- Consumer: `fulfillment/app/src/.../infrastructure/messaging/`

**보상 트랜잭션**: 주문 취소 시 `order.cancelled` → 재고 복원(`stock.released`) → 풀필먼트 취소

---

## Outbox Pattern (Transactional Messaging)

DB 트랜잭션과 Kafka 메시지 발행의 원자성을 보장.

### Phase 1: Polling Publisher

```kotlin
// 1. 비즈니스 로직 + 아웃박스 저장 (같은 TX)
@Transactional
fun reserveStock(command: ReserveCommand) {
    val inventory = inventoryRepository.findAndLock(command.productId)
    inventory.reserve(command.quantity)
    
    outboxRepository.save(OutboxEvent(
        aggregateType = "inventory",
        aggregateId = inventory.id,
        eventType = "stock.reserved",
        payload = serialize(inventory)
    ))
}

// 2. Scheduler가 아웃박스 폴링 → Kafka 발행 → 처리 완료 마킹
@Scheduled(fixedDelay = 1000)
fun publishOutboxEvents() { ... }
```

### Phase 2: Debezium CDC

MySQL binlog → Debezium → Kafka (아웃박스 테이블 변경을 실시간 캡처)

**코드 위치**:
- Outbox 엔티티: `inventory/app/src/.../infrastructure/persistence/outbox/`
- Publisher: `inventory/app/src/.../infrastructure/messaging/`
- CDC 설정: `docs/architecture/cdc-pipeline.md`

**근거**: `docs/adr/ADR-0011-inventory-fulfillment.md`

---

## Idempotent Consumer

Kafka 메시지 중복 수신 시 비즈니스 로직 재실행을 방지.

```kotlin
@Transactional
fun handleEvent(eventId: String, payload: StockReservedEvent) {
    // 1. Dedup 체크
    if (processedEventRepository.existsByEventId(eventId)) {
        log.info { "Duplicate event ignored: $eventId" }
        return
    }
    
    // 2. 비즈니스 로직 실행
    fulfillmentService.createOrder(payload)
    
    // 3. 처리 완료 기록 (같은 TX)
    processedEventRepository.save(ProcessedEvent(eventId = eventId))
}
```

**구현 요소**:
- `processed_event` 테이블: eventId(UUID) + processedAt
- 같은 트랜잭션 내 dedup check + biz logic + INSERT
- 7일 보관 후 Cleanup Scheduler 삭제

**적용 범위**: 모든 Kafka Consumer (inventory, fulfillment, order, search)

**근거**: `docs/adr/ADR-0012-idempotent-consumer.md`

---

## Dead Letter Queue (DLQ)

3회 재시도 실패 시 DLT 토픽으로 격리하여 메인 파이프라인 블로킹 방지.

```
order.order.completed
    ↓ (consume)
    ├─ 성공 → 정상 처리
    └─ 3회 실패 → order.order.completed.DLT
                        ↓
                   알림/수동 재처리
```

**설정**:
- `DefaultErrorHandler` + `DeadLetterPublishingRecoverer`
- 1초 고정 backoff, 최대 3회 재시도
- AckMode: RECORD (메시지 단위 커밋)
- Phase 2: DLQ 소비자 알림 + 수동 재처리 API

**코드 위치**: 각 서비스의 Kafka Consumer 설정

---

## CQRS (Command Query Responsibility Segregation)

재고 서비스에서 읽기 모델을 Redis로 분리하여 조회 성능 최적화.

```
Write Path (MySQL)                    Read Path (Redis)
┌──────────────┐                     ┌──────────────┐
│ inventory DB │──event──→           │ Redis Cache  │
│ (Optimistic  │         │           │ inventory:   │
│   Lock)      │         └──write──→ │ read:{id}    │
└──────────────┘                     └──────┬───────┘
                                            │
                                     ← 조회 API ←
```

- Write: MySQL + `@Version` (Optimistic Lock)
- Read: Redis `inventory:read:{productId}` (TTL 없음, 이벤트 기반 갱신)
- 주기적 reconciliation batch로 정합성 보정

**코드 위치**: `inventory/app/src/.../infrastructure/`

**근거**: `docs/adr/ADR-0015-resilience-strategy.md`

---

## Rate Limiting (Token Bucket)

Gateway에서 Redis 기반 토큰 버킷으로 API 호출량 제어.

| 모드 | replenish/sec | burst |
|------|-------------|-------|
| 일반 | 100 | 200 |
| Flash Sale | 500 | 1,000 |

**추가 방어**: Admission Control — `processing_reservations > available_qty * 1.2` 시 거부

**코드 위치**:
- `gateway/src/.../config/RateLimiterConfig.kt`
- `gateway/src/.../filter/`

---

## Timeout & Retry 전략

| 방식 | Connect | Read | Retry |
|------|---------|------|-------|
| WebClient (동기) | 3s | 5s | CircuitBreaker 위임 |
| Kafka Producer | - | - | 120s delivery timeout |
| Kafka Consumer | - | - | DLQ (3회, 1s 간격) |

---

*Code references: `docs/adr/ADR-0003` · `ADR-0011` · `ADR-0012` · `ADR-0015` · 각 서비스의 `infrastructure/messaging/`*
