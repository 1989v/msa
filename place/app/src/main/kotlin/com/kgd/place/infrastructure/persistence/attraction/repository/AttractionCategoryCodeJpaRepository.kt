package com.kgd.place.infrastructure.persistence.attraction.repository

import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionCategoryCodeJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface AttractionCategoryCodeJpaRepository : JpaRepository<AttractionCategoryCodeJpaEntity, Long> {
    fun findByLang(lang: String): List<AttractionCategoryCodeJpaEntity>
}
