package com.kgd.blog.infrastructure.persistence.adapter

import com.kgd.blog.application.profile.port.BlogProfileRepositoryPort
import com.kgd.blog.domain.model.BlogProfile
import com.kgd.blog.domain.model.ProfileRole
import com.kgd.blog.domain.model.ProfileStatus
import com.kgd.blog.infrastructure.persistence.entity.BlogProfileJpaEntity
import com.kgd.blog.infrastructure.persistence.repository.BlogProfileJpaRepository
import org.springframework.stereotype.Component

@Component
class BlogProfileRepositoryAdapter(
    private val jpaRepository: BlogProfileJpaRepository,
) : BlogProfileRepositoryPort {

    override fun findById(id: Long): BlogProfile? = jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun findByMemberId(memberId: Long): BlogProfile? = jpaRepository.findByMemberId(memberId)?.toDomain()

    override fun findByHandle(handle: String): BlogProfile? = jpaRepository.findByHandle(handle)?.toDomain()

    override fun existsByHandle(handle: String): Boolean = jpaRepository.existsByHandle(handle)

    override fun findAllByIdIn(ids: Collection<Long>): List<BlogProfile> =
        if (ids.isEmpty()) emptyList() else jpaRepository.findAllByIdIn(ids).map { it.toDomain() }

    override fun findAll(role: ProfileRole?, status: ProfileStatus?): List<BlogProfile> {
        val all = when {
            role != null && status != null -> jpaRepository.findAllByRoleAndStatusOrderByIdDesc(role, status)
            role != null -> jpaRepository.findAllByRoleOrderByIdDesc(role)
            else -> jpaRepository.findAll().sortedByDescending { it.id }
        }
        return all.filter { status == null || it.status == status }.map { it.toDomain() }
    }

    override fun save(profile: BlogProfile): BlogProfile {
        val managed = profile.id?.let { jpaRepository.findById(it).orElse(null) }
        if (managed != null) {
            managed.applyFrom(profile)
            return managed.toDomain()
        }
        return jpaRepository.save(BlogProfileJpaEntity.fromDomain(profile)).toDomain()
    }
}
