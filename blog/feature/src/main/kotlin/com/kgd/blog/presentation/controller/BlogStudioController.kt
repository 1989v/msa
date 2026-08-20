package com.kgd.blog.presentation.controller

import com.kgd.blog.application.dto.BlogAuthorApplicationRequest
import com.kgd.blog.application.dto.BlogIdentity
import com.kgd.blog.application.dto.BlogPage
import com.kgd.blog.application.dto.BlogPostDetail
import com.kgd.blog.application.dto.BlogPostRequest
import com.kgd.blog.application.dto.BlogPostSummary
import com.kgd.blog.application.dto.BlogProfileAdminResponse
import com.kgd.blog.application.dto.BlogProfileRequest
import com.kgd.blog.application.dto.BlogStudioOverview
import com.kgd.blog.application.service.BlogPostWriteService
import com.kgd.blog.application.service.BlogProfileService
import com.kgd.blog.application.service.BlogStudioService
import com.kgd.blog.domain.model.PostStatus
import com.kgd.common.response.ApiResponse
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 작성자 스튜디오 API (ADR-0072 §7).
 *
 * 게이트웨이가 `ROLE_USER+` 로 좁힌 경로다. "저자인가"·"내 글인가"는 서비스가 판정한다 —
 * 소유권은 엣지가 알 수 없는 정보다.
 */
@RestController
@RequestMapping("/api/v1/blog/me")
class BlogStudioController(
    private val studioService: BlogStudioService,
    private val writeService: BlogPostWriteService,
    private val profileService: BlogProfileService,
) {

    @GetMapping("/overview")
    fun overview(
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogStudioOverview> =
        ApiResponse.success(studioService.overview(BlogIdentity.of(userId, roles, null)))

    @PutMapping("/profile")
    fun updateProfile(
        @Valid @RequestBody request: BlogProfileRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogProfileAdminResponse> =
        ApiResponse.success(profileService.updateProfile(BlogIdentity.of(userId, roles, null), request))

    @PostMapping("/author-application")
    fun applyAsAuthor(
        @Valid @RequestBody request: BlogAuthorApplicationRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogProfileAdminResponse> =
        ApiResponse.success(profileService.applyAsAuthor(BlogIdentity.of(userId, roles, null), request))

    @GetMapping("/posts")
    fun myPosts(
        @RequestParam(required = false) status: PostStatus?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogPage<BlogPostSummary>> =
        ApiResponse.success(studioService.myPosts(BlogIdentity.of(userId, roles, null), status, page, size))

    @GetMapping("/posts/{id}")
    fun myPost(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogPostDetail> =
        ApiResponse.success(studioService.myPost(id, BlogIdentity.of(userId, roles, null)))

    @PostMapping("/posts")
    fun create(
        @Valid @RequestBody request: BlogPostRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogPostSummary> =
        ApiResponse.success(writeService.create(request, BlogIdentity.of(userId, roles, null)))

    @PutMapping("/posts/{id}")
    fun update(
        @PathVariable id: Long,
        @Valid @RequestBody request: BlogPostRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogPostSummary> =
        ApiResponse.success(writeService.update(id, request, BlogIdentity.of(userId, roles, null)))

    @PostMapping("/posts/{id}/publish")
    fun publish(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogPostSummary> =
        ApiResponse.success(writeService.changeStatus(id, PostStatus.PUBLISHED, BlogIdentity.of(userId, roles, null)))

    /** 내리기 — 초안으로 되돌리지 않고 보관으로 간다. 공유된 주소가 죽지 않게 */
    @PostMapping("/posts/{id}/archive")
    fun archive(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogPostSummary> =
        ApiResponse.success(writeService.changeStatus(id, PostStatus.ARCHIVED, BlogIdentity.of(userId, roles, null)))

    @DeleteMapping("/posts/{id}")
    fun delete(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<Unit> {
        writeService.delete(id, BlogIdentity.of(userId, roles, null))
        return ApiResponse.success(Unit)
    }
}
