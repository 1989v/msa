package com.kgd.search.job

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
    val createdAt: LocalDateTime
)
