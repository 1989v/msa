package com.kgd.wishlist.application.wishlist.usecase

import com.kgd.wishlist.domain.model.WishlistTargetType
import java.time.LocalDateTime

interface GetWishlistUseCase {
    fun execute(query: Query): Result

    data class Query(
        val memberId: Long,
        val targetType: WishlistTargetType? = null,
        /** 지정하면 그 묶음만. null 은 **전체**이지 미분류가 아니다 (ADR-0080) */
        val collectionId: Long? = null,
        /** 미분류만 — collectionId 와 겸하지 않는다 */
        val unclassifiedOnly: Boolean = false,
        val page: Int = 0,
        val size: Int = 20,
    )

    data class Result(
        val items: List<Item>,
        val totalCount: Long
    ) {
        data class Item(
            val id: Long,
            val targetType: WishlistTargetType,
            val targetKey: String,
            /** 소속 묶음 — null 이면 미분류 */
            val collectionId: Long?,
            val createdAt: LocalDateTime
        )
    }
}
