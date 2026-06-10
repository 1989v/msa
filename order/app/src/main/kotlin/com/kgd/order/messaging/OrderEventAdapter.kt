package com.kgd.order.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.order.application.order.port.OrderEventPort
import com.kgd.order.domain.order.model.Order
import com.kgd.order.infrastructure.messaging.event.OrderCancelledEvent
import com.kgd.order.infrastructure.messaging.event.OrderCompletedEvent
import com.kgd.order.infrastructure.messaging.event.OrderItemEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

/**
 * ADR-0032 PR-2 — `kafkaTemplate.send` 직접 호출을 outbox 패턴으로 교체.
 *
 * publish 호출은 비즈니스 entity save 와 같은 `@Transactional` 안에서 이루어져야 한다 (Outbox 의 본질).
 * 실제 Kafka publish 는 [com.kgd.common.messaging.outbox.OutboxPollingPublisher] 가 별도 스케줄로 비동기 처리한다.
 */
@Component
class OrderEventAdapter(
    private val outboxPort: OutboxPort,
    private val objectMapper: ObjectMapper,
    @Value("\${kafka.topics.order-completed}") private val completedTopic: String,
    @Value("\${kafka.topics.order-cancelled}") private val cancelledTopic: String,
) : OrderEventPort {

    private val log = KotlinLogging.logger {}

    override fun publishOrderCompleted(order: Order) {
        val orderId = requireNotNull(order.id) { "주문 ID 가 없는 상태에서 이벤트 발행이 호출되었습니다" }
        val event = OrderCompletedEvent(
            orderId = orderId,
            userId = order.userId,
            totalAmount = order.totalAmount.amount,
            status = order.status.name,
            items = order.items.map { item ->
                OrderItemEvent(
                    productId = item.productId,
                    quantity = item.quantity,
                    unitPrice = item.unitPrice.amount,
                )
            },
        )
        outboxPort.save(
            aggregateType = "Order",
            aggregateId = orderId,
            eventType = completedTopic,
            payload = objectMapper.writeValueAsString(event),
        )
        log.info { "Enqueued OrderCompletedEvent to outbox: orderId=$orderId" }
    }

    override fun publishOrderCancelled(order: Order) {
        val orderId = requireNotNull(order.id) { "주문 ID 가 없는 상태에서 이벤트 발행이 호출되었습니다" }
        val event = OrderCancelledEvent(
            orderId = orderId,
            userId = order.userId,
        )
        outboxPort.save(
            aggregateType = "Order",
            aggregateId = orderId,
            eventType = cancelledTopic,
            payload = objectMapper.writeValueAsString(event),
        )
        log.info { "Enqueued OrderCancelledEvent to outbox: orderId=$orderId" }
    }
}
