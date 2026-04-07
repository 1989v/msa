package com.kgd.inventory.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.inventory.application.inventory.usecase.ConfirmStockByOrderUseCase
import com.kgd.inventory.application.inventory.usecase.ReleaseStockByOrderUseCase
import com.kgd.inventory.application.inventory.usecase.ReserveStockUseCase
import com.kgd.inventory.infrastructure.messaging.event.FulfillmentCancelledEvent
import com.kgd.inventory.infrastructure.messaging.event.FulfillmentShippedEvent
import com.kgd.inventory.infrastructure.messaging.event.OrderCompletedEvent
import com.kgd.inventory.infrastructure.persistence.idempotency.ProcessedEventJpaEntity
import com.kgd.inventory.infrastructure.persistence.idempotency.ProcessedEventJpaRepository
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
class InventoryEventConsumer(
    private val reserveStockUseCase: ReserveStockUseCase,
    private val confirmStockByOrderUseCase: ConfirmStockByOrderUseCase,
    private val releaseStockByOrderUseCase: ReleaseStockByOrderUseCase,
    private val objectMapper: ObjectMapper,
    private val processedEventRepository: ProcessedEventJpaRepository,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @KafkaListener(
        topics = ["order.order.completed"],
        groupId = "inventory-service",
        containerFactory = "kafkaListenerContainerFactory",
    )
    fun onOrderCompleted(record: ConsumerRecord<String, String>) {
        log.info("Received order.order.completed: key={}", record.key())

        val event = objectMapper.readValue(record.value(), OrderCompletedEvent::class.java)

        if (event.eventId.isNotBlank() && processedEventRepository.existsById(event.eventId)) {
            log.info("Duplicate event detected, skipping: eventId={}", event.eventId)
            return
        }

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
                    qty = item.quantity
                )
            )
            log.info("Reserved stock: orderId={}, productId={}, qty={}", event.orderId, item.productId, item.quantity)
        }

        if (event.eventId.isNotBlank()) {
            processedEventRepository.save(ProcessedEventJpaEntity(event.eventId, "order.order.completed"))
        }
    }

    @KafkaListener(
        topics = ["fulfillment.order.shipped"],
        groupId = "inventory-service",
        containerFactory = "kafkaListenerContainerFactory",
    )
    fun onFulfillmentShipped(record: ConsumerRecord<String, String>) {
        log.info("Received fulfillment.order.shipped: key={}", record.key())

        val event = objectMapper.readValue(record.value(), FulfillmentShippedEvent::class.java)

        if (event.eventId.isNotBlank() && processedEventRepository.existsById(event.eventId)) {
            log.info("Duplicate event detected, skipping: eventId={}", event.eventId)
            return
        }

        val results = confirmStockByOrderUseCase.execute(
            ConfirmStockByOrderUseCase.Command(orderId = event.orderId)
        )

        if (results.isEmpty()) {
            log.warn("No active reservations found for orderId={}", event.orderId)
        } else {
            results.forEach { result ->
                log.info(
                    "Confirmed stock: orderId={}, productId={}, availableQty={}, reservedQty={}",
                    event.orderId, result.productId, result.availableQty, result.reservedQty,
                )
            }
        }

        if (event.eventId.isNotBlank()) {
            processedEventRepository.save(ProcessedEventJpaEntity(event.eventId, "fulfillment.order.shipped"))
        }
    }

    @KafkaListener(
        topics = ["fulfillment.order.cancelled"],
        groupId = "inventory-service",
        containerFactory = "kafkaListenerContainerFactory",
    )
    fun onFulfillmentCancelled(record: ConsumerRecord<String, String>) {
        log.info("Received fulfillment.order.cancelled: key={}", record.key())

        val event = objectMapper.readValue(record.value(), FulfillmentCancelledEvent::class.java)

        if (event.eventId.isNotBlank() && processedEventRepository.existsById(event.eventId)) {
            log.info("Duplicate event detected, skipping: eventId={}", event.eventId)
            return
        }

        val results = releaseStockByOrderUseCase.execute(
            ReleaseStockByOrderUseCase.Command(orderId = event.orderId)
        )

        if (results.isEmpty()) {
            log.warn("No active reservations found for orderId={}", event.orderId)
        } else {
            results.forEach { result ->
                log.info(
                    "Released stock: orderId={}, productId={}, availableQty={}, reservedQty={}",
                    event.orderId, result.productId, result.availableQty, result.reservedQty,
                )
            }
        }

        if (event.eventId.isNotBlank()) {
            processedEventRepository.save(ProcessedEventJpaEntity(event.eventId, "fulfillment.order.cancelled"))
        }
    }
}
