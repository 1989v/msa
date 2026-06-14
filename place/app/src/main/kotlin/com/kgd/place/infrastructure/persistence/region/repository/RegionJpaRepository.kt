package com.kgd.place.infrastructure.persistence.region.repository

import com.kgd.place.domain.region.model.RegionLevel
import com.kgd.place.infrastructure.persistence.region.entity.RegionJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface RegionJpaRepository : JpaRepository<RegionJpaEntity, Long> {
    fun findByLevel(level: RegionLevel): List<RegionJpaEntity>
    fun findByParentId(parentId: Long): List<RegionJpaEntity>
    fun findByGeonamesId(geonamesId: Long): RegionJpaEntity?
}
