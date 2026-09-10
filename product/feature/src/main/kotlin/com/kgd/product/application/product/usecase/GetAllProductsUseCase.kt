package com.kgd.product.application.product.usecase

import java.math.BigDecimal
import java.time.LocalDateTime

interface GetAllProductsUseCase {
    fun execute(query: Query): Result

    data class Query(val page: Int, val size: Int)

    data class Result(
        val products: List<ProductResult>,
        val totalElements: Long,
        val totalPages: Int
    ) {
        data class ProductResult(
            val id: Long,
            val name: String,
            val price: BigDecimal,
            val status: String,
            val stock: Int,
            val createdAt: LocalDateTime,
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
            val itemReportNo: String? = null
        )
    }
}
