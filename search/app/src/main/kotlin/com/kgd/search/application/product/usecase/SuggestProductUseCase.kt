package com.kgd.search.application.product.usecase

/**
 * 상품명 자동완성 — 검색창 입력 중 prefix 매칭 상위 상품명을 반환한다.
 */
interface SuggestProductUseCase {
    fun execute(prefix: String, size: Int): List<Suggestion>

    data class Suggestion(
        val id: String,
        val name: String,
    )
}
