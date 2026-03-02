package com.kgd.product.application.product.usecase

import java.math.BigDecimal

interface UpdateProductUseCase {
    fun execute(command: Command): Result

    data class Command(val id: Long, val name: String? = null, val price: BigDecimal? = null)
    data class Result(val id: Long, val name: String, val price: BigDecimal, val stock: Int, val status: String)
}
