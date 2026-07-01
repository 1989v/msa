package com.kgd.wishlist.application.wishlist.usecase

interface RemoveWishlistItemUseCase {
    fun execute(command: Command)

    data class Command(val memberId: Long, val productId: Long)
}
