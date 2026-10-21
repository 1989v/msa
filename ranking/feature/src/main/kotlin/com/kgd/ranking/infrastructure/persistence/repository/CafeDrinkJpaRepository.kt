package com.kgd.ranking.infrastructure.persistence.repository

import com.kgd.ranking.infrastructure.persistence.entity.CafeDrinkJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface CafeDrinkJpaRepository : JpaRepository<CafeDrinkJpaEntity, Long> {
    fun deleteByBrandSlugIn(brands: Collection<String>)
}

interface CafeEffectiveDrinkJpaRepository : JpaRepository<com.kgd.ranking.infrastructure.persistence.entity.CafeEffectiveDrinkJpaEntity, Long> {
    fun findByBrandSlugAndMenuNameAndTemperatureAndSizeLabelAndCaffeineStatus(brand: String, menu: String, temperature: String, size: String, status: com.kgd.ranking.domain.cafe.model.CaffeineStatus): com.kgd.ranking.infrastructure.persistence.entity.CafeEffectiveDrinkJpaEntity?
    fun deleteByBrandSlugIn(brands: Collection<String>)
}
