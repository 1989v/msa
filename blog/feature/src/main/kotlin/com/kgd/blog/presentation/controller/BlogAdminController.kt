package com.kgd.blog.presentation.controller

import com.kgd.blog.application.dto.BlogCategoryNode
import com.kgd.blog.application.dto.BlogCategoryRequest
import com.kgd.blog.application.dto.BlogCommentAdminResponse
import com.kgd.blog.application.dto.BlogCommentStatusRequest
import com.kgd.blog.application.dto.BlogIdentity
import com.kgd.blog.application.dto.BlogPage
import com.kgd.blog.application.dto.BlogPostDetail
import com.kgd.blog.application.dto.BlogPostRequest
import com.kgd.blog.application.dto.BlogPostSummary
import com.kgd.blog.application.dto.BlogProfileAdminResponse
import com.kgd.blog.application.dto.BlogProfileStatusRequest
import com.kgd.blog.application.dto.BlogViewDaily
import com.kgd.blog.application.service.BlogAdminService
import com.kgd.blog.application.service.BlogCommentService
import com.kgd.blog.application.service.BlogPostWriteService
import com.kgd.blog.application.service.BlogStudioService
import com.kgd.blog.domain.model.CommentStatus
import com.kgd.blog.domain.model.PostStatus
import com.kgd.blog.domain.model.ProfileRole
import com.kgd.blog.domain.model.ProfileStatus
import com.kgd.common.response.ApiResponse
import jakarta.validation.Valid
import org.springframework.format.annotation.DateTimeFormat
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
import java.time.LocalDate

/**
 * 블로그 백오피스 API (ADR-0072).
 *
 * 인증은 게이트웨이의 admin 경로 ROLE_ADMIN 필터가 담당한다.
 * 글 쓰기는 스튜디오와 **같은 서비스**를 부른다 — 규칙이 갈리지 않게.
 */
@RestController
@RequestMapping("/api/v1/admin/blog")
class BlogAdminController(
    private val adminService: BlogAdminService,
    private val writeService: BlogPostWriteService,
    private val studioService: BlogStudioService,
    private val commentService: BlogCommentService,
) {

    // ─── 카테고리 ───────────────────────────────────────────────────────────

    @GetMapping("/categories")
    fun categories(): ApiResponse<List<BlogCategoryNode>> = ApiResponse.success(adminService.categories())

    @PostMapping("/categories")
    fun createCategory(@Valid @RequestBody request: BlogCategoryRequest): ApiResponse<BlogCategoryNode> =
        ApiResponse.success(adminService.createCategory(request))

    @PutMapping("/categories/{id}")
    fun updateCategory(
        @PathVariable id: Long,
        @Valid @RequestBody request: BlogCategoryRequest,
    ): ApiResponse<BlogCategoryNode> = ApiResponse.success(adminService.updateCategory(id, request))

    @DeleteMapping("/categories/{id}")
    fun deleteCategory(@PathVariable id: Long): ApiResponse<Unit> {
        adminService.deleteCategory(id)
        return ApiResponse.success(Unit)
    }

    // ─── 저자 ──────────────────────────────────────────────────────────────

    @GetMapping("/profiles")
    fun profiles(
        @RequestParam(required = false) role: ProfileRole?,
        @RequestParam(required = false) status: ProfileStatus?,
    ): ApiResponse<List<BlogProfileAdminResponse>> = ApiResponse.success(adminService.profiles(role, status))

    @PutMapping("/profiles/{id}/status")
    fun changeProfileStatus(
        @PathVariable id: Long,
        @RequestBody request: BlogProfileStatusRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogProfileAdminResponse> = ApiResponse.success(
        adminService.changeProfileStatus(id, request.status, BlogIdentity.of(userId, roles, null)),
    )

    // ─── 글 ────────────────────────────────────────────────────────────────

    @GetMapping("/posts")
    fun posts(
        @RequestParam(required = false) status: PostStatus?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): ApiResponse<BlogPage<BlogPostSummary>> = ApiResponse.success(adminService.posts(status, page, size))

    @GetMapping("/posts/{id}")
    fun post(
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

    @PutMapping("/posts/{id}/status")
    fun changeStatus(
        @PathVariable id: Long,
        @RequestParam status: PostStatus,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogPostSummary> =
        ApiResponse.success(writeService.changeStatus(id, status, BlogIdentity.of(userId, roles, null)))

    @DeleteMapping("/posts/{id}")
    fun delete(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<Unit> {
        writeService.delete(id, BlogIdentity.of(userId, roles, null))
        return ApiResponse.success(Unit)
    }

    /** 일별 조회 추이 — 원장이 있어 공짜로 나오는 값이다 */
    @GetMapping("/posts/{id}/views")
    fun views(
        @PathVariable id: Long,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate,
    ): ApiResponse<List<BlogViewDaily>> = ApiResponse.success(adminService.viewsDaily(id, from, to))

    // ─── 댓글 ──────────────────────────────────────────────────────────────

    @GetMapping("/comments")
    fun comments(
        @RequestParam(required = false) status: CommentStatus?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): ApiResponse<BlogPage<BlogCommentAdminResponse>> =
        ApiResponse.success(adminService.comments(status, page, size))

    @PutMapping("/comments/{id}/status")
    fun changeCommentStatus(
        @PathVariable id: Long,
        @RequestBody request: BlogCommentStatusRequest,
    ): ApiResponse<Unit> {
        commentService.changeStatus(id, request.status)
        return ApiResponse.success(Unit)
    }
}
