package com.kgd.product.presentation.product.dto

import com.kgd.product.application.product.usecase.CreateProductUseCase
import com.kgd.product.application.product.usecase.GetProductUseCase
import com.kgd.product.application.product.usecase.UpdateProductUseCase
import java.math.BigDecimal

data class ProductResponse(
    val id: Long,
    val name: String,
    val price: BigDecimal,
    val stock: Int,
    val status: String,
    val brand: String? = null,
    val description: String? = null,
    val category: String? = null,
    val energyKcal: Double? = null,
    val carbohydrateG: Double? = null,
    val proteinG: Double? = null,
    val fatG: Double? = null,
    val sugarG: Double? = null,
    val sodiumMg: Double? = null,
    val ingredients: String? = null,
    val originCountry: String? = null,
    val itemReportNo: String? = null
) {
    companion object {
        fun from(result: CreateProductUseCase.Result) = ProductResponse(
            id = result.id,
            name = result.name,
            price = result.price,
            stock = result.stock,
            status = result.status,
            brand = result.brand,
            description = result.description,
            category = result.category,
            energyKcal = result.energyKcal,
            carbohydrateG = result.carbohydrateG,
            proteinG = result.proteinG,
            fatG = result.fatG,
            sugarG = result.sugarG,
            sodiumMg = result.sodiumMg,
            ingredients = result.ingredients,
            originCountry = result.originCountry,
            itemReportNo = result.itemReportNo
        )

        fun from(result: GetProductUseCase.Result) = ProductResponse(
            id = result.id,
            name = result.name,
            price = result.price,
            stock = result.stock,
            status = result.status,
            brand = result.brand,
            description = result.description,
            category = result.category,
            energyKcal = result.energyKcal,
            carbohydrateG = result.carbohydrateG,
            proteinG = result.proteinG,
            fatG = result.fatG,
            sugarG = result.sugarG,
            sodiumMg = result.sodiumMg,
            ingredients = result.ingredients,
            originCountry = result.originCountry,
            itemReportNo = result.itemReportNo
        )

        fun from(result: UpdateProductUseCase.Result) = ProductResponse(
            id = result.id,
            name = result.name,
            price = result.price,
            stock = result.stock,
            status = result.status,
            brand = result.brand,
            description = result.description,
            category = result.category,
            energyKcal = result.energyKcal,
            carbohydrateG = result.carbohydrateG,
            proteinG = result.proteinG,
            fatG = result.fatG,
            sugarG = result.sugarG,
            sodiumMg = result.sodiumMg,
            ingredients = result.ingredients,
            originCountry = result.originCountry,
            itemReportNo = result.itemReportNo
        )
    }
}
