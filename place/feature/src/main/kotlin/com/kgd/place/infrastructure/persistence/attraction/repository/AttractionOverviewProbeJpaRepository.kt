package com.kgd.place.infrastructure.persistence.attraction.repository

import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionOverviewProbeJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface AttractionOverviewProbeJpaRepository : JpaRepository<AttractionOverviewProbeJpaEntity, Long> {
    fun findByContentIdIn(contentIds: Collection<String>): List<AttractionOverviewProbeJpaEntity>

    fun findByLang(lang: String): List<AttractionOverviewProbeJpaEntity>
}
