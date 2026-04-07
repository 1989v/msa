package com.kgd.order.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.order.application.order.port.OrderEventPort
import com.kgd.order.application.order.service.OrderTransactionalService
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.kafka.support.Acknowledgment
import org.springframework.stereotype.Component

@Component
class OrderEventConsumer(
    private val orderTransactionalService: OrderTransactionalService,
    private val eventPort: OrderEventPort,
    private val objectMapper: ObjectMapper,
) {

    private val log = LoggerFactory.getLogger(javaClass)

    @KafkaListener(
        topics = ["inventory.reservation.expired"],
        groupId = "order-service",
        containerFactory = "kafkaListenerContainerFactory",
    )
    fun onReservationExpired(record: ConsumerRecord<String, String>, ack: Acknowledgment) {
        log.info("Received reservation expired event: key={}", record.key())
        try {
            val node = objectMapper.readTree(record.value())
            val orderId = node.get("orderId").asLong()

            log.info("Cancelling order due to reservation expiry: orderId={}", orderId)

            val cancelled = orderTransactionalService.cancelOrder(orderId)
            eventPort.publishOrderCancelled(cancelled)

            ack.acknowledge()
            log.info("Order cancelled due to reservation expiry: orderId={}", orderId)
        } catch (e: Exception) {
            log.error("Failed to process reservation expired event: key={}", record.key(), e)
        }
    }
}
