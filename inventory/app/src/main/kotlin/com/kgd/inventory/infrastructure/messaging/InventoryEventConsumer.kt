package com.kgd.inventory.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.inventory.application.inventory.usecase.ConfirmStockByOrderUseCase
import com.kgd.inventory.application.inventory.usecase.ReleaseStockByOrderUseCase
import com.kgd.inventory.application.inventory.usecase.ReserveStockUseCase
import com.kgd.inventory.infrastructure.messaging.event.FulfillmentCancelledEvent
import com.kgd.inventory.infrastructure.messaging.event.FulfillmentShippedEvent
import com.kgd.inventory.infrastructure.messaging.event.OrderCancelledEvent
import com.kgd.inventory.infrastructure.messaging.event.OrderCompletedEvent
import com.kgd.inventory.infrastructure.metrics.InventoryMetrics
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.util.UUID

/**
 * ADR-0029 PR-8 / PR-8a (Phase 3) — inventory 컨슈머의 멱등 처리는 모두 common
 * [IdempotentEventHandler] 로 위임된다.
 *
 * ## 적용 범위 (전 핸들러 helper 이관 완료)
 * - [onOrderCompleted] — PR-8a 에서 [ReserveStockUseCase] 자연 멱등 보강 후 helper 이관 완료.
 *   ([com.kgd.inventory.application.inventory.service.InventoryService.execute] (ReserveStockUseCase) 가
 *   `findActiveByOrderIdAndProductId` pre-check 로 idempotent return 보장.)
 * - [onFulfillmentShipped] / [onFulfillmentCancelled] / [onOrderCancelled] — `ConfirmStockByOrderUseCase` /
 *   `ReleaseStockByOrderUseCase` 모두 ACTIVE 상태 reservation 만 필터하여 처리 → 재배달 시 자연 no-op.
 */
