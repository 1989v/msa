package com.kgd.fulfillment.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.fulfillment.application.fulfillment.usecase.CreateFulfillmentUseCase
import com.kgd.fulfillment.infrastructure.persistence.idempotency.ProcessedEventJpaEntity
import com.kgd.fulfillment.infrastructure.persistence.idempotency.ProcessedEventJpaRepository
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
class FulfillmentEventConsumer(
    private val createFulfillmentUseCase: CreateFulfillmentUseCase,
    private val objectMapper: ObjectMapper,
    private val processedEventRepository: ProcessedEventJpaRepository,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @KafkaListener(
        topics = ["inventory.stock.reserved"],
        containerFactory = "kafkaListenerContainerFactory"
    )
    fun onStockReserved(record: ConsumerRecord<String, String>) {
        val message = record.value()
        val node = objectMapper.readTree(message)
        val eventId = node.get("eventId")?.asText() ?: ""
        val orderId = node.get("orderId").asLong()
        val warehouseId = node.get("warehouseId").asLong()

        log.info("Received stock reserved event: orderId={}, warehouseId={}", orderId, warehouseId)

        if (eventId.isNotBlank() && processedEventRepository.existsById(eventId)) {
            log.info("Duplicate event detected, skipping: eventId={}", eventId)
            return
        }

        createFulfillmentUseCase.execute(
            CreateFulfillmentUseCase.Command(
                orderId = orderId,
                warehouseId = warehouseId
            )
        )

        if (eventId.isNotBlank()) {
            processedEventRepository.save(ProcessedEventJpaEntity(eventId, "inventory.stock.reserved"))
        }
        log.info("Fulfillment created for orderId={}", orderId)
    }
}
