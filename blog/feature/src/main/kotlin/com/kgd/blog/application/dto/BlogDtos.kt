package com.kgd.blog.application.dto

import com.kgd.blog.domain.model.CommentStatus
import com.kgd.blog.domain.model.PostStatus
import com.kgd.blog.domain.model.ProfileRole
import com.kgd.blog.domain.model.ProfileStatus
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.LocalDate
import java.time.LocalDateTime

// ─── 공개 조회 ──────────────────────────────────────────────────────────────

/** 카테고리 트리 한 마디. `children` 이 비어 있으면 잎이다 */
data class BlogCategoryNode(
    val id: Long,
    val slug: String,
    val name: String,
    val description: String?,
    val path: String,
    val depth: Int,
    val orderNo: Int,
    val postCount: Long,
    val children: List<BlogCategoryNode>,
)

data class BlogAuthorSummary(
    val handle: String?,
    val displayName: String,
    val avatarUrl: String?,
    val bio: String?,
)

data class BlogPostSummary(
    val id: Long,
    val slug: String,
    val title: String,
    val summary: String,
    val coverImageUrl: String?,
    val categoryPath: String,
    val categoryName: String,
    val author: BlogAuthorSummary,
    val status: PostStatus,
    val publishedAt: LocalDateTime?,
    val readingMinutes: Int,
    val viewCount: Long,
    val likeCount: Long,
    val commentCount: Long,
    val ratingAverage: Double,
    val ratingCount: Long,
)

/** 브레드크럼 한 칸 — `기술 > 서버 > 검색` */
data class BlogCrumb(val name: String, val path: String)

data class BlogPostDetail(
    val post: BlogPostSummary,
    val body: String,
    val breadcrumb: List<BlogCrumb>,
    /** 요청자가 이미 누른 좋아요·매긴 평점. 비로그인도 방문자 키로 판정된다 */
    val liked: Boolean,
    val myScore: Int?,
)

data class BlogPage<T>(
    val items: List<T>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

data class BlogAuthorSpace(
    val author: BlogAuthorSummary,
    val postCount: Long,
    val posts: List<BlogPostSummary>,
)

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

data class BlogReaction(
    val liked: Boolean,
    val likeCount: Long,
    val ratingAverage: Double,
    val ratingCount: Long,
    val myScore: Int?,
)

// ─── 쓰기 요청 ──────────────────────────────────────────────────────────────

data class BlogPostRequest(
    @field:NotBlank @field:Size(max = 200) val title: String,
    /** 비우면 서버가 정한다 — 한글 제목이면 `yyyyMMdd-{seed}` 로 간다 */
    @field:Size(max = 80) val slug: String?,
    val categoryId: Long,
    @field:Size(max = 300) val summary: String?,
    @field:NotBlank val body: String,
    @field:Size(max = 1000) val coverImageUrl: String?,
)

data class BlogProfileRequest(
    @field:NotBlank @field:Size(max = 40) val displayName: String,
    @field:Size(max = 300) val bio: String?,
    @field:Size(max = 1000) val avatarUrl: String?,
)

data class BlogAuthorApplicationRequest(
    @field:NotBlank @field:Size(max = 30) val handle: String,
    @field:NotBlank @field:Size(max = 40) val displayName: String,
    @field:Size(max = 300) val bio: String?,
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

data class BlogRatingRequest(
    @field:Min(1) @field:Max(5) val score: Int,
)

data class BlogCategoryRequest(
    val parentId: Long?,
    @field:NotBlank @field:Size(max = 60) val slug: String,
    @field:NotBlank @field:Size(max = 60) val name: String,
    @field:Size(max = 300) val description: String?,
    val orderNo: Int = 0,
    val hidden: Boolean = false,
)

// ─── 어드민 ────────────────────────────────────────────────────────────────

data class BlogProfileAdminResponse(
    val id: Long,
    val memberId: Long,
    val handle: String?,
    val displayName: String,
    val bio: String?,
    val role: ProfileRole,
    val status: ProfileStatus,
    val postCount: Long,
    val approvedAt: LocalDateTime?,
    val createdAt: LocalDateTime?,
)

data class BlogProfileStatusRequest(val status: ProfileStatus)

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

data class BlogViewDaily(val date: LocalDate, val count: Long)

/** 내 스튜디오 첫 화면 — 프로필 상태와 글 통계를 한 응답으로 묶는다 */
data class BlogStudioOverview(
    val profile: BlogProfileAdminResponse?,
    val canWrite: Boolean,
    val draftCount: Long,
    val publishedCount: Long,
    val totalViews: Long,
)
