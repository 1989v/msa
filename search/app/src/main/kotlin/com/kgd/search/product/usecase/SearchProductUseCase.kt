package com.kgd.search.application.product.usecase

import java.math.BigDecimal

interface SearchProductUseCase {
    fun execute(query: Query): Result

    data class Query(
        val keyword: String,
        val page: Int = 0,
        val size: Int = 20,
        /** 온라인 A/B variant 할당용. null 이면 실험 미참여 (기본 ranking). */
        val userId: String? = null
    )

    data class ProductSearchResult(
        val id: String,
        val name: String,
        val price: BigDecimal,
        val status: String,
        val categoryId: String? = null,
        val position: Int = 0
    )

    /**
     * `searchId` 는 후속 impression/click 이벤트가 같은 검색 세션을 가리키기 위한 UUID.
     * ADR-0043 의 Kafka 페이로드 멱등성 키로 사용된다.
     */
    data class Result(
        val searchId: String,
        val products: List<ProductSearchResult>,
        val totalElements: Long,
        val totalPages: Int,
        val currentPage: Int,
        /** 적용된 온라인 A/B variant (실험 미참여 시 null) — 분석 차원 태깅용. */
        val variant: String? = null
    )
}
