package com.kgd.codedictionary.infrastructure.persistence.index.repository

import com.kgd.codedictionary.infrastructure.persistence.index.entity.ConceptIndexJpaEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository

interface ConceptIndexJpaRepository : JpaRepository<ConceptIndexJpaEntity, Long> {
    fun findByConceptConceptId(conceptId: String, pageable: Pageable): Page<ConceptIndexJpaEntity>
    fun findByConceptConceptId(conceptId: String): List<ConceptIndexJpaEntity>
    fun deleteByConceptConceptId(conceptId: String)
    fun deleteByFilePath(filePath: String)
}
