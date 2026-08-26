package com.kgd.blog.application.post.dto

import com.kgd.blog.application.profile.dto.BlogAuthorSummary
import com.kgd.blog.application.profile.dto.BlogProfileAdminResponse
import com.kgd.blog.domain.model.Paged
import com.kgd.blog.domain.model.PostStatus
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.LocalDate
import java.time.LocalDateTime

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
) {
    companion object {
        fun <T> of(paged: Paged<T>) = BlogPage(paged.items, paged.page, paged.size, paged.totalElements, paged.totalPages)
    }
}

data class BlogAuthorSpace(
    val author: BlogAuthorSummary,
    val postCount: Long,
    val posts: List<BlogPostSummary>,
)

data class BlogPostRequest(
    @field:NotBlank @field:Size(max = 200) val title: String,
    /** 비우면 서버가 정한다 — 한글 제목이면 `yyyyMMdd-{seed}` 로 간다 */
    @field:Size(max = 80) val slug: String?,
    val categoryId: Long,
    @field:Size(max = 300) val summary: String?,
    @field:NotBlank val body: String,
    @field:Size(max = 1000) val coverImageUrl: String?,
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
