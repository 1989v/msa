package com.kgd.codedictionary.application.graph.service

import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.application.graph.dto.*
import com.kgd.codedictionary.application.index.port.ConceptIndexRepositoryPort
import org.springframework.stereotype.Service

@Service
class GraphService(
    private val conceptRepository: ConceptRepositoryPort,
    private val indexRepository: ConceptIndexRepositoryPort
) {
    fun getGraphData(): GraphDataDto {
        val concepts = conceptRepository.findAllList()
        val allIndexes = indexRepository.findAll()

        val indexCountMap = allIndexes.groupBy { it.conceptId }.mapValues { it.value.size }

        val nodes = concepts.map { concept ->
            GraphNodeDto(
                id = concept.conceptId,
                name = concept.name,
                category = concept.category.name,
                level = concept.level.name,
                indexCount = indexCountMap[concept.conceptId] ?: 0,
                relatedCount = concept.relatedConceptIds.size,
                description = concept.description
            )
        }

        val conceptIdSet = concepts.map { it.conceptId }.toSet()
        val links = concepts.flatMap { concept ->
            concept.relatedConceptIds
                .filter { it in conceptIdSet }
                .map { relatedId ->
                    GraphLinkDto(
                        source = concept.conceptId,
                        target = relatedId,
                        type = "RELATED"
                    )
                }
        }.distinctBy { setOf(it.source, it.target) }

        val byCategory = concepts.groupBy { it.category.name }.mapValues { it.value.size }
        val byLevel = concepts.groupBy { it.level.name }.mapValues { it.value.size }
        val matrix = concepts.groupBy { it.category.name }.mapValues { (_, categoryConcepts) ->
            categoryConcepts.groupBy { it.level.name }.mapValues { it.value.size }
        }

        val stats = GraphStatsDto(
            totalConcepts = concepts.size,
            totalIndexes = allIndexes.size.toLong(),
            byCategory = byCategory,
            byLevel = byLevel,
            matrix = matrix
        )

        return GraphDataDto(nodes = nodes, links = links, stats = stats)
    }
}
