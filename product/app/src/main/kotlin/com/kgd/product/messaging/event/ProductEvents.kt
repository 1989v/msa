package com.kgd.product.infrastructure.messaging.event

import java.math.BigDecimal
import java.time.LocalDateTime

data class ProductCreatedEvent(
    val productId: Long,
    val name: String,
    val price: BigDecimal,
    val status: String,
    val eventTime: LocalDateTime = LocalDateTime.now()
)

data class ProductUpdatedEvent(
    val productId: Long,
    val name: String,
    val price: BigDecimal,
    val status: String,
    val eventTime: LocalDateTime = LocalDateTime.now()
)
