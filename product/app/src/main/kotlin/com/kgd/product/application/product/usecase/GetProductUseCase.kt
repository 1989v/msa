package com.kgd.product.application.product.usecase

import java.math.BigDecimal

interface GetProductUseCase {
    fun execute(id: Long): Result

    data class Result(
        val id: Long,
        val name: String,
        val price: BigDecimal,
        val stock: Int,
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
        val itemReportNo: String? = null
    )
}
