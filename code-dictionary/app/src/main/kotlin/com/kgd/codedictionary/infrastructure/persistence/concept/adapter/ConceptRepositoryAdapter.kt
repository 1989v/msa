package com.kgd.codedictionary.infrastructure.persistence.concept.adapter

import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.domain.concept.model.Concept
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import com.kgd.codedictionary.infrastructure.persistence.concept.entity.ConceptJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.concept.entity.ConceptRelationJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.concept.entity.ConceptSynonymJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.concept.repository.ConceptJpaRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Component

@Component
class ConceptRepositoryAdapter(
    private val jpaRepository: ConceptJpaRepository
) : ConceptRepositoryPort {

    override fun save(concept: Concept): Concept {
        val id = concept.id
        val entity = if (id != null) {
            jpaRepository.findById(id).orElseThrow {
                IllegalArgumentException("Concept not found: $id")
            }.also { e ->
                e.name = concept.name
                e.category = concept.category.name
                e.level = concept.level.name
                e.description = concept.description

                e.synonyms.clear()
                concept.synonyms.forEach { synonym ->
                    e.synonyms.add(ConceptSynonymJpaEntity(synonym = synonym, concept = e))
                }

                e.relations.clear()
                concept.relatedConceptIds.forEach { relatedConceptId ->
                    val targetEntity = jpaRepository.findByConceptId(relatedConceptId)
                    if (targetEntity != null) {
                        e.relations.add(
                            ConceptRelationJpaEntity(sourceConcept = e, targetConcept = targetEntity)
                        )
                    }
                }
            }
        } else {
            val newEntity = ConceptJpaEntity.fromDomain(concept)
            concept.relatedConceptIds.forEach { relatedConceptId ->
                val targetEntity = jpaRepository.findByConceptId(relatedConceptId)
                if (targetEntity != null) {
                    newEntity.relations.add(
                        ConceptRelationJpaEntity(sourceConcept = newEntity, targetConcept = targetEntity)
                    )
                }
            }
            newEntity
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
