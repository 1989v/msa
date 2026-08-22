package com.kgd.wishlist.presentation.wishlist.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import com.kgd.wishlist.application.wishlist.usecase.AddWishlistItemUseCase
import com.kgd.wishlist.application.wishlist.usecase.GetWishlistKeysUseCase
import com.kgd.wishlist.application.wishlist.usecase.GetWishlistUseCase
import com.kgd.wishlist.application.wishlist.usecase.ManageCollectionUseCase
import com.kgd.wishlist.application.wishlist.usecase.RemoveWishlistItemUseCase
import com.kgd.wishlist.domain.model.WishlistTargetType
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDateTime

/**
 * 찜하기 API (ADR-0074). 인증 경계는 게이트웨이 — 이 prefix 전체가 ROLE_USER 필터를
 * 거치므로 X-User-Id 는 신뢰한다. PUT/DELETE 는 멱등이다.
 */
@RestController
@RequestMapping("/api/v1/wishlist")
class WishlistController(
    private val addWishlistItemUseCase: AddWishlistItemUseCase,
    private val removeWishlistItemUseCase: RemoveWishlistItemUseCase,
    private val getWishlistUseCase: GetWishlistUseCase,
    private val getWishlistKeysUseCase: GetWishlistKeysUseCase,
    private val manageCollectionUseCase: ManageCollectionUseCase,
) {
    @PutMapping("/{targetType}/{targetKey}")
    fun addItem(
        @RequestHeader("X-User-Id") userId: String,
        @PathVariable targetType: String,
        @PathVariable targetKey: String
    ): ApiResponse<WishlistItemResponse> {
        val result = addWishlistItemUseCase.execute(
            AddWishlistItemUseCase.Command(
                memberId = userId.toLong(),
                targetType = parseTargetType(targetType),
                targetKey = targetKey
            )
        )
        return ApiResponse.success(
            WishlistItemResponse(
                id = result.id,
                targetType = result.targetType,
                targetKey = result.targetKey,
                collectionId = null,
                createdAt = result.createdAt
            )
        )
    }

    @DeleteMapping("/{targetType}/{targetKey}")
    fun removeItem(
        @RequestHeader("X-User-Id") userId: String,
        @PathVariable targetType: String,
        @PathVariable targetKey: String
    ): ApiResponse<Unit> {
        removeWishlistItemUseCase.execute(
            RemoveWishlistItemUseCase.Command(
                memberId = userId.toLong(),
                targetType = parseTargetType(targetType),
                targetKey = targetKey
            )
        )
        return ApiResponse.success(Unit)
    }

    @GetMapping
    fun getWishlist(
        @RequestHeader("X-User-Id") userId: String,
        @RequestParam(required = false) type: String?,
        @RequestParam(required = false) collectionId: Long?,
        @RequestParam(defaultValue = "false") unclassified: Boolean,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): ApiResponse<WishlistResponse> {
        val result = getWishlistUseCase.execute(
            GetWishlistUseCase.Query(
                memberId = userId.toLong(),
                targetType = type?.let { parseTargetType(it) },
                collectionId = collectionId,
                unclassifiedOnly = unclassified,
                page = page,
                size = size
            )
        )
        return ApiResponse.success(
            WishlistResponse(
                items = result.items.map {
                    WishlistItemResponse(
                        id = it.id,
                        targetType = it.targetType,
                        targetKey = it.targetKey,
                        collectionId = it.collectionId,
                        createdAt = it.createdAt
                    )
                },
                totalCount = result.totalCount
            )
        )
    }

    @GetMapping("/keys")
    fun getKeys(
        @RequestHeader("X-User-Id") userId: String,
        @RequestParam type: String
    ): ApiResponse<WishlistKeysResponse> {
        val result = getWishlistKeysUseCase.execute(
            GetWishlistKeysUseCase.Query(
                memberId = userId.toLong(),
                targetType = parseTargetType(type)
            )
        )
        return ApiResponse.success(WishlistKeysResponse(keys = result.keys))
    }

    // ── 묶음 (ADR-0080) ───────────────────────────────────────────────────

    @GetMapping("/collections")
    fun listCollections(@RequestHeader("X-User-Id") userId: String): ApiResponse<List<CollectionResponse>> =
        ApiResponse.success(manageCollectionUseCase.list(userId.toLong()).map { it.toResponse() })

    @PostMapping("/collections")
    fun createCollection(
        @RequestHeader("X-User-Id") userId: String,
        @RequestBody request: CollectionNameRequest,
    ): ApiResponse<CollectionResponse> =
        ApiResponse.success(manageCollectionUseCase.create(userId.toLong(), request.name).toResponse())

    @PatchMapping("/collections/{collectionId}")
    fun renameCollection(
        @RequestHeader("X-User-Id") userId: String,
        @PathVariable collectionId: Long,
        @RequestBody request: CollectionNameRequest,
    ): ApiResponse<CollectionResponse> =
        ApiResponse.success(
            manageCollectionUseCase.rename(userId.toLong(), collectionId, request.name).toResponse(),
        )

    /** 묶음만 지운다 — 소속 찜은 미분류로 남는다 (ADR-0080) */
    @DeleteMapping("/collections/{collectionId}")
    fun deleteCollection(
        @RequestHeader("X-User-Id") userId: String,
        @PathVariable collectionId: Long,
    ): ApiResponse<Unit> {
        manageCollectionUseCase.delete(userId.toLong(), collectionId)
        return ApiResponse.success(Unit)
    }

    /** 찜을 묶음으로 옮긴다. body 의 collectionId 가 null 이면 미분류로 뺀다 */
    @PatchMapping("/{targetType}/{targetKey}/collection")
    fun moveItem(
        @RequestHeader("X-User-Id") userId: String,
        @PathVariable targetType: String,
        @PathVariable targetKey: String,
        @RequestBody request: MoveItemRequest,
    ): ApiResponse<Unit> {
        manageCollectionUseCase.move(
            memberId = userId.toLong(),
            targetType = parseTargetType(targetType),
            targetKey = targetKey,
            collectionId = request.collectionId,
        )
        return ApiResponse.success(Unit)
    }

    private fun ManageCollectionUseCase.Collection.toResponse() =
        CollectionResponse(id = id, name = name, itemCount = itemCount, createdAt = createdAt)

    private fun parseTargetType(raw: String): WishlistTargetType =
        runCatching { WishlistTargetType.valueOf(raw.uppercase()) }
            .getOrElse { throw BusinessException(ErrorCode.INVALID_INPUT, "지원하지 않는 찜 대상입니다: $raw") }
}

data class WishlistItemResponse(
    val id: Long,
    val targetType: WishlistTargetType,
    val targetKey: String,
    /** 소속 묶음 — null 이면 미분류 */
    val collectionId: Long?,
    val createdAt: LocalDateTime
)

data class CollectionResponse(
    val id: Long,
    val name: String,
    val itemCount: Long,
    val createdAt: LocalDateTime,
)

data class CollectionNameRequest(val name: String)

data class MoveItemRequest(val collectionId: Long?)

data class WishlistResponse(
    val items: List<WishlistItemResponse>,
    val totalCount: Long
)

data class WishlistKeysResponse(val keys: List<String>)
