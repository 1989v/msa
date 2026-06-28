package com.kgd.search.application.product.usecase

import java.math.BigDecimal

interface SearchProductUseCase {
    fun execute(query: Query): Result

    data class Query(
        val keyword: String,
        val page: Int = 0,
        val size: Int = 20,
        /** 로그인 사용자 식별자 (gateway 가 JWT 에서 X-User-Id 로 주입). */
        val userId: String? = null,
        /** 비로그인 포함 익명 식별자 (gateway 가 X-Anonymous-Id 헤더/쿠키에서 해소). */
        val anonymousId: String? = null
    ) {
        /**
         * 온라인 A/B 버킷팅 키 — 로그인 시 userId, 아니면 anonymousId.
         * 둘 다 없으면 null = 실험 미참여 (기본 ranking). 비로그인도 anonymousId 로 실험 참여한다.
         */
        val assignmentKey: String?
            get() = userId?.takeIf { it.isNotBlank() } ?: anonymousId?.takeIf { it.isNotBlank() }
    }

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
