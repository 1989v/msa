package com.kgd.product.application.seller.port

import com.kgd.product.domain.seller.model.ProductSeller

interface ProductSellerRepositoryPort {
    fun findById(sellerId: Long): ProductSeller?

    /** 한 회원의 열린 판매자는 하나뿐이라(seller 의 1인 1판매자) ACTIVE 도 많아야 하나다 */
    fun findActiveByMemberId(memberId: String): ProductSeller?

    fun save(seller: ProductSeller): ProductSeller
}
