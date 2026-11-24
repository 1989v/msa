package com.kgd.blog.presentation.controller

import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.application.prompt.dto.*
import com.kgd.blog.application.prompt.usecase.PeerPromptUseCase
import com.kgd.common.response.ApiResponse
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpHeaders
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/blog")
class PeerPromptController(private val prompts: PeerPromptUseCase) {
    @GetMapping("/peer-prompts")
    fun list(
        @RequestParam(required = false) domain: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
        response: HttpServletResponse,
    ): ApiResponse<PeerPromptPage> {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "private, no-store")
        return ApiResponse.success(prompts.list(domain, page, BlogIdentity.of(userId, roles, null)))
    }

    @GetMapping("/peer-prompts/{id}")
    fun detail(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
        response: HttpServletResponse,
    ): ApiResponse<PeerPromptDetail> {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "private, no-store")
        return ApiResponse.success(prompts.detail(id, BlogIdentity.of(userId, roles, null)))
    }

    @PostMapping("/me/peer-prompts")
    fun create(
        @RequestBody request: PeerPromptRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<PeerPromptDetail> = ApiResponse.success(prompts.create(request, BlogIdentity.of(userId, roles, null)))

    @PutMapping("/me/peer-prompts/{id}/review")
    fun review(
        @PathVariable id: Long,
        @RequestBody request: PeerReviewRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<PeerPromptDetail> = ApiResponse.success(prompts.review(id, request, BlogIdentity.of(userId, roles, null)))

    @DeleteMapping("/me/peer-prompts/{id}")
    fun remove(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<Unit> {
        prompts.remove(id, BlogIdentity.of(userId, roles, null))
        return ApiResponse.success(Unit)
    }

    @DeleteMapping("/me/peer-prompts/{id}/reviews/{reviewId}")
    fun removeReview(
        @PathVariable id: Long,
        @PathVariable reviewId: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<Unit> {
        prompts.removeReview(id, reviewId, BlogIdentity.of(userId, roles, null))
        return ApiResponse.success(Unit)
    }
}
