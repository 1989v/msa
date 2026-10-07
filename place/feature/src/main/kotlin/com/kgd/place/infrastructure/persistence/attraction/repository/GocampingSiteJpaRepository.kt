package com.kgd.place.infrastructure.persistence.attraction.repository

import com.kgd.place.infrastructure.persistence.attraction.entity.GocampingSiteJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface GocampingSiteJpaRepository : JpaRepository<GocampingSiteJpaEntity, String> {
    fun findByAttractionIdIn(ids: Collection<Long>): List<GocampingSiteJpaEntity>

    fun findByMatchedAttractionIdIn(ids: Collection<Long>): List<GocampingSiteJpaEntity>
}
