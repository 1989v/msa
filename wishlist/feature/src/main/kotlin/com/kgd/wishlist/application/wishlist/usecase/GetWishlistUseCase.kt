package com.kgd.wishlist.application.wishlist.usecase

import java.time.LocalDateTime

interface GetWishlistUseCase {
    fun execute(query: Query): Result

    data class Query(val memberId: Long, val page: Int = 0, val size: Int = 20)

    data class Result(
        val items: List<Item>,
        val totalCount: Long
    ) {
        data class Item(
            val id: Long,
            val productId: Long,
            val createdAt: LocalDateTime
        )
    }
}