@Component
class InventoryEventConsumer(
    private val reserveStockUseCase: ReserveStockUseCase,
    private val confirmStockByOrderUseCase: ConfirmStockByOrderUseCase,
    private val releaseStockByOrderUseCase: ReleaseStockByOrderUseCase,
    private val objectMapper: ObjectMapper,
    private val idempotentEventHandler: IdempotentEventHandler,
    private val idempotentMetrics: IdempotentMetrics,
    // ADR-0032 Phase 3 / PR-4 — order.cancelled → inventory release latency 메트릭.
    // @Autowired(required = false) 로 노출하여 메트릭 미적재 환경(unit test 등)에서도 안전.
    @Autowired(required = false)
    private val inventoryMetrics: InventoryMetrics? = null,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * ADR-0029 PR-8a — `ReserveStockUseCase` 자연 멱등 보강 후 common helper 이관.
     *
     * `InventoryService.execute(ReserveStockUseCase.Command)` 가 같은 `(orderId, productId)` 의 ACTIVE
     * Reservation 을 발견하면 신규 차감 없이 기존 결과를 반환한다 → helper race 흡수와 결합해 이중 차감을 차단.
     */
    @KafkaListener(
        topics = ["order.order.completed"],
        groupId = CONSUMER_GROUP,
        containerFactory = "kafkaListenerContainerFactory",
    )
    fun onOrderCompleted(record: ConsumerRecord<String, String>) {
        log.info("Received order.order.completed: key={}", record.key())

        val event = objectMapper.readValue(record.value(), OrderCompletedEvent::class.java)
        val eventUuid = parseEventId(event.eventId)
        if (eventUuid == null) {
            log.warn("missing eventId topic={} — graceful degrade, executing without dedup", record.topic())
            idempotentMetrics.missingId(CONSUMER_GROUP)
            reserveItems(event)
            return
        }

        idempotentEventHandler.process(eventUuid, CONSUMER_GROUP) {
            reserveItems(event)
        }
    }

    private fun reserveItems(event: OrderCompletedEvent) {
        if (event.items.isEmpty()) {
            log.warn("Order {} has no items, skipping reservation", event.orderId)
            return
        }

        for (item in event.items) {
            reserveStockUseCase.execute(
                ReserveStockUseCase.Command(
                    orderId = event.orderId,
                    productId = item.productId,
                    warehouseId = 1L,
                    qty = item.quantity,
                )
            )
            log.info("Reserved stock: orderId={}, productId={}, qty={}", event.orderId, item.productId, item.quantity)
        }
    }

    @KafkaListener(
        topics = ["fulfillment.order.shipped"],
        groupId = CONSUMER_GROUP,
        containerFactory = "kafkaListenerContainerFactory",
    )
    fun onFulfillmentShipped(record: ConsumerRecord<String, String>) {
        log.info("Received fulfillment.order.shipped: key={}", record.key())

        val event = objectMapper.readValue(record.value(), FulfillmentShippedEvent::class.java)
        val eventUuid = parseEventId(event.eventId)
        if (eventUuid == null) {
            log.warn("missing eventId topic={} — graceful degrade, executing without dedup", record.topic())
            idempotentMetrics.missingId(CONSUMER_GROUP)
            confirmStock(event.orderId)
            return
        }

        idempotentEventHandler.process(eventUuid, CONSUMER_GROUP) {
            confirmStock(event.orderId)
        }
    }

    @KafkaListener(
        topics = ["fulfillment.order.cancelled"],
        groupId = CONSUMER_GROUP,
        containerFactory = "kafkaListenerContainerFactory",
    )
    fun onFulfillmentCancelled(record: ConsumerRecord<String, String>) {
        log.info("Received fulfillment.order.cancelled: key={}", record.key())

        val event = objectMapper.readValue(record.value(), FulfillmentCancelledEvent::class.java)
        val eventUuid = parseEventId(event.eventId)
        if (eventUuid == null) {
            log.warn("missing eventId topic={} — graceful degrade, executing without dedup", record.topic())
            idempotentMetrics.missingId(CONSUMER_GROUP)
            releaseStock(event.orderId, reason = null)
            return
        }

        idempotentEventHandler.process(eventUuid, CONSUMER_GROUP) {
            releaseStock(event.orderId, reason = null)
        }
    }

    /**
     * ADR-0032 Part 2 / PR-3 — `order.order.cancelled` 보상 흐름.
     *
     * 결제 실패 / 사용자 취소 시 Order 측 Outbox 가 본 토픽을 발행한다. 30분 TTL fallback
     * ([com.kgd.inventory.application.reservation.service.ReservationExpiryService]) 보다 빠르게
     * (~1-2초) 재고를 release 하여 flash sale 시나리오의 false-negative 를 제거한다.
     *
     * ## 멱등 보장 (ADR-0029 PR-8)
     * common [IdempotentEventHandler] 로 위임. `(eventId, consumer_group="inventory-service")`
     * 복합 PK 단위로 마킹.
     *
     * ## 두 경로의 race-free
     * 같은 reservation 에 대해 `fulfillment.order.cancelled` 와 `order.order.cancelled` 가 동시에
     * 도착해도 [releaseStockByOrderUseCase] 가 ACTIVE → CANCELLED 전이만 수행하므로 두 번째 호출은
     * 자연 no-op 이다 (자연 멱등).
     */
    @KafkaListener(
        topics = ["order.order.cancelled"],
        groupId = CONSUMER_GROUP,
        containerFactory = "kafkaListenerContainerFactory",
    )
    fun onOrderCancelled(record: ConsumerRecord<String, String>) {
        log.info("Received order.order.cancelled: key={}", record.key())

        val event = objectMapper.readValue(record.value(), OrderCancelledEvent::class.java)
        val eventUuid = parseEventId(event.eventId)
        if (eventUuid == null) {
            log.warn("missing eventId topic={} — graceful degrade, executing without dedup", record.topic())
            idempotentMetrics.missingId(CONSUMER_GROUP)
            releaseStock(event.orderId, reason = event.reason)
            recordCancellationLatency(event)
            return
        }

        idempotentEventHandler.process(eventUuid, CONSUMER_GROUP) {
            releaseStock(event.orderId, reason = event.reason)
            // 멱등 dedup 통과 시점 (= 실 release 가 처음 일어나는 시점) 에만 latency 기록.
            // 재배달로 dedup hit 한 경우는 측정 의미가 없어 제외.
            recordCancellationLatency(event)
        }
    }

    /**
     * ADR-0032 Phase 3 / PR-4 — Order 측 `OrderCancelledEvent.eventTime` (= outbox.save 시각) → inventory
     * release 완료 시각 사이 latency 를 Histogram 으로 기록한다.
     *
     * - `eventTime` 은 LocalDateTime (timezone 없음) → 서비스 간 동일 ZoneId 가정 (k8s 배포 표준).
     *   서로 다른 ZoneId 환경에서는 양수/음수 latency skew 가 발생할 수 있어 [InventoryMetrics] 에서 0 클램프.
     */
    private fun recordCancellationLatency(event: OrderCancelledEvent) {
        val metrics = inventoryMetrics ?: return
        val publishedAt = event.eventTime.atZone(ZoneId.systemDefault()).toInstant()
        val latency = Duration.between(publishedAt, Instant.now())
        metrics.recordOrderCancellationLatency(reason = event.reason, latency = latency)
    }

    private fun confirmStock(orderId: Long) {
        val results = confirmStockByOrderUseCase.execute(
            ConfirmStockByOrderUseCase.Command(orderId = orderId)
        )

        if (results.isEmpty()) {
            log.warn("No active reservations found for orderId={}", orderId)
        } else {
            results.forEach { result ->
                log.info(
                    "Confirmed stock: orderId={}, productId={}, availableQty={}, reservedQty={}",
                    orderId, result.productId, result.availableQty, result.reservedQty,
                )
            }
        }
    }

    private fun releaseStock(orderId: Long, reason: String?) {
        val results = releaseStockByOrderUseCase.execute(
            ReleaseStockByOrderUseCase.Command(orderId = orderId)
        )

        if (results.isEmpty()) {
            if (reason != null) {
                log.warn(
                    "No active reservations found for orderId={}, reason={} (already released or fulfillment cascaded first)",
                    orderId, reason,
                )
            } else {
                log.warn("No active reservations found for orderId={}", orderId)
            }
        } else {
            results.forEach { result ->
                if (reason != null) {
                    log.info(
                        "Released stock (order cancelled, reason={}): orderId={}, productId={}, availableQty={}, reservedQty={}",
                        reason, orderId, result.productId, result.availableQty, result.reservedQty,
                    )
                } else {
                    log.info(
                        "Released stock: orderId={}, productId={}, availableQty={}, reservedQty={}",
                        orderId, result.productId, result.availableQty, result.reservedQty,
                    )
                }
            }
        }
    }

    /**
     * eventId 가 UUID 형식이 아니거나 비어 있으면 null 반환 → 호출자가 graceful degrade 결정.
     */
    private fun parseEventId(raw: String?): UUID? = try {
        raw?.takeIf { it.isNotBlank() }?.let(UUID::fromString)
    } catch (e: IllegalArgumentException) {
        log.warn("Invalid eventId format, skipping idempotency check: raw={}", raw)
        null
    }

    companion object {
        /** ADR-0029 §6.2.1 — inventory 컨슈머의 표준 group id. */
        private const val CONSUMER_GROUP = "inventory-service"
    }
}
