package com.kgd.deal.infrastructure.persistence.adapter

import com.kgd.deal.application.category.port.DealCategoryRepositoryPort
import com.kgd.deal.domain.model.DealCategory
import com.kgd.deal.domain.model.DisplayStatus
import com.kgd.deal.infrastructure.persistence.entity.DealCategoryJpaEntity
import com.kgd.deal.infrastructure.persistence.repository.DealCategoryJpaRepository
import org.springframework.stereotype.Component

@Component
class DealCategoryRepositoryAdapter(
    private val jpaRepository: DealCategoryJpaRepository,
) : DealCategoryRepositoryPort {

    override fun findAll(): List<DealCategory> = jpaRepository.findAllByOrderByOrderNoAsc().map { it.toDomain() }

    override fun findAllByStatus(status: DisplayStatus): List<DealCategory> =
        jpaRepository.findAllByStatusOrderByOrderNoAsc(status).map { it.toDomain() }

    override fun findById(id: Long): DealCategory? = jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun findByCode(code: String): DealCategory? = jpaRepository.findByCode(code)?.toDomain()

    override fun existsByCode(code: String): Boolean = jpaRepository.existsByCode(code)

    override fun save(category: DealCategory): DealCategory {
        val managed = category.id?.let { jpaRepository.findById(it).orElse(null) }
        if (managed != null) {
            managed.update(category)
            return managed.toDomain()
        }
        return jpaRepository.save(DealCategoryJpaEntity.fromDomain(category)).toDomain()
    }

    override fun deleteById(id: Long) = jpaRepository.deleteById(id)
}
