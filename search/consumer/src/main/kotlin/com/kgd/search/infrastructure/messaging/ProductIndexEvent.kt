package com.kgd.search.infrastructure.messaging

import java.math.BigDecimal
import java.time.LocalDateTime

data class ProductIndexEvent(
    val productId: Long,
    val name: String,
    val price: BigDecimal,
    val status: String,
    val brand: String? = null,
    val description: String? = null,
    val category: String? = null,
    val energyKcal: Double? = null,
    val carbohydrateG: Double? = null,
    val proteinG: Double? = null,
    val fatG: Double? = null,
    val sugarG: Double? = null,
    val sodiumMg: Double? = null,
    val ingredients: String? = null,
    val originCountry: String? = null,
    val itemReportNo: String? = null,
    val eventTime: LocalDateTime
)
