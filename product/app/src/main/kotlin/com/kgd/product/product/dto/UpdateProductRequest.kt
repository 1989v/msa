package com.kgd.product.presentation.product.dto

import com.kgd.product.application.product.usecase.UpdateProductUseCase
import jakarta.validation.constraints.Positive
import jakarta.validation.constraints.Size
import java.math.BigDecimal

data class UpdateProductRequest(
    @field:Size(min = 1, max = 255, message = "상품명은 1자 이상 255자 이하여야 합니다")
    val name: String? = null,

    @field:Positive(message = "가격은 0보다 커야 합니다")
    val price: BigDecimal? = null,

    @field:Size(max = 100, message = "브랜드는 100자 이하여야 합니다")
    val brand: String? = null,

    @field:Size(max = 2000, message = "설명은 2000자 이하여야 합니다")
    val description: String? = null,

    @field:Size(max = 100, message = "카테고리는 100자 이하여야 합니다")
    val category: String? = null
) {
    fun toCommand(id: Long) = UpdateProductUseCase.Command(
        id = id,
        name = name,
        price = price,
        brand = brand,
        description = description,
        category = category
    )
}
