package com.kgd.seller.application.seller.usecase

import com.kgd.seller.domain.seller.model.SellerStatus

/** 어드민 조회 — 신청 목록·상세 */
interface QuerySellersUseCase {
    fun list(query: Query): Page
    fun get(sellerId: Long): SellerView

    data class Query(val status: SellerStatus?, val page: Int, val size: Int)
    data class Page(val items: List<SellerView>, val totalElements: Long, val page: Int, val size: Int)
}
