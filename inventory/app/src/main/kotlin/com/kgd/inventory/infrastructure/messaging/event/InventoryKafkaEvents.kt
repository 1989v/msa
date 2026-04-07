package com.kgd.inventory.infrastructure.messaging.event

import java.math.BigDecimal
import java.time.LocalDateTime

/**
 * Inbound event: consumed from order.order.completed topic.
 */
data class OrderCompletedEvent(
    val eventId: String = "",
    val orderId: Long = 0,
    val userId: String = "",
    val totalAmount: BigDecimal = BigDecimal.ZERO,
    val status: String = "",
    val items: List<OrderItemPayload> = emptyList(),
    val eventTime: LocalDateTime = LocalDateTime.now(),
)

data class OrderItemPayload(
    val productId: Long = 0,
    val quantity: Int = 0,
    val unitPrice: BigDecimal = BigDecimal.ZERO,
)
