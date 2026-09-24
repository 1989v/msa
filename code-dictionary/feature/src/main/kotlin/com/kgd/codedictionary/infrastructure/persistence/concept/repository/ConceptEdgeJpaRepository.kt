package com.kgd.codedictionary.infrastructure.persistence.concept.repository

import com.kgd.codedictionary.infrastructure.persistence.concept.entity.ConceptEdgeJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface ConceptEdgeJpaRepository : JpaRepository<ConceptEdgeJpaEntity, Long> {
    fun findAllByFromConceptIdOrToConceptId(fromConceptId: String, toConceptId: String): List<ConceptEdgeJpaEntity>
}
