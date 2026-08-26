package com.kgd.blog.infrastructure.persistence.adapter

import com.kgd.blog.application.comment.port.BlogCommentRepositoryPort
import com.kgd.blog.domain.model.BlogComment
import com.kgd.blog.domain.model.CommentStatus
import com.kgd.blog.domain.model.Paged
import com.kgd.blog.domain.model.Paging
import com.kgd.blog.infrastructure.persistence.entity.BlogCommentJpaEntity
import com.kgd.blog.infrastructure.persistence.repository.BlogCommentJpaRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Component

@Component
class BlogCommentRepositoryAdapter(
    private val jpaRepository: BlogCommentJpaRepository,
) : BlogCommentRepositoryPort {

    override fun findById(id: Long): BlogComment? = jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun findAllByPostId(postId: Long): List<BlogComment> =
        jpaRepository.findAllByPostIdOrderByIdAsc(postId).map { it.toDomain() }

    override fun findAll(status: CommentStatus?, paging: Paging): Paged<BlogComment> {
        val pageable = PageRequest.of(paging.page, paging.size)
        val page = if (status == null) {
            jpaRepository.findAllByOrderByIdDesc(pageable)
        } else {
            jpaRepository.findAllByStatusOrderByIdDesc(status, pageable)
        }
        return Paged(page.content.map { it.toDomain() }, page.number, page.size, page.totalElements, page.totalPages)
    }

    override fun save(comment: BlogComment): BlogComment {
        val managed = comment.id?.let { jpaRepository.findById(it).orElse(null) }
        if (managed != null) {
            managed.applyFrom(comment)
            return managed.toDomain()
        }
        return jpaRepository.save(BlogCommentJpaEntity.fromDomain(comment)).toDomain()
    }

    override fun deleteByPostId(postId: Long) = jpaRepository.deleteByPostId(postId)
}
