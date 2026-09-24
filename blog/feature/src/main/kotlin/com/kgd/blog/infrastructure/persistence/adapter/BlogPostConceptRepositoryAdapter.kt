package com.kgd.blog.infrastructure.persistence.adapter

import com.kgd.blog.application.post.port.BlogPostConceptRepositoryPort
import com.kgd.blog.infrastructure.persistence.entity.BlogPostConceptJpaEntity
import com.kgd.blog.infrastructure.persistence.repository.BlogPostConceptJpaRepository
import org.springframework.stereotype.Component

@Component
class BlogPostConceptRepositoryAdapter(
    private val jpaRepository: BlogPostConceptJpaRepository,
) : BlogPostConceptRepositoryPort {

    override fun findConceptIds(postId: Long): List<String> =
        jpaRepository.findAllByPostIdOrderByOrdinalAsc(postId).map { it.conceptId }

    /** 지우고 다시 넣는다 — 행을 읽어 하나씩 지우지 않고 DELETE 한 문장으로 */
    override fun replace(postId: Long, conceptIds: List<String>) {
        jpaRepository.deleteAllOfPost(postId)
        if (conceptIds.isEmpty()) return
        jpaRepository.saveAll(conceptIds.mapIndexed { i, id -> BlogPostConceptJpaEntity(postId, id, i + 1) })
    }

    override fun deleteByPostId(postId: Long) {
        jpaRepository.deleteAllOfPost(postId)
    }
}
