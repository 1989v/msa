package com.kgd.product.presentation.product.dto

import com.kgd.product.application.product.usecase.UpdateProductUseCase
import jakarta.validation.constraints.Positive
import jakarta.validation.constraints.PositiveOrZero
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
    val category: String? = null,

    // 영양성분 100g 기준 (ADR-0060) — null 은 미변경
    @field:PositiveOrZero(message = "에너지(kcal)는 0 이상이어야 합니다")
    val energyKcal: Double? = null,
    @field:PositiveOrZero(message = "탄수화물(g)은 0 이상이어야 합니다")
    val carbohydrateG: Double? = null,
    @field:PositiveOrZero(message = "단백질(g)은 0 이상이어야 합니다")
    val proteinG: Double? = null,
    @field:PositiveOrZero(message = "지방(g)은 0 이상이어야 합니다")
    val fatG: Double? = null,
    @field:PositiveOrZero(message = "당류(g)는 0 이상이어야 합니다")
    val sugarG: Double? = null,
    @field:PositiveOrZero(message = "나트륨(mg)은 0 이상이어야 합니다")
    val sodiumMg: Double? = null,
    @field:Size(max = 2000, message = "원재료는 2000자 이하여야 합니다")
    val ingredients: String? = null,
    @field:Size(max = 64, message = "원산지는 64자 이하여야 합니다")
    val originCountry: String? = null,
    @field:Size(max = 30, message = "품목제조보고번호는 30자 이하여야 합니다")
    val itemReportNo: String? = null
) {
    fun toCommand(id: Long) = UpdateProductUseCase.Command(
        id = id,
        name = name,
        price = price,
        brand = brand,
        description = description,
        category = category,
        energyKcal = energyKcal,
        carbohydrateG = carbohydrateG,
        proteinG = proteinG,
        fatG = fatG,
        sugarG = sugarG,
        sodiumMg = sodiumMg,
        ingredients = ingredients,
        originCountry = originCountry,
        itemReportNo = itemReportNo
    )
}
