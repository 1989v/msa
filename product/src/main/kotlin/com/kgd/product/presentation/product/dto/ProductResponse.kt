package com.kgd.product.presentation.product.dto

import com.kgd.product.application.product.usecase.CreateProductUseCase
import com.kgd.product.application.product.usecase.GetProductUseCase
import java.math.BigDecimal

data class ProductResponse(
    val id: Long,
    val name: String,
    val price: BigDecimal,
    val stock: Int,
    val status: String
) {
    companion object {
        fun from(result: CreateProductUseCase.Result) =
            ProductResponse(result.id, result.name, result.price, result.stock, result.status)

        fun from(result: GetProductUseCase.Result) =
            ProductResponse(result.id, result.name, result.price, result.stock, result.status)
    }
}
