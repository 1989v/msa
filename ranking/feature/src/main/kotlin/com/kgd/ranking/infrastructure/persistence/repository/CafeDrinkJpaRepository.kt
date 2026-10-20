package com.kgd.ranking.infrastructure.persistence.repository

import com.kgd.ranking.infrastructure.persistence.entity.CafeDrinkJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface CafeDrinkJpaRepository : JpaRepository<CafeDrinkJpaEntity, Long> {
    fun deleteByBrandSlugIn(brands: Collection<String>)
}
