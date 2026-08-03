package com.kgd.wishlist.application.wishlist.usecase

interface CheckWishlistItemUseCase {
    fun execute(query: Query): Result

    data class Query(val memberId: Long, val productId: Long)

    data class Result(val exists: Boolean)
}
