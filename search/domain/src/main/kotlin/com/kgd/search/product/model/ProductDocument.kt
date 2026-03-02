package com.kgd.search.domain.product.model

import java.math.BigDecimal
import java.time.LocalDateTime

data class ProductDocument(
    val id: String,
    val name: String,
    val price: BigDecimal,
    val status: String,
    val createdAt: LocalDateTime = LocalDateTime.now()
)
