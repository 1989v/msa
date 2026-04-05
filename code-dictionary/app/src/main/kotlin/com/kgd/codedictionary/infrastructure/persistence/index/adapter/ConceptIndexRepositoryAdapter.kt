package com.kgd.codedictionary.infrastructure.persistence.index.adapter

import com.kgd.codedictionary.application.index.port.ConceptIndexRepositoryPort
import com.kgd.codedictionary.domain.index.model.ConceptIndex
import com.kgd.codedictionary.infrastructure.persistence.concept.repository.ConceptJpaRepository
import com.kgd.codedictionary.infrastructure.persistence.index.entity.ConceptIndexJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.index.repository.ConceptIndexJpaRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
class ConceptIndexRepositoryAdapter(
    private val jpaRepository: ConceptIndexJpaRepository,
    private val conceptJpaRepository: ConceptJpaRepository
) : ConceptIndexRepositoryPort {

    override fun save(conceptIndex: ConceptIndex): ConceptIndex {
        val conceptEntity = conceptJpaRepository.findByConceptId(conceptIndex.conceptId)
            ?: throw IllegalArgumentException("Concept not found: ${conceptIndex.conceptId}")

        val id = conceptIndex.id
        val entity = if (id != null) {
            jpaRepository.findById(id).orElseThrow {
                IllegalArgumentException("ConceptIndex not found: $id")
            }.also { e ->
                e.filePath = conceptIndex.location.filePath
                e.lineStart = conceptIndex.location.lineStart
                e.lineEnd = conceptIndex.location.lineEnd
                e.codeSnippet = conceptIndex.codeSnippet
                e.gitUrl = conceptIndex.location.gitUrl
                e.description = conceptIndex.description
                e.gitCommitHash = conceptIndex.gitCommitHash
            }
        } else {
            ConceptIndexJpaEntity.fromDomain(conceptIndex, conceptEntity)
        }
        return jpaRepository.save(entity).toDomain()
    }

    override fun saveAll(indices: List<ConceptIndex>): List<ConceptIndex> =
        indices.map { save(it) }

    override fun findById(id: Long): ConceptIndex? =
        jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun findByConceptId(conceptId: String, pageable: Pageable): Page<ConceptIndex> =
        jpaRepository.findByConceptConceptId(conceptId, pageable).map { it.toDomain() }

    override fun findAll(pageable: Pageable): Page<ConceptIndex> =
        jpaRepository.findAll(pageable).map { it.toDomain() }

    @Transactional
    override fun deleteByConceptId(conceptId: String) {
        jpaRepository.deleteByConceptConceptId(conceptId)
    }

    @Transactional
    override fun deleteByFilePath(filePath: String) {
        jpaRepository.deleteByFilePath(filePath)
    }

    override fun count(): Long = jpaRepository.count()
}
