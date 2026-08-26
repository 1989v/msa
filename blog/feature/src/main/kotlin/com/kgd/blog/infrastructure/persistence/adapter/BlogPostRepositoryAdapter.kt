package com.kgd.blog.infrastructure.persistence.adapter

import com.kgd.blog.application.post.port.BlogPostRepositoryPort
import com.kgd.blog.domain.model.BlogPost
import com.kgd.blog.domain.model.Paged
import com.kgd.blog.domain.model.Paging
import com.kgd.blog.domain.model.PostStatus
import com.kgd.blog.infrastructure.persistence.entity.BlogPostJpaEntity
import com.kgd.blog.infrastructure.persistence.repository.BlogPostJpaRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Component

@Component
class BlogPostRepositoryAdapter(
    private val jpaRepository: BlogPostJpaRepository,
) : BlogPostRepositoryPort {

    override fun findById(id: Long): BlogPost? = jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun findBySlug(slug: String): BlogPost? = jpaRepository.findBySlug(slug)?.toDomain()

    override fun existsBySlug(slug: String): Boolean = jpaRepository.existsBySlug(slug)

    override fun countByCategoryId(categoryId: Long): Long = jpaRepository.countByCategoryId(categoryId)

    override fun findAllByIdIn(ids: Collection<Long>): List<BlogPost> =
        if (ids.isEmpty()) emptyList() else jpaRepository.findAllById(ids).map { it.toDomain() }

    /**
     * 필터 조합마다 메서드를 따로 두는 이유는 `:ids IS NULL OR x IN :ids` 형태가 컬렉션
     * 파라미터에 null 을 바인딩하는 순간 구현체마다 다르게 깨지기 때문이다.
     */
    override fun findPublished(categoryIds: Collection<Long>?, authorId: Long?, paging: Paging): Paged<BlogPost> {
        val pageable = paging.toPageable()
        val page = when {
            categoryIds != null && authorId != null ->
                jpaRepository.findAllByStatusAndCategoryIdInAndAuthorProfileIdOrderByPublishedAtDescIdDesc(
                    PostStatus.PUBLISHED, categoryIds, authorId, pageable,
                )
            categoryIds != null ->
                jpaRepository.findAllByStatusAndCategoryIdInOrderByPublishedAtDescIdDesc(PostStatus.PUBLISHED, categoryIds, pageable)
            authorId != null ->
                jpaRepository.findAllByStatusAndAuthorProfileIdOrderByPublishedAtDescIdDesc(PostStatus.PUBLISHED, authorId, pageable)
            else -> jpaRepository.findAllByStatusOrderByPublishedAtDescIdDesc(PostStatus.PUBLISHED, pageable)
        }
        return page.toPaged()
    }

    override fun findAll(status: PostStatus?, paging: Paging): Paged<BlogPost> {
        val pageable = paging.toPageable()
        val page = if (status == null) {
            jpaRepository.findAll(pageable)
        } else {
            jpaRepository.findAllByStatusOrderByPublishedAtDescIdDesc(status, pageable)
        }
        return page.toPaged()
    }

    override fun findByAuthor(authorId: Long, status: PostStatus?, paging: Paging): Paged<BlogPost> {
        val pageable = paging.toPageable()
        val page = if (status == null) {
            jpaRepository.findAllByAuthorProfileIdOrderByIdDesc(authorId, pageable)
        } else {
            jpaRepository.findAllByAuthorProfileIdAndStatusOrderByIdDesc(authorId, status, pageable)
        }
        return page.toPaged()
    }

    /** 총 개수만 필요하므로 첫 페이지 1건만 읽는다 */
    override fun countByAuthor(authorId: Long, status: PostStatus?): Long =
        if (status == null) {
            jpaRepository.findAllByAuthorProfileIdOrderByIdDesc(authorId, COUNT_PROBE).totalElements
        } else {
            jpaRepository.findAllByAuthorProfileIdAndStatusOrderByIdDesc(authorId, status, COUNT_PROBE).totalElements
        }

    /**
     * 총 조회수 합계용. 스튜디오는 개인 글 목록이라 상한이 현실적인 최대치를 넘지 않는다 —
     * 넘어가면 합계 컬럼을 따로 두어야 한다는 신호다.
     */
    override fun sumViewCountByAuthor(authorId: Long): Long =
        jpaRepository.findAllByAuthorProfileIdOrderByIdDesc(authorId, ALL_PROBE).content.sumOf { it.viewCount }

    override fun save(post: BlogPost): BlogPost {
        val managed = post.id?.let { jpaRepository.findById(it).orElse(null) }
        if (managed != null) {
            managed.applyFrom(post)
            return managed.toDomain()
        }
        return jpaRepository.save(BlogPostJpaEntity.fromDomain(post)).toDomain()
    }

    override fun deleteById(id: Long) = jpaRepository.deleteById(id)

    override fun increaseViewCount(id: Long) {
        jpaRepository.increaseViewCount(id)
    }

    override fun addLikeCount(id: Long, delta: Long) {
        jpaRepository.addLikeCount(id, delta)
    }

    override fun addCommentCount(id: Long, delta: Long) {
        jpaRepository.addCommentCount(id, delta)
    }

    override fun addRating(id: Long, sumDelta: Long, countDelta: Long) {
        jpaRepository.addRating(id, sumDelta, countDelta)
    }

    private fun Paging.toPageable() = PageRequest.of(page, size)

    private fun Page<BlogPostJpaEntity>.toPaged() =
        Paged(content.map { it.toDomain() }, number, size, totalElements, totalPages)

    private companion object {
        val COUNT_PROBE = PageRequest.of(0, 1)
        val ALL_PROBE = PageRequest.of(0, 500)
    }
}
