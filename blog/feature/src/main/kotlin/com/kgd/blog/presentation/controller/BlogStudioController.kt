package com.kgd.blog.presentation.controller

import com.kgd.blog.application.post.dto.BlogPage
import com.kgd.blog.application.post.dto.BlogPostDetail
import com.kgd.blog.application.post.dto.BlogPostRequest
import com.kgd.blog.application.post.dto.BlogPostSummary
import com.kgd.blog.application.post.dto.BlogStudioOverview
import com.kgd.blog.application.post.usecase.ChangeBlogPostStatusUseCase
import com.kgd.blog.application.post.usecase.CreateBlogPostUseCase
import com.kgd.blog.application.post.usecase.DeleteBlogPostUseCase
import com.kgd.blog.application.post.usecase.GetBlogStudioOverviewUseCase
import com.kgd.blog.application.post.usecase.GetMyBlogPostUseCase
import com.kgd.blog.application.post.usecase.ListMyBlogPostsUseCase
import com.kgd.blog.application.post.usecase.UpdateBlogPostUseCase
import com.kgd.blog.application.profile.dto.BlogAuthorApplicationRequest
import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.application.profile.dto.BlogProfileAdminResponse
import com.kgd.blog.application.profile.dto.BlogProfileRequest
import com.kgd.blog.application.profile.usecase.ApplyAsBlogAuthorUseCase
import com.kgd.blog.application.profile.usecase.UpdateBlogProfileUseCase
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
    private val getOverview: GetBlogStudioOverviewUseCase,
    private val updateProfile: UpdateBlogProfileUseCase,
    private val applyAsAuthor: ApplyAsBlogAuthorUseCase,
    private val listMyPosts: ListMyBlogPostsUseCase,
    private val getMyPost: GetMyBlogPostUseCase,
    private val createPost: CreateBlogPostUseCase,
    private val updatePost: UpdateBlogPostUseCase,
    private val changePostStatus: ChangeBlogPostStatusUseCase,
    private val deletePost: DeleteBlogPostUseCase,
) {

    @GetMapping("/overview")
    fun overview(
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogStudioOverview> = ApiResponse.success(getOverview.execute(BlogIdentity.of(userId, roles, null)))

    @PutMapping("/profile")
    fun updateProfile(
        @Valid @RequestBody request: BlogProfileRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogProfileAdminResponse> =
        ApiResponse.success(updateProfile.execute(UpdateBlogProfileUseCase.Command(BlogIdentity.of(userId, roles, null), request)))

    @PostMapping("/author-application")
    fun applyAsAuthor(
        @Valid @RequestBody request: BlogAuthorApplicationRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogProfileAdminResponse> =
        ApiResponse.success(applyAsAuthor.execute(ApplyAsBlogAuthorUseCase.Command(BlogIdentity.of(userId, roles, null), request)))

    @GetMapping("/posts")
    fun myPosts(
        @RequestParam(required = false) status: PostStatus?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogPage<BlogPostSummary>> =
        ApiResponse.success(listMyPosts.execute(ListMyBlogPostsUseCase.Query(BlogIdentity.of(userId, roles, null), status, page, size)))

    @GetMapping("/posts/{id}")
    fun myPost(
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

    @PostMapping("/posts/{id}/publish")
    fun publish(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogPostSummary> = ApiResponse.success(
        changePostStatus.execute(ChangeBlogPostStatusUseCase.Command(id, PostStatus.PUBLISHED, BlogIdentity.of(userId, roles, null))),
    )

    /** 내리기 — 초안으로 되돌리지 않고 보관으로 간다. 공유된 주소가 죽지 않게 */
    @PostMapping("/posts/{id}/archive")
    fun archive(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BlogPostSummary> = ApiResponse.success(
        changePostStatus.execute(ChangeBlogPostStatusUseCase.Command(id, PostStatus.ARCHIVED, BlogIdentity.of(userId, roles, null))),
    )

    @DeleteMapping("/posts/{id}")
    fun delete(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<Unit> {
        deletePost.execute(DeleteBlogPostUseCase.Command(id, BlogIdentity.of(userId, roles, null)))
        return ApiResponse.success(Unit)
    }
}
