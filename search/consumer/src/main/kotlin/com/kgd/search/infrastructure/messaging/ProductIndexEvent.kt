package com.kgd.search.infrastructure.messaging

import java.math.BigDecimal
import java.time.LocalDateTime

data class ProductIndexEvent(
    val productId: Long,
    val name: String,
    val price: BigDecimal,
    val status: String,
    val eventTime: LocalDateTime
)
