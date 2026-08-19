package com.kgd.place.infrastructure.persistence.attraction.adapter

import com.kgd.place.application.attraction.port.AttractionOverviewProbeRepositoryPort
import com.kgd.place.domain.attraction.model.AttractionOverviewProbe
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionOverviewProbeJpaEntity
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionOverviewProbeJpaRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
class AttractionOverviewProbeRepositoryAdapter(
    private val jpaRepository: AttractionOverviewProbeJpaRepository,
) : AttractionOverviewProbeRepositoryPort {

    @Transactional
    override fun recordAll(probes: List<AttractionOverviewProbe>): Int {
        if (probes.isEmpty()) return 0

        val existingByKey = jpaRepository.findByContentIdIn(probes.map { it.contentId }.toSet())
            .associateBy { it.contentId to it.lang }

        val entities = probes.map { incoming ->
            val existing = existingByKey[incoming.contentId to incoming.lang]
            AttractionOverviewProbeJpaEntity(
                id = existing?.id,
                contentId = incoming.contentId,
                lang = incoming.lang,
                checkedAt = incoming.checkedAt,
            )
        }
        jpaRepository.saveAll(entities)
        return entities.size
    }

    override fun findAll(lang: String?): List<AttractionOverviewProbe> =
        (lang?.let { jpaRepository.findByLang(it) } ?: jpaRepository.findAll())
            .map { it.toDomain() }
}
