package com.kgd.inventory.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.inventory.application.inventory.usecase.ReserveStockUseCase
import com.kgd.inventory.infrastructure.messaging.event.OrderCompletedEvent
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.kafka.support.Acknowledgment
import org.springframework.stereotype.Component

@Component
class InventoryEventConsumer(
    private val reserveStockUseCase: ReserveStockUseCase,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @KafkaListener(
        topics = ["order.order.completed"],
        groupId = "inventory-service",
        containerFactory = "kafkaListenerContainerFactory",
    )
    fun onOrderCompleted(record: ConsumerRecord<String, String>, ack: Acknowledgment) {
        log.info("Received order.order.completed: key={}, value={}", record.key(), record.value())

        try {
            val event = objectMapper.readValue(record.value(), OrderCompletedEvent::class.java)
            log.info(
                "Parsed OrderCompletedEvent: orderId={}, userId={}, totalAmount={}",
                event.orderId, event.userId, event.totalAmount,
            )

            // Phase 1: log the event. Full item-level reservation requires order items in the event payload.
            // When order events include item details, iterate and call reserveStockUseCase for each item.
            log.info("Order {} received for inventory processing (Phase 1: event logged)", event.orderId)

            ack.acknowledge()
        } catch (e: Exception) {
            log.error("Failed to process order.order.completed: key={}", record.key(), e)
            // Do not acknowledge — message will be redelivered
        }
    }
}
