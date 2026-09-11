package com.kgd.quant.infrastructure.persistence.repository

import com.kgd.quant.infrastructure.persistence.entity.IndicatorContentEntity
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface IndicatorContentJpaRepository : JpaRepository<IndicatorContentEntity, UUID> {
    fun findBySlug(slug: String): IndicatorContentEntity?
    fun findAllByPublishedAtIsNotNullOrderByTitleAsc(): List<IndicatorContentEntity>
    fun findAllByPublishedAtIsNotNullAndCategoryOrderByTitleAsc(category: String): List<IndicatorContentEntity>
}
