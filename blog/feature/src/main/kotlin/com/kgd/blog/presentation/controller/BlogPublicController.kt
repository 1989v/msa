package com.kgd.blog.presentation.controller

import com.kgd.blog.application.dto.BlogAuthorSpace
import com.kgd.blog.application.dto.BlogCategoryNode
import com.kgd.blog.application.dto.BlogCommentNode
import com.kgd.blog.application.dto.BlogIdentity
import com.kgd.blog.application.dto.BlogPage
import com.kgd.blog.application.dto.BlogPostDetail
import com.kgd.blog.application.dto.BlogPostSummary
import com.kgd.blog.application.service.BlogQueryService
import com.kgd.blog.application.service.BlogViewService
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
    private val queryService: BlogQueryService,
    private val viewService: BlogViewService,
) {

    @GetMapping("/categories")
    fun categories(): ApiResponse<List<BlogCategoryNode>> =
        ApiResponse.success(queryService.categoryTree())

    @GetMapping("/posts")
    fun posts(
        @RequestParam(required = false) categoryPath: String?,
        @RequestParam(required = false) handle: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "12") size: Int,
    ): ApiResponse<BlogPage<BlogPostSummary>> =
        ApiResponse.success(queryService.posts(categoryPath, handle, page, size))

    @GetMapping("/posts/{slug}")
    fun post(
        @PathVariable slug: String,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
        @RequestHeader(value = "X-Visitor-Id", required = false) visitorId: String?,
        @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) userAgent: String?,
    ): ApiResponse<BlogPostDetail> {
        val identity = BlogIdentity.of(userId, roles, visitorId)
        val detail = queryService.post(slug, identity)
        // 조회 집계는 응답을 만든 뒤에 — 실패해도 본문이 나가야 한다
        viewService.record(detail.post.id, identity.visitorId, userAgent)
        return ApiResponse.success(detail)
    }

    @GetMapping("/posts/{slug}/comments")
    fun comments(
        @PathVariable slug: String,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<List<BlogCommentNode>> =
        ApiResponse.success(queryService.comments(slug, BlogIdentity.of(userId, roles, null)))

    @GetMapping("/authors/{handle}")
    fun author(
        @PathVariable handle: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "12") size: Int,
    ): ApiResponse<BlogAuthorSpace> = ApiResponse.success(queryService.authorSpace(handle, page, size))
}
