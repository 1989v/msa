package com.kgd.wishlist.domain.model

import java.time.LocalDateTime

class WishlistItem private constructor(
    val id: Long? = null,
    val memberId: Long,
    val productId: Long,
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    companion object {
        fun create(memberId: Long, productId: Long): WishlistItem {
            require(memberId > 0) { "회원 ID는 0보다 커야 합니다" }
            require(productId > 0) { "상품 ID는 0보다 커야 합니다" }
            return WishlistItem(memberId = memberId, productId = productId)
        }

        fun restore(id: Long?, memberId: Long, productId: Long, createdAt: LocalDateTime): WishlistItem =
            WishlistItem(id = id, memberId = memberId, productId = productId, createdAt = createdAt)
    }
}
