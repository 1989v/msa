package com.kgd.inventory.infrastructure.messaging.event

import java.time.LocalDateTime

/**
 * Inbound event: consumed from fulfillment.order.shipped topic.
 */
data class FulfillmentShippedEvent(
    val eventId: String = "",
    val orderId: Long = 0,
    val eventTime: LocalDateTime = LocalDateTime.now(),
)

/**
 * Inbound event: consumed from fulfillment.order.cancelled topic.
 */
data class FulfillmentCancelledEvent(
    val eventId: String = "",
    val orderId: Long = 0,
    val eventTime: LocalDateTime = LocalDateTime.now(),
)
