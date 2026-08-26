package com.kgd.blog.application.comment.dto

import com.kgd.blog.application.profile.dto.BlogAuthorSummary
import com.kgd.blog.domain.model.CommentStatus
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.LocalDateTime

data class BlogCommentNode(
    val id: Long,
    val author: BlogAuthorSummary,
    val body: String,
    val status: CommentStatus,
    val mine: Boolean,
    val createdAt: LocalDateTime?,
    val updatedAt: LocalDateTime?,
    val replies: List<BlogCommentNode>,
)

data class BlogCommentRequest(
    @field:NotBlank val postSlug: String,
    val parentId: Long?,
    @field:NotBlank @field:Size(max = 2000) val body: String,
    /**
     * 첫 댓글에서만 쓰인다 — 프로필이 이미 있으면 저장된 표시명을 쓴다.
     * 매 요청 이름을 갈아 끼우면 같은 사람의 과거 댓글과 이름이 어긋난다.
     */
    @field:Size(max = 40) val displayName: String?,
)

data class BlogCommentEditRequest(
    @field:NotBlank @field:Size(max = 2000) val body: String,
)

data class BlogCommentStatusRequest(val status: CommentStatus)

data class BlogCommentAdminResponse(
    val id: Long,
    val postId: Long,
    val postSlug: String,
    val postTitle: String,
    val author: BlogAuthorSummary,
    val body: String,
    val status: CommentStatus,
    val createdAt: LocalDateTime?,
)
