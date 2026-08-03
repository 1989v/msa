package com.kgd.wishlist.presentation.wishlist.controller

import com.kgd.common.response.ApiResponse
import com.kgd.wishlist.application.wishlist.usecase.*
import org.springframework.web.bind.annotation.*
import java.time.LocalDateTime

@RestController
@RequestMapping("/api/wishlist")
class WishlistController(
    private val addWishlistItemUseCase: AddWishlistItemUseCase,
    private val removeWishlistItemUseCase: RemoveWishlistItemUseCase,
    private val getWishlistUseCase: GetWishlistUseCase,
    private val checkWishlistItemUseCase: CheckWishlistItemUseCase,
    private val clearWishlistUseCase: ClearWishlistUseCase
) {
    @PostMapping("/{productId}")
    fun addItem(
        @RequestHeader("X-User-Id") userId: String,
        @PathVariable productId: Long
    ): ApiResponse<AddItemResponse> {
        val result = addWishlistItemUseCase.execute(
            AddWishlistItemUseCase.Command(
                memberId = userId.toLong(),
                productId = productId
            )
        )
        return ApiResponse.success(
            AddItemResponse(id = result.id, productId = result.productId)
        )
    }

    @DeleteMapping("/{productId}")
    fun removeItem(
        @RequestHeader("X-User-Id") userId: String,
        @PathVariable productId: Long
    ): ApiResponse<Unit> {
        removeWishlistItemUseCase.execute(
            RemoveWishlistItemUseCase.Command(
                memberId = userId.toLong(),
                productId = productId
            )
        )
        return ApiResponse.success(Unit)
    }

    @GetMapping
    fun getWishlist(
        @RequestHeader("X-User-Id") userId: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): ApiResponse<WishlistResponse> {
        val result = getWishlistUseCase.execute(
            GetWishlistUseCase.Query(
                memberId = userId.toLong(),
                page = page,
                size = size
            )
        )
        return ApiResponse.success(
            WishlistResponse(
                items = result.items.map {
                    WishlistItemResponse(
                        id = it.id,
                        productId = it.productId,
                        createdAt = it.createdAt
                    )
                },
                totalCount = result.totalCount
            )
        )
    }

    @GetMapping("/{productId}/exists")
    fun checkExists(
        @RequestHeader("X-User-Id") userId: String,
        @PathVariable productId: Long
    ): ApiResponse<CheckExistsResponse> {
        val result = checkWishlistItemUseCase.execute(
            CheckWishlistItemUseCase.Query(
                memberId = userId.toLong(),
                productId = productId
            )
        )
        return ApiResponse.success(CheckExistsResponse(exists = result.exists))
    }

    @DeleteMapping
    fun clearAll(
        @RequestHeader("X-User-Id") userId: String
    ): ApiResponse<Unit> {
        clearWishlistUseCase.execute(
            ClearWishlistUseCase.Command(memberId = userId.toLong())
        )
        return ApiResponse.success(Unit)
    }
}

data class AddItemResponse(val id: Long, val productId: Long)

data class WishlistResponse(
    val items: List<WishlistItemResponse>,
    val totalCount: Long
)

data class WishlistItemResponse(
    val id: Long,
    val productId: Long,
    val createdAt: LocalDateTime
)

data class CheckExistsResponse(val exists: Boolean)
