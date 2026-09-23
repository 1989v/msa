package com.kgd.ads.infrastructure.persistence.placement.repository

import com.kgd.ads.infrastructure.persistence.placement.entity.PlacementJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface PlacementJpaRepository : JpaRepository<PlacementJpaEntity, String> {
    fun findAllByActiveTrue(): List<PlacementJpaEntity>
}
