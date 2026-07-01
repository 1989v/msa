package com.kgd.wishlist.application.wishlist.usecase

interface ClearWishlistUseCase {
    fun execute(command: Command)

    data class Command(val memberId: Long)
}
