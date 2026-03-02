package com.kgd.search.infrastructure.messaging

import java.math.BigDecimal
import java.time.LocalDateTime

data class ProductIndexEvent(
    val productId: Long = 0,
    val name: String = "",
    val price: BigDecimal = BigDecimal.ZERO,
    val status: String = "",
    val eventTime: LocalDateTime = LocalDateTime.now()
)
