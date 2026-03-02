package com.kgd.product.presentation.product.dto

import com.kgd.product.application.product.usecase.UpdateProductUseCase
import jakarta.validation.constraints.DecimalMin
import jakarta.validation.constraints.Size
import java.math.BigDecimal

data class UpdateProductRequest(
    @field:Size(min = 1, max = 255, message = "상품명은 1자 이상 255자 이하여야 합니다")
    val name: String? = null,

    @field:DecimalMin(value = "0.01", message = "가격은 0보다 커야 합니다")
    val price: BigDecimal? = null
) {
    fun toCommand(id: Long) = UpdateProductUseCase.Command(id = id, name = name, price = price)
}
