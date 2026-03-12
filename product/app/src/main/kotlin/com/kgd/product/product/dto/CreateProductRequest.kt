package com.kgd.product.presentation.product.dto

import com.kgd.product.application.product.usecase.CreateProductUseCase
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Positive
import java.math.BigDecimal

data class CreateProductRequest(
    @field:NotBlank(message = "상품명은 필수입니다")
    val name: String,
    @field:Positive(message = "가격은 0보다 커야 합니다")
    val price: BigDecimal,
    @field:Min(value = 0, message = "재고는 0 이상이어야 합니다")
    val stock: Int
) {
    fun toCommand() = CreateProductUseCase.Command(name = name, price = price, stock = stock)
}
