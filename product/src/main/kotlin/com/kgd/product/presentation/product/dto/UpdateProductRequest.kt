package com.kgd.product.presentation.product.dto

import com.kgd.product.application.product.usecase.UpdateProductUseCase
import java.math.BigDecimal

data class UpdateProductRequest(
    val name: String? = null,
    val price: BigDecimal? = null
) {
    fun toCommand(id: Long) = UpdateProductUseCase.Command(id = id, name = name, price = price)
}
