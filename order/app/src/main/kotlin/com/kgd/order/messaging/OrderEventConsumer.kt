package com.kgd.order.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.order.application.order.port.OrderEventPort
import com.kgd.order.application.order.service.OrderTransactionalService
import com.kgd.order.infrastructure.persistence.idempotency.ProcessedEventJpaEntity
import com.kgd.order.infrastructure.persistence.idempotency.ProcessedEventJpaRepository
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
class OrderEventConsumer(
    private val orderTransactionalService: OrderTransactionalService,
    private val eventPort: OrderEventPort,
    private val objectMapper: ObjectMapper,
    private val processedEventRepository: ProcessedEventJpaRepository,
) {

    private val log = LoggerFactory.getLogger(javaClass)

    @KafkaListener(
        topics = ["inventory.reservation.expired"],
        groupId = "order-service",
        containerFactory = "kafkaListenerContainerFactory",
    )
    fun onReservationExpired(record: ConsumerRecord<String, String>) {
        log.info("Received reservation expired event: key={}", record.key())

        val node = objectMapper.readTree(record.value())
        val eventId = node.get("eventId")?.asText() ?: ""
        val orderId = node.get("orderId").asLong()

        if (eventId.isNotBlank() && processedEventRepository.existsById(eventId)) {
            log.info("Duplicate event detected, skipping: eventId={}", eventId)
            return
        }

        log.info("Cancelling order due to reservation expiry: orderId={}", orderId)

        val cancelled = orderTransactionalService.cancelOrder(orderId)
        eventPort.publishOrderCancelled(cancelled)

        if (eventId.isNotBlank()) {
            processedEventRepository.save(ProcessedEventJpaEntity(eventId, "inventory.reservation.expired"))
        }
        log.info("Order cancelled due to reservation expiry: orderId={}", orderId)
    }
}
