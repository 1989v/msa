package com.kgd.fulfillment.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.fulfillment.application.fulfillment.usecase.CreateFulfillmentUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import java.util.UUID

/**
 * ADR-0029 PR-5 (Phase 3) — fulfillment 컨슈머의 멱등 처리는 common
 * [IdempotentEventHandler] 로 위임된다. 호출부는 더 이상 [com.kgd.fulfillment.infrastructure.persistence.idempotency.ProcessedEventJpaRepository]
 * 에 직접 의존하지 않는다.
 */
@Component
class FulfillmentEventConsumer(
    private val createFulfillmentUseCase: CreateFulfillmentUseCase,
    private val objectMapper: ObjectMapper,
    private val idempotentEventHandler: IdempotentEventHandler,
    private val idempotentMetrics: IdempotentMetrics,
) {
    private val log = KotlinLogging.logger {}

    @KafkaListener(
        topics = ["inventory.stock.reserved"],
        groupId = CONSUMER_GROUP,
        containerFactory = "kafkaListenerContainerFactory",
    )
    fun onStockReserved(record: ConsumerRecord<String, String>) {
        val message = record.value()
        val node = objectMapper.readTree(message)
        val rawEventId = node.get("eventId")?.asText() ?: ""
        val orderId = node.get("orderId").asLong()
        val warehouseId = node.get("warehouseId").asLong()

        log.info { "Received stock reserved event: orderId=$orderId, warehouseId=$warehouseId" }

        val eventUuid = parseEventId(rawEventId)
        if (eventUuid == null) {
            log.warn { "missing eventId topic=${record.topic()} — graceful degrade, executing without dedup" }
            idempotentMetrics.missingId(CONSUMER_GROUP)
            createFulfillmentUseCase.execute(
                CreateFulfillmentUseCase.Command(
                    orderId = orderId,
                    warehouseId = warehouseId,
                )
            )
            log.info { "Fulfillment created for orderId=$orderId (no idempotency check)" }
            return
        }

        idempotentEventHandler.process(eventUuid, CONSUMER_GROUP) {
            createFulfillmentUseCase.execute(
                CreateFulfillmentUseCase.Command(
                    orderId = orderId,
                    warehouseId = warehouseId,
                )
            )
            log.info { "Fulfillment created for orderId=$orderId" }
        }
    }

    /**
     * eventId 가 UUID 형식이 아니거나 비어 있으면 null 반환 → 호출자가 graceful degrade 결정.
     */
    private fun parseEventId(raw: String?): UUID? = try {
        raw?.takeIf { it.isNotBlank() }?.let(UUID::fromString)
    } catch (e: IllegalArgumentException) {
        log.warn { "Invalid eventId format, skipping idempotency check: raw=$raw" }
        null
    }

    companion object {
        /** ADR-0029 §6.2.3 — fulfillment 컨슈머의 표준 group id. */
        private const val CONSUMER_GROUP = "fulfillment-service"
    }
}
