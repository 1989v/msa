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
    val eventTime: LocalDateTime = LocalDateTime.now()
)

data class ProductUpdatedEvent(
    val eventId: String = UUID.randomUUID().toString(),
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
    val eventTime: LocalDateTime = LocalDateTime.now()
)
