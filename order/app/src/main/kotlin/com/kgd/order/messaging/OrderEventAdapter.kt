package com.kgd.order.infrastructure.messaging

import com.kgd.order.application.order.port.OrderEventPort
import com.kgd.order.domain.order.model.Order
import com.kgd.order.infrastructure.messaging.event.OrderCancelledEvent
import com.kgd.order.infrastructure.messaging.event.OrderCompletedEvent
import com.kgd.order.infrastructure.messaging.event.OrderItemEvent
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component

@Component
class OrderEventAdapter(
    private val kafkaTemplate: KafkaTemplate<String, Any>,
    @Value("\${kafka.topics.order-completed}") private val completedTopic: String,
    @Value("\${kafka.topics.order-cancelled}") private val cancelledTopic: String
) : OrderEventPort {

    private val log = LoggerFactory.getLogger(javaClass)

    override fun publishOrderCompleted(order: Order) {
        val event = OrderCompletedEvent(
            orderId = requireNotNull(order.id),
            userId = order.userId,
            totalAmount = order.totalAmount.amount,
            status = order.status.name,
            items = order.items.map { item ->
                OrderItemEvent(
                    productId = item.productId,
                    quantity = item.quantity,
                    unitPrice = item.unitPrice.amount
                )
            }
        )
        kafkaTemplate.send(completedTopic, order.id.toString(), event)
            .whenComplete { _, ex ->
                if (ex != null) log.error("Failed to publish OrderCompletedEvent: orderId={}", order.id, ex)
                else log.info("Published OrderCompletedEvent: orderId={}", order.id)
            }
    }

    override fun publishOrderCancelled(order: Order) {
        val event = OrderCancelledEvent(
            orderId = requireNotNull(order.id),
            userId = order.userId
        )
        kafkaTemplate.send(cancelledTopic, order.id.toString(), event)
            .whenComplete { _, ex ->
                if (ex != null) log.error("Failed to publish OrderCancelledEvent: orderId={}", order.id, ex)
                else log.info("Published OrderCancelledEvent: orderId={}", order.id)
            }
    }
}
