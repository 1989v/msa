package com.kgd.wishlist.application.wishlist.usecase

import com.kgd.wishlist.domain.model.WishlistTargetType

interface RemoveWishlistItemUseCase {
    fun execute(command: Command)

    data class Command(val memberId: Long, val targetType: WishlistTargetType, val targetKey: String)
}
