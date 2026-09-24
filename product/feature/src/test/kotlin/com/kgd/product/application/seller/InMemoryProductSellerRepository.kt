package com.kgd.product.application.seller

import com.kgd.product.application.seller.port.ProductSellerRepositoryPort
import com.kgd.product.domain.seller.model.ProductSeller

/** 판매자 읽기 모델 대역 — 판정 로직은 실제 서비스·권한 판정기가 한다 */
class InMemoryProductSellerRepository : ProductSellerRepositoryPort {
    private val rows = linkedMapOf<Long, ProductSeller>()

    override fun findById(sellerId: Long): ProductSeller? = rows[sellerId]

    override fun findActiveByMemberId(memberId: String): ProductSeller? =
        rows.values.firstOrNull { it.memberId == memberId && it.isActive }

    override fun save(seller: ProductSeller): ProductSeller = seller.also { rows[it.sellerId] = it }

    fun clear() = rows.clear()
}
