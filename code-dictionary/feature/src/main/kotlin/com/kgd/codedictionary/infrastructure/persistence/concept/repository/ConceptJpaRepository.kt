package com.kgd.codedictionary.infrastructure.persistence.concept.repository

import com.kgd.codedictionary.infrastructure.persistence.concept.entity.ConceptJpaEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository

interface ConceptJpaRepository : JpaRepository<ConceptJpaEntity, Long> {
    fun findByConceptId(conceptId: String): ConceptJpaEntity?
    fun findByCategory(category: String, pageable: Pageable): Page<ConceptJpaEntity>
    fun findByLevel(level: String, pageable: Pageable): Page<ConceptJpaEntity>
    fun existsByConceptId(conceptId: String): Boolean
}
