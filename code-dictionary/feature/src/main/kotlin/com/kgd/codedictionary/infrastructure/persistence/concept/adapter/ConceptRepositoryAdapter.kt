package com.kgd.codedictionary.infrastructure.persistence.concept.adapter

import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.domain.concept.model.Concept
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import com.kgd.codedictionary.infrastructure.persistence.concept.entity.ConceptJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.concept.repository.ConceptJpaRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Component

@Component
class ConceptRepositoryAdapter(
    private val jpaRepository: ConceptJpaRepository
) : ConceptRepositoryPort {

    override fun save(concept: Concept): Concept {
        val relationTargets = concept.relatedConceptIds
            .mapNotNull { jpaRepository.findByConceptId(it) }

        val id = concept.id
        val entity = if (id != null) {
            jpaRepository.findById(id).orElseThrow {
                IllegalArgumentException("Concept not found: $id")
            }.also { it.update(concept, relationTargets) }
        } else {
            ConceptJpaEntity.fromDomain(concept, relationTargets)
        }
        return jpaRepository.save(entity).toDomain()
    }

    override fun findById(id: Long): Concept? =
        jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun findByConceptId(conceptId: String): Concept? =
        jpaRepository.findByConceptId(conceptId)?.toDomain()

    override fun findAll(pageable: Pageable): Page<Concept> =
        jpaRepository.findAll(pageable).map { it.toDomain() }

    override fun findByCategory(category: ConceptCategory, pageable: Pageable): Page<Concept> =
        jpaRepository.findByCategory(category.name, pageable).map { it.toDomain() }

    override fun findByLevel(level: ConceptLevel, pageable: Pageable): Page<Concept> =
        jpaRepository.findByLevel(level.name, pageable).map { it.toDomain() }

    override fun findAllWithSynonyms(): List<Concept> =
        jpaRepository.findAll().map { it.toDomain() }

    override fun delete(id: Long) {
        jpaRepository.deleteById(id)
    }

    override fun existsByConceptId(conceptId: String): Boolean =
        jpaRepository.existsByConceptId(conceptId)

    override fun findAllList(): List<Concept> =
        jpaRepository.findAll().map { it.toDomain() }
}
