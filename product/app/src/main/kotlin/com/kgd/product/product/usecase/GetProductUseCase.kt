package com.kgd.product.application.product.usecase

import java.math.BigDecimal

interface GetProductUseCase {
    fun execute(id: Long): Result

    data class Result(val id: Long, val name: String, val price: BigDecimal, val stock: Int, val status: String)
}
