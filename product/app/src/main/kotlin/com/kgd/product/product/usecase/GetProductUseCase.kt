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
        val category: String? = null
    )
}
