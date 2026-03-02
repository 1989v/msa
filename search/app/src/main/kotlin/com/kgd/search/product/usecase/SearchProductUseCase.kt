package com.kgd.search.application.product.usecase

import java.math.BigDecimal

interface SearchProductUseCase {
    fun execute(query: Query): Result

    data class Query(
        val keyword: String,
        val page: Int = 0,
        val size: Int = 20
    )

    data class ProductSearchResult(
        val id: String,
        val name: String,
        val price: BigDecimal,
        val status: String
    )

    data class Result(
        val products: List<ProductSearchResult>,
        val totalElements: Long,
        val totalPages: Int,
        val currentPage: Int
    )
}
