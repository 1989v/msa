package com.kgd.search.domain.product.model

import java.math.BigDecimal
import java.time.LocalDateTime

data class ProductDocument(
    val id: String,
    val name: String,
    val price: BigDecimal,
    val status: String,
    val createdAt: LocalDateTime = LocalDateTime.now(),
    val popularityScore: Double = 0.0,
    val ctr: Double = 0.0,
    val cvr: Double = 0.0,
    val ctrRaw: Double = 0.0,
    val cvrRaw: Double = 0.0,
    val gmv7d: Double = 0.0,
    val gmv30d: Double = 0.0,
    val scoreUpdatedAt: Long = 0,
    val categoryId: String? = null
)
