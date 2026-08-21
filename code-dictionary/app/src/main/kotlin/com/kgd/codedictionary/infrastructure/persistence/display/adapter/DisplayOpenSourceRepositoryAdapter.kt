package com.kgd.codedictionary.infrastructure.persistence.display.adapter

import com.kgd.codedictionary.application.display.port.DisplayOpenSourceRepositoryPort
import com.kgd.codedictionary.domain.display.model.DisplayOpenSource
import com.kgd.codedictionary.infrastructure.persistence.display.entity.DisplayOpenSourceJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.display.repository.DisplayOpenSourceJpaRepository
import org.springframework.stereotype.Component

@Component
class DisplayOpenSourceRepositoryAdapter(
    private val jpaRepository: DisplayOpenSourceJpaRepository,
) : DisplayOpenSourceRepositoryPort {

    override fun findAllActive(): List<DisplayOpenSource> =
        jpaRepository.findAllByActiveTrueOrderByOrderNoAsc()
            .map(DisplayOpenSourceJpaEntity::toDomain)
}
