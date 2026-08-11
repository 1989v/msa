package com.kgd.place.infrastructure.persistence.attraction.repository

import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionJpaEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository

interface AttractionJpaRepository : JpaRepository<AttractionJpaEntity, Long> {
    fun findByContentIdIn(contentIds: Collection<String>): List<AttractionJpaEntity>

    fun findByLang(lang: String, pageable: Pageable): Page<AttractionJpaEntity>
}
