package com.kgd.place.infrastructure.persistence.attraction.adapter

import com.kgd.place.application.attraction.port.GocampingSiteRepositoryPort
import com.kgd.place.domain.attraction.model.GocampingSite
import com.kgd.place.infrastructure.persistence.attraction.entity.GocampingSiteJpaEntity
import com.kgd.place.infrastructure.persistence.attraction.repository.GocampingSiteJpaRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
class GocampingSiteRepositoryAdapter(
    private val repository: GocampingSiteJpaRepository,
) : GocampingSiteRepositoryPort {

    /** 기본키가 원천 contentId 라 save 가 곧 덮어쓰기다 */
    @Transactional
    override fun upsertAll(sites: List<GocampingSite>): Int =
        repository.saveAll(sites.map { GocampingSiteJpaEntity.fromDomain(it) }).size
}
