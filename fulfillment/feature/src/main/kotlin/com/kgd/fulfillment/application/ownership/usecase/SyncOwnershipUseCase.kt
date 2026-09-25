package com.kgd.fulfillment.application.ownership.usecase

import java.time.Instant

/** `seller.seller.*` · `product.item.*` 이벤트를 소유 판정 읽기 모델에 반영한다. 옛 이벤트(occurredAt 이 더 이른)는 버린다 */
interface SyncOwnershipUseCase {
    fun syncSeller(command: Seller)
    fun syncProduct(command: Product)

    data class Seller(val sellerId: Long, val memberId: String, val status: String, val occurredAt: Instant)
    data class Product(val productId: Long, val sellerId: Long, val occurredAt: Instant)
}
