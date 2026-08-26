package com.kgd.blog.infrastructure.persistence.entity

import com.kgd.blog.domain.model.BlogPost
import com.kgd.blog.domain.model.PostStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

/**
 * 글.
 *
 * 카운터(조회·좋아요·댓글·평점)는 **편집 대상이 아니다.** 어드민이 글을 저장할 때
 * 도메인 값으로 전체 동기화하면서 카운터까지 덮으면 그 순간 통계가 0으로 리셋된다 —
 * [update] 는 카운터를 건드리지 않고, 카운터는 각자의 원장이 성공했을 때만 오른다.
 */
@Entity
@Table(name = "blog_post")
class BlogPostJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "author_profile_id", nullable = false)
    val authorProfileId: Long = 0,

    @Column(nullable = false, length = 80, unique = true)
    val slug: String = "",

    categoryId: Long = 0,
    title: String = "",
    summary: String? = null,
    body: String = "",
    coverImageUrl: String? = null,
    status: PostStatus = PostStatus.DRAFT,
    publishedAt: LocalDateTime? = null,
    readingMinutes: Int = 1,
) {
    @Column(name = "category_id", nullable = false)
    var categoryId: Long = categoryId
        private set

    @Column(nullable = false, length = 200)
    var title: String = title
        private set

    @Column(length = 300)
    var summary: String? = summary
        private set

    @Column(nullable = false, columnDefinition = "MEDIUMTEXT")
    var body: String = body
        private set

    @Column(name = "cover_image_url", length = 1000)
    var coverImageUrl: String? = coverImageUrl
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var status: PostStatus = status
        private set

    @Column(name = "published_at")
    var publishedAt: LocalDateTime? = publishedAt
        private set

    @Column(name = "reading_minutes", nullable = false)
    var readingMinutes: Int = readingMinutes
        private set

    // ─── 관측값 — 편집 대상이 아니다 ───

    @Column(name = "view_count", nullable = false)
    var viewCount: Long = 0
        private set

    @Column(name = "like_count", nullable = false)
    var likeCount: Long = 0
        private set

    @Column(name = "comment_count", nullable = false)
    var commentCount: Long = 0
        private set

    @Column(name = "rating_sum", nullable = false)
    var ratingSum: Long = 0
        private set

    @Column(name = "rating_count", nullable = false)
    var ratingCount: Long = 0
        private set

    @Column(name = "created_at", insertable = false, updatable = false)
    var createdAt: LocalDateTime? = null
        private set

    @Column(name = "updated_at", insertable = false, updatable = false)
    var updatedAt: LocalDateTime? = null
        private set

    /** 본문 편집값의 전체 동기화. 슬러그와 작성자는 바뀌지 않고, 카운터는 건드리지 않는다 */
    fun update(post: BlogPost) {
        categoryId = post.categoryId
        title = post.title
        summary = post.summary
        body = post.body
        coverImageUrl = post.coverImageUrl
        readingMinutes = post.readingMinutes
    }

    /** 상태 전이 (부분 수정). 전이 가능 여부는 도메인이 이미 판정했다 */
    fun changeStatus(status: PostStatus, publishedAt: LocalDateTime?) {
        this.status = status
        // 최초 발행 시각은 한 번만 찍는다 — 재발행이 날짜를 바꾸면 정렬과 sitemap 이 흔들린다
        if (status == PostStatus.PUBLISHED && this.publishedAt == null) {
            this.publishedAt = publishedAt
        }
    }

    val ratingAverage: Double
        get() = if (ratingCount == 0L) 0.0 else ratingSum.toDouble() / ratingCount

    /** 도메인의 편집값·상태를 관리 엔티티에 반영한다. 카운터는 건드리지 않는다 */
    fun applyFrom(post: BlogPost) {
        update(post)
        status = post.status
        publishedAt = post.publishedAt
    }

    fun toDomain() = BlogPost(
        id = id,
        authorProfileId = authorProfileId,
        categoryId = categoryId,
        slug = slug,
        title = title,
        summary = summary,
        body = body,
        coverImageUrl = coverImageUrl,
        status = status,
        publishedAt = publishedAt,
        viewCount = viewCount,
        likeCount = likeCount,
        commentCount = commentCount,
        ratingSum = ratingSum,
        ratingCount = ratingCount,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )

    companion object {
        fun fromDomain(post: BlogPost) = BlogPostJpaEntity(
            id = post.id,
            authorProfileId = post.authorProfileId,
            slug = post.slug,
            categoryId = post.categoryId,
            title = post.title,
            summary = post.summary,
            body = post.body,
            coverImageUrl = post.coverImageUrl,
            status = post.status,
            publishedAt = post.publishedAt,
            readingMinutes = post.readingMinutes,
        )
    }
}
