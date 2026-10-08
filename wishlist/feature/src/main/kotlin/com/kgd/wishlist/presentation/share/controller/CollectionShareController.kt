package com.kgd.wishlist.presentation.share.controller

import com.kgd.common.response.ApiResponse
import com.kgd.wishlist.application.share.usecase.ManageCollectionShareUseCase
import com.kgd.wishlist.presentation.share.dto.CollectionShareResponse
import com.kgd.wishlist.presentation.share.dto.CollectionShareStateResponse
import com.kgd.wishlist.presentation.share.dto.CreateCollectionShareRequest
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 묶음 공유 링크 — 소유자 전용 (ADR-0107). 인증은 게이트웨이의 찜 라우트가 한다.
 *
 * 설정(`kgd.wishlist.share.enabled`)과 무관하게 항상 등록된다. 꺼짐 판정은 서비스 첫 줄의 404 다.
 */
@RestController
@RequestMapping("/api/v1/wishlist/collections/{collectionId}/share")
class CollectionShareController(
    private val manageCollectionShareUseCase: ManageCollectionShareUseCase,
) {
    @PostMapping
    fun create(
        @RequestHeader("X-User-Id") userId: String,
        @PathVariable collectionId: Long,
        @RequestBody(required = false) request: CreateCollectionShareRequest?,
    ): ApiResponse<CollectionShareResponse> {
        val expiresInDays = (request ?: CreateCollectionShareRequest()).expiresInDays
        val link = manageCollectionShareUseCase.create(userId.toLong(), collectionId, expiresInDays)
        return ApiResponse.success(CollectionShareResponse.from(link))
    }

    @GetMapping
    fun get(
        @RequestHeader("X-User-Id") userId: String,
        @PathVariable collectionId: Long,
    ): ApiResponse<CollectionShareStateResponse> {
        val link = manageCollectionShareUseCase.get(userId.toLong(), collectionId)
        return ApiResponse.success(CollectionShareStateResponse(link?.let(CollectionShareResponse::from)))
    }

    /** 멱등 — 살아 있는 링크가 없어도 200 */
    @DeleteMapping
    fun revoke(
        @RequestHeader("X-User-Id") userId: String,
        @PathVariable collectionId: Long,
    ): ApiResponse<Unit> {
        manageCollectionShareUseCase.revoke(userId.toLong(), collectionId)
        return ApiResponse.success(Unit)
    }
}
