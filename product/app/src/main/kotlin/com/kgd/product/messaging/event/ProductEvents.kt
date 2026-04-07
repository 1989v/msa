package com.kgd.product.infrastructure.messaging.event

import java.math.BigDecimal
import java.time.LocalDateTime
import java.util.UUID

data class ProductCreatedEvent(
    val eventId: String = UUID.randomUUID().toString(),
    val productId: Long,
    val name: String,
    val price: BigDecimal,
    val status: String,
    val eventTime: LocalDateTime = LocalDateTime.now()
)

data class ProductUpdatedEvent(
    val eventId: String = UUID.randomUUID().toString(),
    val productId: Long,
    val name: String,
    val price: BigDecimal,
    val status: String,
    val eventTime: LocalDateTime = LocalDateTime.now()
)
