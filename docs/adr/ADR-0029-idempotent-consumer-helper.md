# ADR-0029 Idempotent Consumer Helper 표준화 (ADR-0012 보강)

## Status
Accepted (2026-05-02)

## Date
2026-05-02

> 본 ADR 은 ADR-0012 (Idempotent Consumer Pattern) 의 **보강(superseder 아님)** 이다. ADR-0012 의 §4 "공통 모듈 제공" 항목과 §3 "비즈니스 로직 + processed_event INSERT (같은 트랜잭션)" 시맨틱이 현재 코드(inventory/order/fulfillment)에서 미실현 상태로, 멱등 마킹이 비즈니스 트랜잭션과 분리되어 있다. 본 ADR 은 quant 의 검증된 헬퍼 패턴을 `common` 모듈로 추출하고, 4개 서비스 마이그레이션을 단계화한다.

## Context

### 1. ADR-0012 와의 관계 — 보강(refinement) 인 이유

ADR-0012 는 다음을 결정했다:
1. 모든 Kafka 이벤트 메시지에 `eventId: String (UUID)` 필드 부여
2. consumer 측 `processed_event` 테이블 (`event_id` PK, `topic`, `processed_at`)
3. **"비즈니스 로직 실행 + processed_event INSERT (같은 트랜잭션)"** — atomicity 시맨틱
4. **"common 모듈에 `IdempotentEventHandler` 유틸리티 제공"** — 공통화 결정

→ 1, 2 는 코드에 적용됐다. **3, 4 는 미실현**. 본 ADR 은 ADR-0012 의 결정 자체는 유지하면서 §3 의 atomicity 시맨틱을 강제하는 헬퍼와 `common` 모듈 위치를 표준화한다. ADR-0012 의 결정을 뒤집는 항목은 없으므로 **superseder 가 아니라 implementation refinement**.

> 단, processed_event 테이블 PK 가 `event_id` 단일에서 `(event_id, consumer_group)` 복합으로 변경되는 것은 ADR-0012 §2 의 스키마 결정에 대한 **부분 변경** 이다. 호환성과 마이그레이션 절차는 §Rollout 에서 명시한다.

### 2. 현재 코드의 문제 — 비즈니스 트랜잭션과 멱등 마킹의 분리

**inventory/order/fulfillment** 의 현재 패턴 (in-place, common 추출 안 됨):

```kotlin
// inventory/app/src/main/kotlin/com/kgd/inventory/infrastructure/messaging/InventoryEventConsumer.kt:32-62
@KafkaListener(
    topics = ["order.order.completed"],
    groupId = "inventory-service",
    containerFactory = "kafkaListenerContainerFactory",
)
fun onOrderCompleted(record: ConsumerRecord<String, String>) {
    val event = objectMapper.readValue(record.value(), OrderCompletedEvent::class.java)

    // [1] 멱등 체크 (외부)
    if (event.eventId.isNotBlank() && processedEventRepository.existsById(event.eventId)) {
        log.info("Duplicate event detected, skipping: eventId={}", event.eventId)
        return
    }

    // [2] 비즈니스 처리 (각 reserve 가 @Transactional → 별도 TX)
    for (item in event.items) {
        reserveStockUseCase.execute(
            ReserveStockUseCase.Command(
                orderId = event.orderId,
                productId = item.productId,
                warehouseId = 1L,
                qty = item.quantity
            )
        )
    }

    // [3] 마킹 (또 다른 TX)
    if (event.eventId.isNotBlank()) {
        processedEventRepository.save(ProcessedEventJpaEntity(event.eventId, "order.order.completed"))
    }
}
```

**race scenario**:

1. 컨슈머가 `eventId=E1` 수신 → `[1]` false (미존재).
2. `[2]` 의 `reserveStockUseCase.execute(...)` 가 자체 `@Transactional` 로 commit 됨 → 재고 1 차감 완료.
3. `[3]` 직전 노드 crash, OOM, 또는 `processedEventRepository.save` 자체가 unique constraint/Connection 예외로 실패.
4. Kafka 가 `AckMode.RECORD` 면 commit 되지 않은 offset 이 다음 컨슈머/리밸런스 후 재배달.
5. 재배달된 `E1` → `[1]` 또 false → `[2]` 재실행 → **재고 2 차감** (이중 reserve, 재고 손실).

같은 race 가 `onFulfillmentShipped` (`confirmStockByOrderUseCase`), `onFulfillmentCancelled` (`releaseStockByOrderUseCase`), 그리고 `order/app/src/main/kotlin/com/kgd/order/messaging/OrderEventConsumer.kt:28-49` 의 `onReservationExpired` 모두에 존재한다. fulfillment 의 `FulfillmentEventConsumer` 도 동일.

