package com.kgd.product.application.product.usecase

import java.math.BigDecimal

interface CreateProductUseCase {
    fun execute(command: Command): Result

    data class Command(val name: String, val price: BigDecimal, val stock: Int)
    data class Result(val id: Long, val name: String, val price: BigDecimal, val stock: Int, val status: String)
}
