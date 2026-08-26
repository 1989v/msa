package com.kgd.blog.infrastructure.persistence.adapter

import com.kgd.blog.application.category.port.BlogCategoryRepositoryPort
import com.kgd.blog.domain.model.BlogCategory
import com.kgd.blog.infrastructure.persistence.entity.BlogCategoryJpaEntity
import com.kgd.blog.infrastructure.persistence.repository.BlogCategoryJpaRepository
import org.springframework.stereotype.Component

@Component
class BlogCategoryRepositoryAdapter(
    private val jpaRepository: BlogCategoryJpaRepository,
) : BlogCategoryRepositoryPort {

    override fun findById(id: Long): BlogCategory? = jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun findAllOrderByPath(): List<BlogCategory> = jpaRepository.findAllByOrderByPathAsc().map { it.toDomain() }

    override fun findAllByIdIn(ids: Collection<Long>): List<BlogCategory> =
        if (ids.isEmpty()) emptyList() else jpaRepository.findAllById(ids).map { it.toDomain() }

    override fun findSubtree(path: String): List<BlogCategory> = jpaRepository.findSubtree(path).map { it.toDomain() }

    override fun existsByParentIdAndSlug(parentId: Long?, slug: String): Boolean =
        jpaRepository.existsByParentIdAndSlug(parentId, slug)

    override fun countByParentId(parentId: Long): Long = jpaRepository.countByParentId(parentId)

    override fun save(category: BlogCategory): BlogCategory {
        val managed = category.id?.let { jpaRepository.findById(it).orElse(null) }
        if (managed != null) {
            managed.update(category)
            return managed.toDomain()
        }
        return jpaRepository.save(BlogCategoryJpaEntity.fromDomain(category)).toDomain()
    }

    override fun saveAll(categories: List<BlogCategory>) {
        categories.forEach { save(it) }
    }

    override fun deleteById(id: Long) = jpaRepository.deleteById(id)
}
