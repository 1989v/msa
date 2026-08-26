package com.kgd.blog.presentation.controller

import com.kgd.blog.application.category.dto.BlogCategoryNode
import com.kgd.blog.application.category.dto.BlogCategoryRequest
import com.kgd.blog.application.category.usecase.CreateBlogCategoryUseCase
import com.kgd.blog.application.category.usecase.DeleteBlogCategoryUseCase
import com.kgd.blog.application.category.usecase.GetBlogCategoryTreeUseCase
import com.kgd.blog.application.category.usecase.UpdateBlogCategoryUseCase
import com.kgd.blog.application.comment.dto.BlogCommentAdminResponse
import com.kgd.blog.application.comment.dto.BlogCommentStatusRequest
import com.kgd.blog.application.comment.usecase.ChangeBlogCommentStatusUseCase
import com.kgd.blog.application.comment.usecase.ListBlogCommentsAdminUseCase
import com.kgd.blog.application.post.dto.BlogPage
import com.kgd.blog.application.post.dto.BlogPostDetail
import com.kgd.blog.application.post.dto.BlogPostRequest
import com.kgd.blog.application.post.dto.BlogPostSummary
import com.kgd.blog.application.post.dto.BlogViewDaily
import com.kgd.blog.application.post.usecase.ChangeBlogPostStatusUseCase
import com.kgd.blog.application.post.usecase.CreateBlogPostUseCase
import com.kgd.blog.application.post.usecase.DeleteBlogPostUseCase
import com.kgd.blog.application.post.usecase.GetBlogViewsDailyUseCase
import com.kgd.blog.application.post.usecase.GetMyBlogPostUseCase
import com.kgd.blog.application.post.usecase.ListBlogPostsAdminUseCase
import com.kgd.blog.application.post.usecase.UpdateBlogPostUseCase
import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.application.profile.dto.BlogProfileAdminResponse
import com.kgd.blog.application.profile.dto.BlogProfileStatusRequest
import com.kgd.blog.application.profile.usecase.ChangeBlogProfileStatusUseCase
import com.kgd.blog.application.profile.usecase.ListBlogProfilesAdminUseCase
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
 * 글 쓰기는 스튜디오와 **같은 UseCase** 를 부른다 — 규칙이 갈리지 않게.
 */
