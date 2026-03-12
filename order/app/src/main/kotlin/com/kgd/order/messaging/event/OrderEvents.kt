package com.kgd.order.infrastructure.messaging.event

import java.math.BigDecimal
import java.time.LocalDateTime

data class OrderCompletedEvent(
    val orderId: Long,
    val userId: String,
    val totalAmount: BigDecimal,
    val status: String,
    val eventTime: LocalDateTime = LocalDateTime.now()
)

data class OrderCancelledEvent(
    val orderId: Long,
    val userId: String,
    val eventTime: LocalDateTime = LocalDateTime.now()
)
