package com.kgd.blog.application.service

import com.kgd.blog.application.dto.BlogAuthorSummary
import com.kgd.blog.application.dto.BlogCrumb
import com.kgd.blog.application.dto.BlogPostSummary
import com.kgd.blog.domain.model.BlogPost
import com.kgd.blog.infrastructure.persistence.entity.BlogCategoryJpaEntity
import com.kgd.blog.infrastructure.persistence.entity.BlogPostJpaEntity
import com.kgd.blog.infrastructure.persistence.entity.BlogProfileJpaEntity
import com.kgd.blog.infrastructure.persistence.repository.BlogCategoryJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogProfileJpaRepository
import org.springframework.stereotype.Component

/**
 * 글 목록/상세를 화면용 DTO 로 조립한다.
 *
 * 저자·카테고리를 글마다 조회하면 목록 한 번에 쿼리가 글 수만큼 붙는다(N+1). 페이지 단위로
 * id 를 모아 한 번에 읽는 이 조립기를 거치도록 강제해, 호출부가 편의상 `findById` 를 부르는
 * 길을 막는다.
 */
@Component
class BlogAssembler(
    private val profileRepository: BlogProfileJpaRepository,
    private val categoryRepository: BlogCategoryJpaRepository,
) {

    fun summaries(posts: List<BlogPostJpaEntity>): List<BlogPostSummary> {
        if (posts.isEmpty()) return emptyList()
        val authors = profileRepository.findAllByIdIn(posts.map { it.authorProfileId }.toSet())
            .associateBy { it.id }
        val categories = categoryRepository.findAllById(posts.map { it.categoryId }.toSet())
            .associateBy { it.id }
        return posts.map { summary(it, authors[it.authorProfileId], categories[it.categoryId]) }
    }

    fun summary(
        post: BlogPostJpaEntity,
        author: BlogProfileJpaEntity?,
        category: BlogCategoryJpaEntity?,
    ) = BlogPostSummary(
        id = post.id ?: 0,
        slug = post.slug,
        title = post.title,
        // 요약이 비면 검색결과·공유 카드가 통째로 빈다 — 본문에서 뽑아서라도 채운다
        summary = post.toDomain().descriptionOrExcerpt(),
        coverImageUrl = post.coverImageUrl,
        categoryPath = category?.path ?: "",
        categoryName = category?.name ?: "",
        author = authorSummary(author),
        status = post.status,
        publishedAt = post.publishedAt,
        readingMinutes = post.readingMinutes,
        viewCount = post.viewCount,
        likeCount = post.likeCount,
        commentCount = post.commentCount,
        ratingAverage = post.ratingAverage,
        ratingCount = post.ratingCount,
    )

    fun authorSummary(author: BlogProfileJpaEntity?) = BlogAuthorSummary(
        handle = author?.handle,
        // 프로필이 지워진 글이 목록 전체를 죽이지 않도록 표시명은 항상 채운다
        displayName = author?.displayName ?: "알 수 없음",
        avatarUrl = author?.avatarUrl,
        bio = author?.bio,
    )

    /** `/tech/server/search` → 기술 > 서버 > 검색. 없는 마디는 건너뛴다 */
    fun breadcrumb(category: BlogCategoryJpaEntity?): List<BlogCrumb> {
        if (category == null) return emptyList()
        val segments = category.path.trim('/').split('/')
        val paths = segments.indices.map { "/" + segments.take(it + 1).joinToString("/") }
        val byPath = categoryRepository.findAllByOrderByPathAsc().associateBy { it.path }
        return paths.mapNotNull { path -> byPath[path]?.let { BlogCrumb(it.name, it.path) } }
    }

    fun domain(post: BlogPostJpaEntity): BlogPost = post.toDomain()
}
