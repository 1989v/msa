package com.kgd.wishlist.application.share.dto

import com.kgd.wishlist.domain.model.WishlistTargetType

/**
 * 토큰으로 연 묶음. 시각·소유자 식별 정보는 싣지 않는다 (ADR-0107 §2).
 * [truncated] 는 항목이 상한을 넘어 잘렸는지다.
 */
data class SharedCollection(
    val name: String,
    val items: List<Item>,
    val truncated: Boolean,
) {
    data class Item(
        val targetType: WishlistTargetType,
        val targetKey: String,
    )
}
