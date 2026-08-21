package com.kgd.wishlist.application.wishlist.usecase

import com.kgd.wishlist.domain.model.WishlistTargetType
import java.time.LocalDateTime

interface AddWishlistItemUseCase {
    fun execute(command: Command): Result

    data class Command(val memberId: Long, val targetType: WishlistTargetType, val targetKey: String)

    data class Result(
        val id: Long,
        val targetType: WishlistTargetType,
        val targetKey: String,
        val createdAt: LocalDateTime,
    )
}
