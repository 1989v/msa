package com.kgd.product.application.product.usecase

/**
 * 판매자 포털의 내 상품 목록 — 요청자의 ACTIVE 판매자 행으로 판매자를 정한다(쿼리 파라미터를 믿지 않는다).
 * 공개 목록과 달리 판매 중지 상품도 포함하고, 최근 등록순(id 내림차순)이다.
 */
interface GetSellerProductsUseCase {
    fun execute(query: Query, requester: ProductRequester): GetAllProductsUseCase.Result

    data class Query(val page: Int, val size: Int)
}
