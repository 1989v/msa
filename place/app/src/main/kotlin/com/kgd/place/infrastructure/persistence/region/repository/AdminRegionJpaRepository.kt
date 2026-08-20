package com.kgd.place.infrastructure.persistence.region.repository

import com.kgd.place.domain.region.model.AdminRegionLevel
import com.kgd.place.infrastructure.persistence.region.entity.AdminRegionJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface AdminRegionJpaRepository : JpaRepository<AdminRegionJpaEntity, String> {
    fun findByLevelOrderByCodeAsc(level: AdminRegionLevel): List<AdminRegionJpaEntity>

    fun findByParentCodeOrderByCodeAsc(parentCode: String): List<AdminRegionJpaEntity>
}
