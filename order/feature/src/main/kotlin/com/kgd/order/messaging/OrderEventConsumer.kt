package com.kgd.order.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.order.application.order.service.OrderTransactionalService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import java.util.UUID

/**
 * ADR-0032 PR-2 — `cancelOrder` 가 같은 트랜잭션 안에서 outbox INSERT 까지 처리하므로
 * 별도 `eventPort.publishOrderCancelled` 호출이 제거되었다.
 *
 * ADR-0029 PR-3b — `processed_event` 테이블이 §6 표준 스키마(BINARY(16) UUID + 복합 PK) 로 전환됐다.
 * ADR-0029 PR-6 — 본 컨슈머는 common 의 [IdempotentEventHandler] 헬퍼로 멱등 처리를 위임한다.
 *   in-place dedup 코드는 제거되며, eventId 누락 시에는 [IdempotentMetrics.missingId] 로 메트릭을 노출하고
 *   graceful degrade (멱등 검사 skip) 로 비즈니스 로직만 실행한다.
 */
@Component
class OrderEventConsumer(
    private val orderTransactionalService: OrderTransactionalService,
    private val objectMapper: ObjectMapper,
    @org.springframework.beans.factory.annotation.Qualifier("orderIdempotentEventHandler")
    private val idempotentEventHandler: IdempotentEventHandler,
    private val idempotentMetrics: IdempotentMetrics,
) {

    private val log = KotlinLogging.logger {}

    @KafkaListener(
        topics = ["inventory.reservation.expired"],
        groupId = CONSUMER_GROUP,
        containerFactory = "orderKafkaListenerContainerFactory",
    )
    fun onReservationExpired(record: ConsumerRecord<String, String>) {
        log.info { "Received reservation expired event: key=${record.key()}" }

        val node = objectMapper.readTree(record.value())
        val rawEventId = node.get("eventId")?.asText().orEmpty()
        val orderId = node.get("orderId").asLong()

        val eventId = parseEventId(rawEventId)
        if (eventId == null) {
            // ADR-0029 §4 graceful degrade — eventId 누락 시 멱등 검사 skip + 메트릭 노출.
            log.warn {
                "missing eventId topic=inventory.reservation.expired — graceful degrade, executing without dedup raw=$rawEventId"
            }
            idempotentMetrics.missingId(CONSUMER_GROUP)
            cancelOrder(orderId)
            return
        }

        idempotentEventHandler.process(eventId, CONSUMER_GROUP) {
            cancelOrder(orderId)
        }
    }

    private fun cancelOrder(orderId: Long) {
        log.info { "Cancelling order due to reservation expiry: orderId=$orderId" }
        orderTransactionalService.cancelOrder(orderId)
        log.info { "Order cancelled due to reservation expiry: orderId=$orderId" }
    }

    private fun parseEventId(raw: String): UUID? =
        if (raw.isBlank()) null else runCatching { UUID.fromString(raw) }.getOrNull()

    companion object {
        private const val CONSUMER_GROUP = "order-service"
    }
}
