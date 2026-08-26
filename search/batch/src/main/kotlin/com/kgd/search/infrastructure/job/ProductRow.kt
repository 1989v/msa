package com.kgd.search.infrastructure.job

import java.math.BigDecimal
import java.time.LocalDateTime

data class ProductRow(
    val id: Long,
    val name: String,
    val price: BigDecimal,
    val stock: Int,
    val status: String,
    val brand: String?,
    val description: String?,
    val category: String?,
    val energyKcal: Double?,
    val carbohydrateG: Double?,
    val proteinG: Double?,
    val fatG: Double?,
    val sugarG: Double?,
    val sodiumMg: Double?,
    val ingredients: String?,
    val originCountry: String?,
    val itemReportNo: String?,
    val createdAt: LocalDateTime
)
