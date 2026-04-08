package com.kgd.wishlist.application.wishlist.usecase

interface AddWishlistItemUseCase {
    fun execute(command: Command): Result

    data class Command(val memberId: Long, val productId: Long)

    data class Result(val id: Long, val productId: Long)
}
