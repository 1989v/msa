package com.kgd.product.application.product.usecase

import java.math.BigDecimal

interface UpdateProductUseCase {
    fun execute(command: Command): Result

    data class Command(
        val id: Long,
        val name: String? = null,
        val price: BigDecimal? = null,
        val brand: String? = null,
        val description: String? = null,
        val category: String? = null
    )

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
