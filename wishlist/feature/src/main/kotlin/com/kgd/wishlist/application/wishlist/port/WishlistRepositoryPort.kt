package com.kgd.wishlist.application.wishlist.port

import com.kgd.wishlist.domain.model.WishlistItem
import com.kgd.wishlist.domain.model.WishlistTargetType

interface WishlistRepositoryPort {
    fun save(item: WishlistItem): WishlistItem
    fun findByMemberAndTarget(memberId: Long, targetType: WishlistTargetType, targetKey: String): WishlistItem?
    fun deleteByMemberAndTarget(memberId: Long, targetType: WishlistTargetType, targetKey: String)
    fun findByMember(memberId: Long, targetType: WishlistTargetType?, page: Int, size: Int): List<WishlistItem>
    fun countByMember(memberId: Long, targetType: WishlistTargetType?): Long
    fun findKeysByMemberAndType(memberId: Long, targetType: WishlistTargetType): List<String>
    fun deleteAllByMemberId(memberId: Long)
    fun deleteAllByTarget(targetType: WishlistTargetType, targetKey: String)
}
