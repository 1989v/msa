package com.kgd.product.presentation.product.dto

import com.kgd.product.application.product.usecase.GetAllProductsUseCase
import java.math.BigDecimal
import java.time.LocalDateTime

data class ProductListResponse(
    val products: List<ProductItem>,
    val totalElements: Long,
    val totalPages: Int
) {
    data class ProductItem(
        val id: Long,
        val name: String,
        val price: BigDecimal,
        val status: String,
        val stock: Int,
        val createdAt: LocalDateTime
    )

    companion object {
        fun from(result: GetAllProductsUseCase.Result) = ProductListResponse(
            products = result.products.map { p ->
                ProductItem(
                    id = p.id,
                    name = p.name,
                    price = p.price,
                    status = p.status,
                    stock = p.stock,
                    createdAt = p.createdAt
                )
            },
            totalElements = result.totalElements,
            totalPages = result.totalPages
        )
    }
}
