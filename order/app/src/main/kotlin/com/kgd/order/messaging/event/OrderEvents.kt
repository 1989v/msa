package com.kgd.order.infrastructure.messaging.event

import java.math.BigDecimal
import java.time.LocalDateTime

data class OrderCompletedEvent(
    val orderId: Long,
    val userId: String,
    val totalAmount: BigDecimal,
    val status: String,
    val items: List<OrderItemEvent> = emptyList(),
    val eventTime: LocalDateTime = LocalDateTime.now()
)

data class OrderItemEvent(
    val productId: Long,
    val quantity: Int,
    val unitPrice: BigDecimal
)

data class OrderCancelledEvent(
    val orderId: Long,
    val userId: String,
    val eventTime: LocalDateTime = LocalDateTime.now()
)
