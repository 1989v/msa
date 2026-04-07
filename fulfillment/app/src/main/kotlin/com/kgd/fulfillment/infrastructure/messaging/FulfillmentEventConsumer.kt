package com.kgd.fulfillment.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.fulfillment.application.fulfillment.usecase.CreateFulfillmentUseCase
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.kafka.support.Acknowledgment
import org.springframework.stereotype.Component

@Component
class FulfillmentEventConsumer(
    private val createFulfillmentUseCase: CreateFulfillmentUseCase,
    private val objectMapper: ObjectMapper
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @KafkaListener(
        topics = ["inventory.stock.reserved"],
        containerFactory = "kafkaListenerContainerFactory"
    )
    fun onStockReserved(message: String, acknowledgment: Acknowledgment) {
        try {
            val node = objectMapper.readTree(message)
            val orderId = node.get("orderId").asLong()
            val warehouseId = node.get("warehouseId").asLong()

            log.info("Received stock reserved event: orderId={}, warehouseId={}", orderId, warehouseId)

            createFulfillmentUseCase.execute(
                CreateFulfillmentUseCase.Command(
                    orderId = orderId,
                    warehouseId = warehouseId
                )
            )

            acknowledgment.acknowledge()
            log.info("Fulfillment created for orderId={}", orderId)
        } catch (e: Exception) {
            log.error("Failed to process stock reserved event: {}", message, e)
            throw e
        }
    }
}
