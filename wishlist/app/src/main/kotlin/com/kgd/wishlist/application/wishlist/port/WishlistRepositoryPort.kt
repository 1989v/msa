package com.kgd.wishlist.application.wishlist.port

import com.kgd.wishlist.domain.model.WishlistItem

interface WishlistRepositoryPort {
    fun save(item: WishlistItem): WishlistItem
    fun deleteByMemberIdAndProductId(memberId: Long, productId: Long)
    fun findByMemberId(memberId: Long, page: Int, size: Int): List<WishlistItem>
    fun countByMemberId(memberId: Long): Long
    fun existsByMemberIdAndProductId(memberId: Long, productId: Long): Boolean
    fun deleteAllByMemberId(memberId: Long)
    fun deleteAllByProductId(productId: Long)
}