**부수 문제**:
- **boilerplate 반복** — 6개+ consumer 메서드에 동일 10줄 패턴 (existsById → biz → save).
- **`processed_event` 단일 PK 한계** — 동일 `eventId` 가 여러 consumer group 에서 처리될 때 충돌. 예: order 에서 발행한 event 를 inventory(`inventory-service` group) + 미래의 audit 서비스(`audit-service` group) 가 모두 consume 해야 한다면, 한쪽이 먼저 INSERT 하면 다른 쪽이 PK violation 으로 실패. 현재 msa 는 1 event = 1 consumer 라 표면화되지 않았지만 fan-out 확장 시 즉시 막힘.
- **`event.eventId.isBlank()` 조건분기** — eventId 누락 시 무방어로 실행. 옛 메시지/잘못된 publisher 호환성을 위해 남았으나 안전성과 충돌.

### 3. quant 의 검증된 패턴 — `IdempotentEventConsumer`

`quant/app/src/main/kotlin/com/kgd/quant/infrastructure/outbox/IdempotentEventConsumer.kt` 는 Phase 2 마일스톤(TG-P2-12.4)에서 도입된 헬퍼다:

```kotlin
@Component
class IdempotentEventConsumer(
    private val processedEventRepo: ProcessedEventJpaRepository,
    private val transactionTemplate: TransactionTemplate,
) {
    fun process(
        eventId: UUID,
        consumerGroup: String,
        block: () -> Unit,
    ): Boolean {
        val pk = ProcessedEventId(eventId = eventId, consumerGroup = consumerGroup)
        val already = processedEventRepo.existsById(pk)
        if (already) {
            log.debug { "idempotent skip eventId=$eventId consumerGroup=$consumerGroup" }
            return false
        }

        block()

        return try {
            transactionTemplate.execute {
                processedEventRepo.save(
                    ProcessedEventEntity(
                        eventId = eventId,
                        consumerGroup = consumerGroup,
                        processedAt = Instant.now(),
                    )
                )
            }
            true
        } catch (e: DataIntegrityViolationException) {
            // 다른 instance 가 동시에 마킹한 경우. 비즈니스 처리는 이미 수행되었으므로 정상으로 간주.
            log.debug {
                "idempotent marking concurrent insert eventId=$eventId consumerGroup=$consumerGroup " +
                    "reason=${e.message}"
            }
            true
        }
    }
}
```

대응 엔티티 (`quant/app/src/main/kotlin/com/kgd/quant/infrastructure/persistence/entity/ProcessedEventEntity.kt`):

```kotlin
@Entity
@Table(name = "processed_event")
@IdClass(ProcessedEventId::class)
class ProcessedEventEntity(
    @Id @Column(name = "event_id", columnDefinition = "BINARY(16)", nullable = false)
    var eventId: UUID = UUID.randomUUID(),

    @Id @Column(name = "consumer_group", nullable = false, length = 64)
    var consumerGroup: String = "",

    @Column(name = "processed_at", nullable = false)
    var processedAt: Instant = Instant.now(),
)
```

스키마 (`quant/app/src/main/resources/db/migration/V001__init.sql:110-115`):

```sql
CREATE TABLE processed_event (
    event_id BINARY(16) NOT NULL,
    consumer_group VARCHAR(64) NOT NULL,
    processed_at DATETIME(6) NOT NULL,
    PRIMARY KEY (event_id, consumer_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**우월한 설계 포인트**:
- `(eventId, consumerGroup)` 복합 PK — fan-out (1 event → N consumer group) 정상 처리.
- `BINARY(16)` UUID — VARCHAR(36) 대비 50% 저장공간, index 성능 향상.
- `DataIntegrityViolationException` 흡수 — 멀티 인스턴스에서 동시 INSERT 시 race 흡수 (한쪽은 false 가 아니라 true 반환, biz 는 이미 수행됨).
- 클래스 레벨 `@Transactional` 미선언, 마킹 INSERT 만 `TransactionTemplate` 단독 트랜잭션 — 호출자(컨슈머)의 비즈니스 트랜잭션 경계와 충돌하지 않음 (ADR-0020 외부 IO 분리 원칙 준수).

### 4. 학습 자료의 일관된 결론

세 가지 학습 노트가 동일하게 본 패턴 표준화를 권고:

- `study/docs/6-kafka-internals/13-improvements.md` (개선 #4): "inventory IdempotentEventConsumer 헬퍼 도입 (atomic INSERT)" — 우선순위 **높음**, ADR 필요(ADR-0012 보강).
- `study/docs/7-distributed-systems/17-codebase-idempotent-ssot.md` §12.1: "IdempotentEventHandler 공통 모듈 — 6개 consumer 메서드의 ~10줄 boilerplate 제거".
- `study/docs/5-spring-transactional/12-msa-outbox-saga.md` §3 약점표: "콜백 안 dirty save → 트랜잭션 외부 변경 → race condition 가능".

→ 6번 (Kafka), 7번 (분산시스템), 5번 (Spring Tx) 3개 주제에서 동일 결론 — 통합 결정 가치 충분.

## Decision

### 1. 공통 헬퍼 위치 및 시그니처

`common` 모듈에 messaging 패키지를 신설하고 헬퍼와 Port 를 둔다.

```
common/src/main/kotlin/com/kgd/common/messaging/
  IdempotentEventHandler.kt          # @Component 헬퍼
  ProcessedEventRepositoryPort.kt    # interface (Port)
  ProcessedEventRecord.kt            # data class (DTO, JPA 의존성 0)
