package com.kgd.place.infrastructure.persistence.region.repository

import com.kgd.place.domain.region.model.AdministrativeRegionLevel
import com.kgd.place.infrastructure.persistence.region.entity.AdministrativeRegionJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface AdministrativeRegionJpaRepository : JpaRepository<AdministrativeRegionJpaEntity, String> {
    fun findByLevelOrderByCodeAsc(level: AdministrativeRegionLevel): List<AdministrativeRegionJpaEntity>

    fun findByParentCodeOrderByCodeAsc(parentCode: String): List<AdministrativeRegionJpaEntity>
}
