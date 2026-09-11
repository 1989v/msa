package com.kgd.codedictionary.infrastructure.persistence.display.adapter

import com.kgd.codedictionary.application.display.port.DisplayServiceRepositoryPort
import com.kgd.codedictionary.domain.display.model.DisplayService
import com.kgd.codedictionary.domain.display.model.DisplayStatus
import com.kgd.codedictionary.infrastructure.persistence.display.entity.DisplayServiceJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.display.repository.DisplayServiceJpaRepository
import org.springframework.stereotype.Component

@Component
class DisplayServiceRepositoryAdapter(
    private val jpaRepository: DisplayServiceJpaRepository,
) : DisplayServiceRepositoryPort {

    override fun findAllDisplayed(): List<DisplayService> =
        jpaRepository.findAllByStatusNotOrderByOrderNoAsc(DisplayStatus.HOLD)
            .map(DisplayServiceJpaEntity::toDomain)

    override fun findAll(): List<DisplayService> =
        jpaRepository.findAllByOrderByOrderNoAsc().map(DisplayServiceJpaEntity::toDomain)

    /** code 는 불변 식별자다 — 기존 행이 있으면 id 없이 올려도 갱신으로 처리한다. */
    override fun save(service: DisplayService): DisplayService {
        val existing = service.id?.let { jpaRepository.findById(it).orElse(null) }
            ?: jpaRepository.findByCode(service.code)
        return if (existing == null) {
            jpaRepository.save(DisplayServiceJpaEntity.fromDomain(service)).toDomain()
        } else {
            existing.update(service)
            existing.toDomain()
        }
    }

    override fun delete(id: Long) = jpaRepository.deleteById(id)
}
