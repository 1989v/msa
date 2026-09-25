package com.kgd.fulfillment.application.ownership.port

import com.kgd.fulfillment.domain.ownership.model.OwnerSeller
import com.kgd.fulfillment.domain.ownership.model.ProductOwner

/** 소유 판정 읽기 모델 — `product_owner`(상품 → 판매자) · `owner_seller`(판매자 ↔ 회원·상태) */
interface OwnershipRepositoryPort {
    fun findSeller(sellerId: Long): OwnerSeller?

    /** 한 회원의 열린 판매자는 하나뿐이라(seller 의 1인 1판매자) ACTIVE 도 많아야 하나다 */
    fun findActiveSellerByMemberId(memberId: String): OwnerSeller?

    fun saveSeller(seller: OwnerSeller)

    fun findProductOwner(productId: Long): ProductOwner?

    fun findProductOwners(productIds: Collection<Long>): List<ProductOwner>

    fun saveProductOwner(owner: ProductOwner)
}
