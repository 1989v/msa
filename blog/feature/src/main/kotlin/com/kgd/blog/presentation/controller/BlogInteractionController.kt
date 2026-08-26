package com.kgd.blog.presentation.controller

import com.kgd.blog.application.comment.dto.BlogCommentEditRequest
import com.kgd.blog.application.comment.dto.BlogCommentNode
import com.kgd.blog.application.comment.dto.BlogCommentRequest
import com.kgd.blog.application.comment.usecase.CreateBlogCommentUseCase
import com.kgd.blog.application.comment.usecase.DeleteBlogCommentUseCase
import com.kgd.blog.application.comment.usecase.EditBlogCommentUseCase
import com.kgd.blog.application.interaction.dto.BlogRatingRequest
import com.kgd.blog.application.interaction.dto.BlogReaction
import com.kgd.blog.application.interaction.usecase.ClearBlogRatingUseCase
import com.kgd.blog.application.interaction.usecase.RateBlogPostUseCase
import com.kgd.blog.application.interaction.usecase.ToggleBlogLikeUseCase
import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.common.response.ApiResponse
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 좋아요·평점·댓글 (ADR-0072 §5).
 *
 * 게이트웨이 인증 수준이 둘로 갈린다 — 좋아요·평점은 익명 통과(`optionalUser`) + Rate Limiter,
 * 댓글은 `ROLE_USER+` + Rate Limiter. 이 컨트롤러는 그 경계를 다시 판정하지 않고,
 * 대신 서비스가 프로필 상태(정지 등)를 본다.
 */
@RestController
@RequestMapping("/api/v1/blog")
class BlogInteractionController(
    private val toggleLike: ToggleBlogLikeUseCase,
    private val ratePost: RateBlogPostUseCase,
    private val clearRating: ClearBlogRatingUseCase,
    private val createComment: CreateBlogCommentUseCase,
    private val editComment: EditBlogCommentUseCase,
    private val deleteComment: DeleteBlogCommentUseCase,
) {

    @PostMapping("/posts/{slug}/like")
    fun toggleLike(
        @PathVariable slug: String,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
        @RequestHeader(value = "X-Visitor-Id", required = false) visitorId: String?,
    ): ApiResponse<BlogReaction> =
        ApiResponse.success(toggleLike.execute(ToggleBlogLikeUseCase.Command(slug, BlogIdentity.of(userId, roles, visitorId))))

    @PutMapping("/posts/{slug}/rating")
    fun rate(
        @PathVariable slug: String,
        @Valid @RequestBody request: BlogRatingRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
        @RequestHeader(value = "X-Visitor-Id", required = false) visitorId: String?,
    ): ApiResponse<BlogReaction> = ApiResponse.success(
        ratePost.execute(RateBlogPostUseCase.Command(slug, BlogIdentity.of(userId, roles, visitorId), request.score)),
    )

    @DeleteMapping("/posts/{slug}/rating")
    fun clearRating(
        @PathVariable slug: String,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
        @RequestHeader(value = "X-Visitor-Id", required = false) visitorId: String?,
    ): ApiResponse<BlogReaction> =
        ApiResponse.success(clearRating.execute(ClearBlogRatingUseCase.Command(slug, BlogIdentity.of(userId, roles, visitorId))))

    /**
     * 댓글 작성. 글 슬러그를 본문에 담는 이유는 게이트웨이 라우팅 때문이다 —
     * `/posts/{slug}/comments` 로 두면 같은 prefix 안에서 공개 GET 과 인증 POST 가 섞여
     * 인증 규칙을 메서드로 갈라야 한다. 경로로 가르는 편이 라우트 표를 읽을 수 있게 만든다.
     */
    @PostMapping("/comments")
    fun create(
        @Valid @RequestBody request: BlogCommentRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<List<BlogCommentNode>> =
        ApiResponse.success(createComment.execute(CreateBlogCommentUseCase.Command(request, BlogIdentity.of(userId, roles, null))))

    @PutMapping("/comments/{id}")
    fun edit(
        @PathVariable id: Long,
        @Valid @RequestBody request: BlogCommentEditRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<List<BlogCommentNode>> =
        ApiResponse.success(editComment.execute(EditBlogCommentUseCase.Command(id, request.body, BlogIdentity.of(userId, roles, null))))

    @DeleteMapping("/comments/{id}")
    fun delete(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<List<BlogCommentNode>> =
        ApiResponse.success(deleteComment.execute(DeleteBlogCommentUseCase.Command(id, BlogIdentity.of(userId, roles, null))))
}
