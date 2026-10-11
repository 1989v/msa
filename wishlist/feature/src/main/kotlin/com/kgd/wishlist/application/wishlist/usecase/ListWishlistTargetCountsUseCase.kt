package com.kgd.wishlist.application.wishlist.usecase

import com.kgd.wishlist.domain.model.WishlistTargetCount
import com.kgd.wishlist.domain.model.WishlistTargetType

/**
 * 한 종류 대상 전체의 찜 수 — 클러스터 안 전용(재색인이 하루 한 번 부른다). [min] 명 이상인 대상만, 많은 순으로
 * 최대 [MAX_ITEMS] 건. [min] 은 1 아래로 내려가지 않는다.
 */
interface ListWishlistTargetCountsUseCase {
    fun execute(query: Query): List<WishlistTargetCount>

    data class Query(val targetType: WishlistTargetType, val min: Int)

    companion object {
        const val MAX_ITEMS = 10_000
    }
}
