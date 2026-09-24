package com.kgd.product.application.product.usecase

import java.time.LocalDateTime

interface GetAllProductsUseCase {
    fun execute(query: Query): Result

    /** [sellerId] 가 있으면 그 판매자 상품만 — 판매자 포털의 내 상품 목록 */
    data class Query(val page: Int, val size: Int, val sellerId: Long? = null)

    data class Result(
        val products: List<ProductResult>,
        val totalElements: Long,
        val totalPages: Int
    ) {
        data class ProductResult(
            val id: Long,
            val name: String,
            val price: Long,
            val status: String,
            val stock: Int,
            val createdAt: LocalDateTime,
            val sellerId: Long,
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
        )
    }
}
