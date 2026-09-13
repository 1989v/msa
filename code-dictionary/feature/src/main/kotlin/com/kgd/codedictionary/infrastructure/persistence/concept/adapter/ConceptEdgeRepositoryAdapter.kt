package com.kgd.codedictionary.infrastructure.persistence.concept.adapter

import com.kgd.codedictionary.application.concept.port.ConceptEdgeRepositoryPort
import com.kgd.codedictionary.domain.concept.model.ConceptEdge
import com.kgd.codedictionary.infrastructure.persistence.concept.repository.ConceptEdgeJpaRepository
import org.springframework.stereotype.Component

@Component
class ConceptEdgeRepositoryAdapter(
    private val jpaRepository: ConceptEdgeJpaRepository,
) : ConceptEdgeRepositoryPort {

    override fun findAll(): List<ConceptEdge> = jpaRepository.findAll().map { it.toDomain() }
}