```

`IdempotentEventHandler` 시그니처:

```kotlin
package com.kgd.common.messaging

@Component
class IdempotentEventHandler(
    private val processedEventRepo: ProcessedEventRepositoryPort,
    private val transactionTemplate: TransactionTemplate,
) {
    /**
     * @param eventId       도메인 이벤트 UUID (Kafka record key 또는 payload field).
     * @param consumerGroup Kafka consumer group (예: "inventory-service").
     * @param block         비즈니스 처리 블록. 미처리 시에만 실행.
     * @return true = 신규 처리 (또는 동시 INSERT race 흡수), false = 이미 처리됨 (skip).
     */
    fun process(
        eventId: UUID,
        consumerGroup: String,
        block: () -> Unit,
    ): Boolean
}
```

Port:

```kotlin
package com.kgd.common.messaging

interface ProcessedEventRepositoryPort {
    fun existsBy(eventId: UUID, consumerGroup: String): Boolean
    fun mark(record: ProcessedEventRecord)
}

data class ProcessedEventRecord(
    val eventId: UUID,
    val consumerGroup: String,
    val processedAt: Instant = Instant.now(),
)
```

각 서비스(`infrastructure/persistence/idempotency/`)는 자신의 Adapter 와 JPA Entity 만 보유.

### 2. processed_event 테이블 표준 스키마

기존 ADR-0012 §2 스키마를 다음과 같이 갱신한다 (본 ADR 채택 시 효력 발생):

```sql
CREATE TABLE processed_event (
    event_id        BINARY(16)  NOT NULL,
    consumer_group  VARCHAR(64) NOT NULL,
    processed_at    DATETIME(6) NOT NULL,
    PRIMARY KEY (event_id, consumer_group),
    KEY idx_processed_at (processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

변경점:
- `event_id`: `VARCHAR(36)` → `BINARY(16)` (UUID 정규 16바이트 표현, 인덱스/저장 효율).
- PK: `event_id` 단일 → `(event_id, consumer_group)` 복합. fan-out 안전.
- `topic` 컬럼 제거 — `consumer_group` 이 사실상 동일한 식별성을 제공 (한 consumer group 은 fixed topic set 을 처리). 운영 디버깅용 토픽 기록은 별도 audit/observability 채널(MDC + log) 로 위임.
- `idx_processed_at` 유지 — 7일 TTL cleanup 배치 유지 (ADR-0012 §2 보관 정책 준수).

### 3. 비즈니스 트랜잭션과 마킹의 결합 규칙

`block` 과 `mark` 를 한 트랜잭션으로 묶을지 분리할지는 두 가지 정책이 가능하다. 본 ADR 은 **quant 패턴(분리)** 을 표준으로 채택한다.

**채택 — Policy A (분리, quant 패턴)**

```
[1] existsBy(eventId, consumerGroup)  → false
[2] block()                            → 비즈니스 TX (호출자가 @Transactional 로 결정)
[3] transactionTemplate.execute {      → 마킹 단독 TX
        repo.mark(record)
    }
```

- 비즈니스 처리(`block`)는 호출자의 트랜잭션 경계에 따른다 (단일 `@Transactional`, 또는 여러 `@Transactional` 메서드 호출 모두 허용).
- 마킹은 `TransactionTemplate` 으로 **명시 단독 TX** 를 연다.
- 이유: ADR-0020 (`@Transactional` 사용 규칙) — 외부 IO(`block` 안에 WebClient/Kafka publish 등 가능)는 트랜잭션 밖으로 빼는 것이 표준. 비즈니스 로직 + 마킹을 한 TX 로 강제하면 외부 IO 가 들어왔을 때 commit 지연/connection 점유 문제가 재발한다.

**race 분석 (Policy A)**:
- `[2]` 성공 + `[3]` 실패 시: 재배달 → `[1]` false → `[2]` 재실행. 이전과 동일한 race 가 남는 것처럼 보이나, **block 자체가 자연 멱등** 이거나 **DB UNIQUE/Optimistic Lock 으로 보호** 되어야 한다는 책임을 호출자에게 명시 (학습 자료 7번 §3.4 자연 멱등 / §17 §7 Optimistic Lock 참조).
- `[3]` 의 `DataIntegrityViolationException` 흡수 — 멀티 인스턴스 동시 INSERT 시 race 를 silent skip.

**기각 — Policy B (한 TX 결합)**

```kotlin
@Transactional
fun process(...) {
    if (repo.existsBy(...)) return false
    block()
    repo.mark(...)
}
```

- 한 TX 안에 모든 것이 들어가므로 `[2]` 성공 + `[3]` 실패 시 함께 롤백 → 재배달 시 `[2]` 재실행이 깨끗.
- 단, `block` 안에 외부 IO 가 들어오면 ADR-0020 위반 (락 점유/connection 점유 시간 ↑).
- consumer 메서드에 `@Transactional` 을 붙이거나 헬퍼에 클래스 레벨 `@Transactional` 을 두는 두 가지 변형 모두 동일 위험.

→ 외부 IO 가 미래에 들어올 가능성이 높은 도메인(Saga, 알림 fan-out 등)을 고려해 **Policy A 를 채택**. 호출자 책임으로 자연 멱등을 보강하는 비용은 받아들인다.

### 4. eventId 누락 정책 — graceful degrade

현재 코드의 `event.eventId.isBlank()` 분기는 **publisher 측이 누락한 옛 메시지** 를 위한 호환성 코드다. 본 ADR 은:

- 신규 헬퍼 시그니처는 `eventId: UUID` (non-null) — null 자체를 받지 않음.
- 호출자(컨슈머)가 payload 에서 `eventId` 추출 시 누락이면 **WARN 로그 + dedup 없이 block 수행** (graceful degrade). 강제 reject 시 재배달 폭주 위험.
- 누락률을 메트릭으로 노출 — `kgd_idempotent_event_missing_id_total{consumer_group}` Counter. 1주 관찰 후 0 이면 호환성 코드 제거 PR 제출.

### 5. 적용 범위 — 4 + 1 서비스

| 서비스 | Consumer | 현재 | 마이그레이션 후 |
|---|---|---|---|
| inventory | `InventoryEventConsumer` (3 핸들러: onOrderCompleted, onFulfillmentShipped, onFulfillmentCancelled) | in-place 패턴 | `idempotentHandler.process(...)` |
| order | `OrderEventConsumer.onReservationExpired` | in-place 패턴 | `idempotentHandler.process(...)` |
| fulfillment | `FulfillmentEventConsumer` | in-place 패턴 | `idempotentHandler.process(...)` |
| quant | `IdempotentEventConsumer` (Phase 2 import-only) | 자체 헬퍼 | `common` 헬퍼로 교체 + 자체 헬퍼 deprecate |
| search | `ProductIndexingConsumer` | ES doc id 자연 멱등 | (적용 제외, ADR-0012 §5 정책 유지) |
| analytics | Streams + ingestion | windowedKey 자연 멱등 / KStream | (적용 제외) |

→ 4개 (inventory/order/fulfillment + quant 교체).

### 6. consumer 호출부 표준 형태

`block` 안의 비즈니스 처리는 호출자가 `@Transactional` 경계를 결정한다 (Policy A 그대로).

```kotlin
@Component
class InventoryEventConsumer(
    private val reserveStockUseCase: ReserveStockUseCase,
    private val confirmStockByOrderUseCase: ConfirmStockByOrderUseCase,
    private val releaseStockByOrderUseCase: ReleaseStockByOrderUseCase,
    private val objectMapper: ObjectMapper,
    private val idempotentHandler: IdempotentEventHandler,   // common 의존
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @KafkaListener(topics = ["order.order.completed"], groupId = "inventory-service", ...)
    fun onOrderCompleted(record: ConsumerRecord<String, String>) {
        val event = objectMapper.readValue(record.value(), OrderCompletedEvent::class.java)
        val eventId = parseEventId(event.eventId) ?: return logMissingId("order.order.completed")

        idempotentHandler.process(eventId, "inventory-service") {
            for (item in event.items) {
                reserveStockUseCase.execute(
                    ReserveStockUseCase.Command(
                        orderId = event.orderId,
                        productId = item.productId,
                        warehouseId = 1L,
                        qty = item.quantity,
                    )
                )
            }
        }
    }
}
```

### 7. Auto-Configuration

`common` 의 기존 Auto-Configuration 컨벤션(CLAUDE.md `kgd.common.*`) 에 따라:

- `kgd.common.messaging.idempotent.enabled` (default: `true`).
- 서비스가 `processed_event` 테이블을 갖지 않으면 (예: search, analytics) 자동 비활성.
- `ProcessedEventRepositoryPort` Bean 이 등록되지 않은 경우 `IdempotentEventHandler` 도 등록 안 됨 (`@ConditionalOnBean(ProcessedEventRepositoryPort::class)`).

## Alternatives Considered

### Alt 1. 현 구조 유지 (in-place, common 추출 없음)

- **장점**: 변경 비용 0, 기존 코드 그대로.
- **단점**:
  - ADR-0012 §3, §4 가 명시적으로 미실현 — ADR 과 코드 불일치.
  - boilerplate 6+ 메서드, 변경 시 6+ 곳 동기 수정.
  - race scenario 가 그대로 노출 — 운영 사고 시 책임 소재 모호.
  - fan-out 확장 시 PK 충돌로 막힘.
- **기각** — ADR-0012 가 이미 결정한 표준의 미완성 상태를 방치하는 비용이 더 큼.

### Alt 2. DB UNIQUE constraint 만 (processed_event 테이블 폐기)

비즈니스 도메인 키 자체에 UNIQUE 제약을 걸어 자연 멱등을 강제하는 방안.

- 예: `reservation` 테이블에 `UNIQUE KEY uk_order_product (order_id, product_id)` (학습 자료 7번 §3.4 인용).
- INSERT 시도 → `DataIntegrityViolationException` 흡수 → silent skip.
- **장점**: 별도 테이블 불필요, 가장 단순.
- **단점**:
  - 모든 핸들러가 UNIQUE 가능한 자연키를 가져야 함 — `onFulfillmentShipped` (`confirmStockByOrderUseCase`) 처럼 **상태 전이** 핸들러는 자연 멱등이 어렵다 (이미 confirmed 인 reservation 을 또 confirm → 어떻게 자연 멱등?).
  - publisher 가 retry 로 다른 비즈니스 키로 같은 의미를 발행하는 경우 (드물지만 가능) 흡수 못함.
- **기각 / 부분 채택** — eventId 기반 dedup 을 표준으로 유지하되, **자연 멱등 가능한 도메인은 보강 레이어로 같이 사용** 권장 (학습 자료 7번 §17 §11 진단 참조 — 이미 fulfillment 가 `findByOrderIdAndWarehouseId` 로 보강).

### Alt 3. Redis SETNX 기반 dedup

`SET NX EX 86400` 으로 24시간 TTL 마커.

- **장점**: ms 단위 빠름, TTL 자동 정리.
- **단점**:
  - Redis 장애 시 멱등성 보장 불가 — 재처리/중복 위험.
  - DB 트랜잭션과 분리되어 있어 atomic 결합 불가능 (Policy A 의 마킹 TX 와 동일한 race 를 Redis 이중장애로 옮기는 셈).
  - msa 의 Redis 는 standalone (k3s-lite) — HA 약함.
- ADR-0012 §"Alternatives Considered" 2 에서 이미 동일 사유로 기각됨. 본 ADR 도 일관 유지.
- **기각**.

### Alt 4. Kafka Exactly-Once (Transactional Consumer/Producer)

EOS v2 + read_committed 로 broker 차원에서 정확히 한 번 보장.

- **장점**: 코드 패턴 단순화, broker 가 보장.
- **단점**:
  - DB tx 와 Kafka tx 가 분리 — DB 변경의 atomicity 는 별개 문제.
  - 외부 IO (HTTP) 와의 결합 불가능.
  - throughput 10-30% 감소.
  - 본 결정의 범위인 일반 consumer 가 아니라 Kafka Streams 전용 (analytics 의 EOS 도입은 별도 ADR 후보로 남김).
- ADR-0012 §"Alternatives Considered" 1 에서 이미 동일 사유로 기각됨.
- **기각**.

### Alt 5. `@KafkaListener` 메서드에 `@Transactional` 직접 적용 (Policy B)

- **장점**: 헬퍼 없이 한 TX 보장.
- **단점**: §3 Policy B 분석 참조. 외부 IO 진입 시 ADR-0020 위반.
- **기각**.

## Consequences

### 긍정적

- **ADR-0012 의 시맨틱 실현** — §3 atomicity (단독 TX 마킹 + 동시 INSERT race 흡수), §4 common 모듈 위치 표준화.
- **boilerplate 제거** — 4개 서비스 6+ 메서드의 동일 10줄 패턴 → `idempotentHandler.process(eventId, group, block)` 한 줄.
- **fan-out 대비** — `(event_id, consumer_group)` 복합 PK 로 미래의 1 event → N consumer group 패턴(예: audit/notification fan-out) 즉시 가능.
- **저장 효율** — `BINARY(16)` 으로 약 50% 절감 + B-tree depth 감소.
- **race 흡수** — 멀티 인스턴스 동시 INSERT 시 `DataIntegrityViolationException` 을 silent skip 으로 흡수 (현재 코드는 예외 전파 → consumer 재시도 → 재처리 폭주 가능성).
- **메트릭 노출** — `kgd_idempotent_*` Counter 로 운영 가시성 (skip 비율, 누락률, 동시 race 빈도).

### 부정적 / 주의

- **Flyway migration 부담** — 기존 4개 서비스의 `processed_event` 테이블 PK 변경. MySQL 의 PRIMARY KEY 변경은 INSTANT 알고리즘 미지원 → INPLACE 또는 COPY → 수십 GB 테이블이면 운영 영향. 현 시점 데이터는 작으므로 문제 없음.
- **기존 데이터 backfill** — 기존 row 의 `consumer_group` 은 NULL 또는 unknown. 마이그레이션 전략은 §Rollout 참조.
- **eventId 타입 변경** — `String` → `UUID`. 호출부 파싱 로직 추가 필요 (현재 `event.eventId.isBlank()` 체크가 사라지고 `UUID.fromString()` 또는 null safety 처리로 전환).
- **Policy A 의 책임 전가** — `block` 자체의 자연 멱등은 호출자 책임. 책임을 명시 안 한 도메인에서 사고 시 책임 소재 분쟁 가능 → docs/conventions/idempotent-consumer.md 신설로 보완.
- **헬퍼 의존성 추가** — 4개 서비스가 `common.messaging.IdempotentEventHandler` 에 의존 → common 모듈 변경 시 동시 영향. (이미 common 의 ApiResponse, BusinessException 등에 의존하고 있어 추가 부담은 미미.)

### 후속 ADR / Convention 후보

- `docs/conventions/idempotent-consumer.md` 신설 — 호출자 책임, 자연 멱등 패턴, eventId 누락 정책, 메트릭 등 실천 가이드.
- `processed_event` cleanup 배치 표준 — ADR-0012 §"Consequences" 의 7일 보관을 스케줄러로 강제 (현재 미구현 추정 — 본 ADR Phase 3 에서 같이 제공).
- analytics Kafka Streams 의 `processing.guarantee=exactly_once_v2` 도입 — 별도 ADR (학습 자료 6번 #9).
- `compression.type=lz4`, `CooperativeStickyAssignor`, `group.instance.id` — ADR 불필요 (운영 튜닝).

## Rollout

각 서비스는 4 phase 단계로 마이그레이션. 한 번에 한 서비스씩 (병렬 PR 금지).

### Phase 0 — common 헬퍼 + Port 출시 (ADR 채택 후 즉시)

- `common/src/main/kotlin/com/kgd/common/messaging/` 패키지 신설:
  - `IdempotentEventHandler.kt`
  - `ProcessedEventRepositoryPort.kt`
  - `ProcessedEventRecord.kt`
- `common` Auto-Configuration: `IdempotentEventHandlerAutoConfiguration` (`@ConditionalOnBean(ProcessedEventRepositoryPort::class)`).
- `common` 단위 테스트 (Kotest BehaviorSpec):
  - `process` 가 `existsBy=true` 시 false 반환.
  - `block` 실행 후 `mark` 호출.
  - `mark` 가 `DataIntegrityViolationException` 던질 때 true 반환 (race 흡수).
  - `mark` 가 다른 예외 던질 때 예외 전파.
- 미사용 (서비스 적용 0개) — 빌드만 통과.

**Exit criteria**: `./gradlew :common:test` 통과.

### Phase 1 — quant 교체 (자체 헬퍼 → common 헬퍼)

- quant 의 `ProcessedEventRepositoryPort` Adapter 작성 (`quant/app/.../infrastructure/persistence/repository/CommonProcessedEventAdapter.kt`).
- `IdempotentEventConsumer` 자체 클래스에 `@Deprecated("Use common IdempotentEventHandler", ReplaceWith(...))` 추가 — 호출부 없으면 다음 PR 에서 삭제.
- Phase 3 외부 통합 시 도입할 컨슈머가 처음부터 common 헬퍼 사용.
- 기존 스키마는 이미 `(event_id, consumer_group)` 복합 PK + `BINARY(16)` → 변경 없음.

**Exit criteria**: quant 빌드 + 테스트 통과, 기존 동작 무회귀.

### Phase 2 — inventory/order/fulfillment 스키마 마이그레이션

각 서비스에 Flyway migration 추가 (예시: inventory):

```
inventory/app/src/main/resources/db/migration/V_n__processed_event_composite_key.sql
```

```sql
-- 1) 기존 데이터 백업
CREATE TABLE processed_event_backup_v0 AS SELECT * FROM processed_event;

-- 2) 신규 테이블
CREATE TABLE processed_event_v1 (
    event_id        BINARY(16)  NOT NULL,
    consumer_group  VARCHAR(64) NOT NULL,
    processed_at    DATETIME(6) NOT NULL,
    PRIMARY KEY (event_id, consumer_group),
    KEY idx_processed_at (processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) 데이터 이전 — consumer_group 은 서비스명으로 backfill
INSERT INTO processed_event_v1 (event_id, consumer_group, processed_at)
SELECT
    UNHEX(REPLACE(event_id, '-', '')),
    'inventory-service',                 -- 서비스별 변경
    processed_at
FROM processed_event;

-- 4) 원자적 swap
RENAME TABLE processed_event TO processed_event_v0,
             processed_event_v1 TO processed_event;

-- 5) 7일 후 별도 cleanup PR 에서 DROP
-- DROP TABLE processed_event_v0;
-- DROP TABLE processed_event_backup_v0;
```

- 각 서비스 deploy 전에 마이그레이션 적용 검증 (staging/k3s-lite).
- `ProcessedEventJpaEntity` 를 `(event_id, consumer_group)` 복합 PK + `BINARY(16)` 로 갱신.
- `ProcessedEventRepositoryPort` Adapter 등록.

**Exit criteria**: 각 서비스 빌드/테스트 통과, staging 에서 마이그레이션 dry-run 성공, 기존 ID 가 정상 dedup 으로 동작.

### Phase 3 — consumer 호출부 헬퍼 전환

각 서비스의 `*EventConsumer.kt` 를 헬퍼 호출 형태로 리팩터링.

- inventory: 3개 핸들러 (`onOrderCompleted`, `onFulfillmentShipped`, `onFulfillmentCancelled`).
- order: 1개 핸들러 (`onReservationExpired`).
- fulfillment: 1개 핸들러 (확인 필요).
- 각 PR 별로 단위 테스트(Kotest BehaviorSpec, MockK) + 통합 테스트(Testcontainers) 갱신.

추가로:
- `kgd_idempotent_processed_total{consumer_group, result}` (result ∈ {processed, skipped, race}) Counter Bean 등록.
- `kgd_idempotent_event_missing_id_total{consumer_group}` Counter.

**Exit criteria**: 모든 서비스 빌드/테스트 통과, k3s-lite 에서 e2e 시나리오 (중복 발행 → 단일 처리) 검증, 운영 메트릭 노출 확인.

### Phase 4 — eventId 누락 호환성 코드 제거 + cleanup

- 1주 운영 관찰 후 `kgd_idempotent_event_missing_id_total` 이 0 이면 graceful degrade 분기 제거.
- Phase 2 의 `processed_event_v0` / `processed_event_backup_v0` DROP.
- ADR-0012 본문에 "본 결정의 §3, §4 는 ADR-0029 로 보강 표준화됨" cross-ref 코멘트 추가 (별도 ADR-0012 수정 PR — 본 ADR 작성 시 ADR-0012 는 변경 금지 제약).

**Exit criteria**: 호환성 코드 제거 PR merge, 백업 테이블 DROP, ADR-0012 cross-ref 추가.

### 일정 (가이드)

- Phase 0: 0.5 week (common 헬퍼 + 테스트).
- Phase 1: 0.5 week (quant 교체).
- Phase 2: 1 week (3개 서비스 스키마 마이그레이션 + staging 검증).
- Phase 3: 1 week (3개 서비스 호출부 전환 + 메트릭).
- Phase 4: 1 week (관찰 + cleanup).

총 약 4 weeks (학습 자료 6번 #4 의 "M (1주)" 추정은 Phase 0+1+3 만 고려한 것이며, 마이그레이션과 관찰을 포함하면 4w 가 현실).

## Cross-references

### 보강 대상

- **ADR-0012** (Idempotent Consumer Pattern) — 본 ADR 은 ADR-0012 의 §3 atomicity, §4 common 모듈 위치, §2 schema (PK + 컬럼) 를 표준화/보강한다. **superseder 가 아니라 implementation refinement**. 단 `processed_event` 테이블 PK 변경은 ADR-0012 §2 의 부분 변경.

### 관련 ADR

- **ADR-0015** (Resilience Strategy) — DLQ + FixedBackOff 정책. 본 ADR 의 헬퍼는 DLQ 발생 전 단계의 dedup 으로 ADR-0015 와 직교(orthogonal).
- **ADR-0019** (K8s migration) — 멀티 인스턴스 컨슈머 환경에서 동시 INSERT race 가 표면화. 본 ADR 의 `DataIntegrityViolationException` 흡수가 K8s rolling restart/scale-out 안정성에 기여.
- **ADR-0020** (`@Transactional` Usage Convention) — Policy A 채택의 근거. 외부 IO 분리 원칙 준수.
- **ADR-0024** (Quant Service) — quant 의 `IdempotentEventConsumer` 가 본 ADR 의 모범 사례. Phase 1 에서 common 으로 교체.

### 학습 노트 (study/)

- `study/docs/00-ADR-CANDIDATES.md` (ADR-0033 항목, 본 ADR 의 통합 출처): 6번/7번/5번 3개 주제에서 동일 패턴 제안.
- `study/docs/6-kafka-internals/11-msa-codebase-grep.md` §5: 실 코드 grep 결과 (inventory/order/quant 패턴 비교).
- `study/docs/6-kafka-internals/13-improvements.md` §4 (개선 #4): "atomic INSERT" 우선순위 **높음**, ADR 필요.
- `study/docs/7-distributed-systems/09-idempotency.md` §3.3, §10: 멱등 consumer 4가지 패턴, msa 진단표.
- `study/docs/7-distributed-systems/17-codebase-idempotent-ssot.md` §4-5, §12.1: 현재 코드 race 분석 + 헬퍼 추출 후보.
- `study/docs/5-spring-transactional/12-msa-outbox-saga.md` §3 약점표: "콜백 안 dirty save".

### 컨벤션 (제안)

- `docs/conventions/idempotent-consumer.md` (신설 후보) — 호출자 책임, 자연 멱등 패턴, eventId 누락 정책, 메트릭 표준.
- `docs/architecture/kafka-convention.md` — `consumer_group` 명명 (`{service}-{purpose}`) 이미 표준화. 본 ADR 의 PK 컬럼명과 일치.

---

## Verification Follow-up (2026-05-02)

`study/docs/00-VERIFICATION-REPORT.md` 의 검증 라운드에서 본 ADR 의 Phase 작업에 흡수해야 할 추가 갭이 발견됐다:

### 추가 갭 #1 — `processed_event` cleanup 스케줄러 미존재
- 발견: `@Scheduled` zero hit. ADR-0012 명세 (7일 보관) 의 cleanup 이 어디에도 구현되지 않음.
- 영향: `processed_event` 테이블 무한 증가 → 인덱스/PK 비대 → 컨슈머 latency 증가.
- 처리: 본 ADR Phase 2 (스키마 마이그레이션) 작업에 **`processed_event` retention 스케줄러** (`@Scheduled` + 7일 이상 row 삭제) 를 함께 도입한다. common 모듈의 `IdempotentEventCleanupScheduler` 로 표준화.

### 추가 갭 #2 — `InventoryStockSyncConsumer.kt` 멱등 체크 누락
- 발견: 학습 노트에서 `InventoryEventConsumer.kt` 로 인용된 파일의 실제 이름은 `InventoryStockSyncConsumer.kt`. 추가로 이 컨슈머는 `processedEventRepository` 호출이 **아예 없음** — 멱등 체크 미적용.
- 영향: ADR-0012 의 모든 컨슈머 멱등 보장 결정이 이 경로에서 빠짐.
- 처리: 본 ADR Phase 3 (호출부 전환) 의 마이그레이션 대상 목록에 `InventoryStockSyncConsumer` 명시 추가. 우선순위는 다른 4개 컨슈머와 동일.

### 추가 갭 #3 — `addNotRetryableExceptions` 미적용 (관련 발견)
- 발견: `addNotRetryableExceptions` 호출이 msa 전체에서 zero hit. `BusinessException` 도 1초 × 3회 재시도 후 DLT 로 직행.
- 영향: 본 ADR 의 헬퍼는 dedup 단계만 다루므로 직접 충돌은 없으나, 재시도 후 DLT 발생 시 본 ADR 의 `processed_event` INSERT 가 race 와 결합해 ghost row 가 남을 수 있음.
- 처리: 본 ADR 의 직접 결정 범위는 아님. **별도 follow-up** — ADR-0015 (Resilience Strategy) 의 ErrorHandler 보강 ticket 으로 분리. 본 ADR 의 §Cross-references 에 의존성 주석.

> 위 3건은 본 ADR 의 결정을 변경하지 않으며, Phase 작업의 범위 확장으로만 반영한다.
