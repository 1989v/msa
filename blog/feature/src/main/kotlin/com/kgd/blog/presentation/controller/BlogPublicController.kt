package com.kgd.blog.presentation.controller

import com.kgd.blog.application.category.dto.BlogCategoryNode
import com.kgd.blog.application.category.usecase.GetBlogCategoryTreeUseCase
import com.kgd.blog.application.comment.dto.BlogCommentNode
import com.kgd.blog.application.comment.usecase.GetBlogCommentsUseCase
import com.kgd.blog.application.interaction.usecase.RecordBlogViewUseCase
import com.kgd.blog.application.post.dto.BlogAuthorSpace
import com.kgd.blog.application.post.dto.BlogPage
import com.kgd.blog.application.post.dto.BlogPostDetail
import com.kgd.blog.application.post.dto.BlogPostSummary
import com.kgd.blog.application.post.usecase.GetBlogAuthorSpaceUseCase
import com.kgd.blog.application.post.usecase.GetBlogPostUseCase
import com.kgd.blog.application.post.usecase.GetBlogPostsUseCase
import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.common.response.ApiResponse
import org.springframework.http.HttpHeaders
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 블로그 공개 조회 API (ADR-0072).
 *
 * 게이트웨이가 이 경로에는 인증 필터를 걸지 않는다. 로그인 사용자를 식별해야 하는 값
 * (내가 누른 좋아요/평점, 내 댓글 표시)은 게이트웨이가 채운 헤더가 있으면 쓰고 없으면 만다.
 */
@RestController
@RequestMapping("/api/v1/blog")
class BlogPublicController(
    private val getCategoryTree: GetBlogCategoryTreeUseCase,
    private val getPosts: GetBlogPostsUseCase,
    private val getPost: GetBlogPostUseCase,
    private val getComments: GetBlogCommentsUseCase,
    private val getAuthorSpace: GetBlogAuthorSpaceUseCase,
    private val recordView: RecordBlogViewUseCase,
) {

    @GetMapping("/categories")
    fun categories(): ApiResponse<List<BlogCategoryNode>> =
        ApiResponse.success(getCategoryTree.execute(GetBlogCategoryTreeUseCase.Query()))

    @GetMapping("/posts")
    fun posts(
        @RequestParam(required = false) categoryPath: String?,
        @RequestParam(required = false) handle: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "12") size: Int,
    ): ApiResponse<BlogPage<BlogPostSummary>> =
        ApiResponse.success(getPosts.execute(GetBlogPostsUseCase.Query(categoryPath, handle, page, size)))

    @GetMapping("/posts/{slug}")
    fun post(
        @PathVariable slug: String,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
        @RequestHeader(value = "X-Visitor-Id", required = false) visitorId: String?,
        @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) userAgent: String?,
    ): ApiResponse<BlogPostDetail> {
        val identity = BlogIdentity.of(userId, roles, visitorId)
        val detail = getPost.execute(GetBlogPostUseCase.Query(slug, identity))
        // 조회 집계는 응답을 만든 뒤에 — 실패해도 본문이 나가야 한다
        recordView.execute(RecordBlogViewUseCase.Command(detail.post.id, identity.visitorId, userAgent))
        return ApiResponse.success(detail)
    }

    @GetMapping("/posts/{slug}/comments")
    fun comments(
        @PathVariable slug: String,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<List<BlogCommentNode>> =
        ApiResponse.success(getComments.execute(GetBlogCommentsUseCase.Query(slug, BlogIdentity.of(userId, roles, null))))

    @GetMapping("/authors/{handle}")
    fun author(
        @PathVariable handle: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "12") size: Int,
    ): ApiResponse<BlogAuthorSpace> =
        ApiResponse.success(getAuthorSpace.execute(GetBlogAuthorSpaceUseCase.Query(handle, page, size)))
}