@RestController
@RequestMapping("/api/v1/admin/blog")
class BlogAdminController(
    private val getCategoryTree: GetBlogCategoryTreeUseCase,
    private val createCategory: CreateBlogCategoryUseCase,
    private val updateCategory: UpdateBlogCategoryUseCase,
    private val deleteCategory: DeleteBlogCategoryUseCase,
    private val listProfiles: ListBlogProfilesAdminUseCase,
    private val changeProfileStatus: ChangeBlogProfileStatusUseCase,
    private val listPosts: ListBlogPostsAdminUseCase,
    private val getMyPost: GetMyBlogPostUseCase,
    private val createPost: CreateBlogPostUseCase,
    private val updatePost: UpdateBlogPostUseCase,
    private val changePostStatus: ChangeBlogPostStatusUseCase,
    private val deletePost: DeleteBlogPostUseCase,
    private val getViewsDaily: GetBlogViewsDailyUseCase,
    private val listComments: ListBlogCommentsAdminUseCase,
    private val changeCommentStatus: ChangeBlogCommentStatusUseCase,
) {

    // ─── 카테고리 ───────────────────────────────────────────────────────────

    @GetMapping("/categories")
    fun categories(): ApiResponse<List<BlogCategoryNode>> =
        ApiResponse.success(getCategoryTree.execute(GetBlogCategoryTreeUseCase.Query(includeHidden = true)))

    @PostMapping("/categories")
    fun createCategory(@Valid @RequestBody request: BlogCategoryRequest): ApiResponse<BlogCategoryNode> =
        ApiResponse.success(createCategory.execute(request))

    @PutMapping("/categories/{id}")
    fun updateCategory(
        @PathVariable id: Long,
        @Valid @RequestBody request: BlogCategoryRequest,
    ): ApiResponse<BlogCategoryNode> = ApiResponse.success(updateCategory.execute(UpdateBlogCategoryUseCase.Command(id, request)))

    @DeleteMapping("/categories/{id}")
    fun deleteCategory(@PathVariable id: Long): ApiResponse<Unit> {
        deleteCategory.execute(DeleteBlogCategoryUseCase.Command(id))
        return ApiResponse.success(Unit)
    }

    // ─── 저자 ──────────────────────────────────────────────────────────────

    @GetMapping("/profiles")
    fun profiles(
        @RequestParam(required = false) role: ProfileRole?,
        @RequestParam(required = false) status: ProfileStatus?,
    ): ApiResponse<List<BlogProfileAdminResponse>> =
        ApiResponse.success(listProfiles.execute(ListBlogProfilesAdminUseCase.Query(role, status)))

    @PutMapping("/profiles/{id}/status")
    fun changeProfileStatus(
        @PathVariable id: Long,
        @RequestBody request: BlogProfileStatusRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogProfileAdminResponse> = ApiResponse.success(
        changeProfileStatus.execute(ChangeBlogProfileStatusUseCase.Command(id, request.status, BlogIdentity.of(userId, roles, null))),
    )

    // ─── 글 ────────────────────────────────────────────────────────────────

    @GetMapping("/posts")
    fun posts(
        @RequestParam(required = false) status: PostStatus?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): ApiResponse<BlogPage<BlogPostSummary>> =
        ApiResponse.success(listPosts.execute(ListBlogPostsAdminUseCase.Query(status, page, size)))

    @GetMapping("/posts/{id}")
    fun post(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogPostDetail> =
        ApiResponse.success(getMyPost.execute(GetMyBlogPostUseCase.Query(id, BlogIdentity.of(userId, roles, null))))

    @PostMapping("/posts")
    fun create(
        @Valid @RequestBody request: BlogPostRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogPostSummary> =
        ApiResponse.success(createPost.execute(CreateBlogPostUseCase.Command(request, BlogIdentity.of(userId, roles, null))))

    @PutMapping("/posts/{id}")
    fun update(
        @PathVariable id: Long,
        @Valid @RequestBody request: BlogPostRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogPostSummary> =
        ApiResponse.success(updatePost.execute(UpdateBlogPostUseCase.Command(id, request, BlogIdentity.of(userId, roles, null))))

    @PutMapping("/posts/{id}/status")
    fun changeStatus(
        @PathVariable id: Long,
        @RequestParam status: PostStatus,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogPostSummary> =
        ApiResponse.success(changePostStatus.execute(ChangeBlogPostStatusUseCase.Command(id, status, BlogIdentity.of(userId, roles, null))))

    @DeleteMapping("/posts/{id}")
    fun delete(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<Unit> {
        deletePost.execute(DeleteBlogPostUseCase.Command(id, BlogIdentity.of(userId, roles, null)))
        return ApiResponse.success(Unit)
    }

    /** 일별 조회 추이 — 원장이 있어 공짜로 나오는 값이다 */
    @GetMapping("/posts/{id}/views")
    fun views(
        @PathVariable id: Long,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate,
    ): ApiResponse<List<BlogViewDaily>> =
        ApiResponse.success(getViewsDaily.execute(GetBlogViewsDailyUseCase.Query(id, from, to)))

    // ─── 댓글 ──────────────────────────────────────────────────────────────

    @GetMapping("/comments")
    fun comments(
        @RequestParam(required = false) status: CommentStatus?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): ApiResponse<BlogPage<BlogCommentAdminResponse>> =
        ApiResponse.success(listComments.execute(ListBlogCommentsAdminUseCase.Query(status, page, size)))

    @PutMapping("/comments/{id}/status")
    fun changeCommentStatus(
        @PathVariable id: Long,
        @RequestBody request: BlogCommentStatusRequest,
    ): ApiResponse<Unit> {
        changeCommentStatus.execute(ChangeBlogCommentStatusUseCase.Command(id, request.status))
        return ApiResponse.success(Unit)
    }
}
