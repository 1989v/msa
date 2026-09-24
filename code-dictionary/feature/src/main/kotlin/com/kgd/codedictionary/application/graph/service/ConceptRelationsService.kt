package com.kgd.codedictionary.application.graph.service

import com.kgd.codedictionary.application.concept.port.ConceptEdgeRepositoryPort
import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.application.graph.dto.ConceptRelationsDto
import com.kgd.codedictionary.application.graph.dto.RelationConceptDto
import com.kgd.codedictionary.application.graph.dto.RelationEdgeDto
import com.kgd.codedictionary.application.graph.port.ConceptEvidenceQueryPort
import com.kgd.codedictionary.application.graph.usecase.ConceptRelationsUseCase
import com.kgd.codedictionary.domain.concept.exception.ConceptNotFoundException
import org.springframework.stereotype.Service

@Service
class ConceptRelationsService(
    private val conceptRepository: ConceptRepositoryPort,
    private val edgeRepository: ConceptEdgeRepositoryPort,
    private val evidenceQuery: ConceptEvidenceQueryPort,
) : ConceptRelationsUseCase {

    /** 간선이 가리키는 개념 행이 없으면(값으로 든 id) 그 간선은 뺀다 — 이름 없는 이웃을 내지 않는다 */
    override fun getRelations(conceptId: String): ConceptRelationsDto {
        val concept = conceptRepository.findByConceptId(conceptId) ?: throw ConceptNotFoundException(conceptId)
        val edges = edgeRepository.findTouching(conceptId)
        val neighborIds = edges.flatMap { listOf(it.fromConceptId, it.toConceptId) }.toSet() - conceptId
        val neighbors = conceptRepository.findSummariesByConceptIds(neighborIds).associateBy { it.conceptId }

        val outgoing = edges.filter { it.fromConceptId == conceptId }.sortedWith(compareBy({ it.kind.ordinal }, { it.ordinal }))
            .mapNotNull { e ->
                neighbors[e.toConceptId]?.let { n ->
                    RelationEdgeDto(e.kind.name, e.kind.name, n.conceptId, n.name, n.kind?.name, e.reason, e.evidenceRef)
                }
            }
        val incoming = edges.filter { it.toConceptId == conceptId }.sortedWith(compareBy({ it.kind.ordinal }, { it.ordinal }))
            .mapNotNull { e ->
                neighbors[e.fromConceptId]?.let { n ->
                    RelationEdgeDto(e.kind.name, e.kind.inverseLabel ?: e.kind.name, n.conceptId, n.name, n.kind?.name, e.reason, e.evidenceRef)
                }
            }
        return ConceptRelationsDto(
            concept = RelationConceptDto(
                id = concept.conceptId, name = concept.name, kind = concept.kind?.name, category = concept.category.name,
                level = concept.level.name, description = concept.description, managedBy = concept.managedBy,
            ),
            outgoing = outgoing,
            incoming = incoming,
            evidence = evidenceQuery.evidenceOf(conceptId),
            questions = evidenceQuery.questionsOf(conceptId),
            code = evidenceQuery.codeOf(conceptId),
        )
    }
}
