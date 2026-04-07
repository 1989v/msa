package com.kgd.inventory.infrastructure.messaging.event

import java.math.BigDecimal
import java.time.LocalDateTime

/**
 * Inbound event: consumed from order.order.completed topic.
 */
data class OrderCompletedEvent(
    val orderId: Long = 0,
    val userId: String = "",
    val totalAmount: BigDecimal = BigDecimal.ZERO,
    val status: String = "",
    val eventTime: LocalDateTime = LocalDateTime.now(),
)

/**
 * Represents a single order item for stock reservation.
 * Phase 1: orderId + productId + warehouseId + qty extracted from order payload.
 */
data class OrderItemPayload(
    val productId: Long = 0,
    val warehouseId: Long = 0,
    val qty: Int = 0,
)
