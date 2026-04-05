package com.kgd.codedictionary.application.sync.service

import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.application.index.port.ConceptIndexRepositoryPort
import com.kgd.codedictionary.application.search.port.ConceptIndexingPort
import com.kgd.codedictionary.domain.index.model.CodeLocation
import com.kgd.codedictionary.domain.index.model.ConceptIndex
import org.slf4j.LoggerFactory
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service

@Service
class SyncService(
    private val conceptRepository: ConceptRepositoryPort,
    private val indexRepository: ConceptIndexRepositoryPort,
    private val indexingPort: ConceptIndexingPort
) {
    private val logger = LoggerFactory.getLogger(SyncService::class.java)

    fun syncAllToOpenSearch() {
        // 1. Create/update index with mappings
        indexingPort.createOrUpdateIndex()
        logger.info("OpenSearch index created/updated")

        // 2. Build synonym map from all concepts and update
        val concepts = conceptRepository.findAllWithSynonyms()
        val synonymMap = concepts.associate { it.conceptId to (it.synonyms + it.name) }
        indexingPort.updateSynonyms(synonymMap)
        logger.info("Synonyms updated: {} concepts", concepts.size)

        // 3. Bulk index all concept_index records with their concepts
        val allIndices = indexRepository.findAll(Pageable.unpaged())
        val conceptMap = concepts.associateBy { it.conceptId }
        val entries = allIndices.content.mapNotNull { idx ->
            conceptMap[idx.conceptId]?.let { concept -> concept to idx }
        }
        if (entries.isNotEmpty()) {
            indexingPort.bulkIndex(entries)
            logger.info("Bulk indexed {} concept-index entries", entries.size)
        }

        // 4. Also index concept-only documents (for concept search without code)
        // This allows searching for concepts even if no code is indexed yet
        val conceptOnlyEntries = concepts.map { concept ->
            concept to ConceptIndex.create(
                conceptId = concept.conceptId,
                location = CodeLocation(filePath = "N/A", lineStart = 1, lineEnd = 1),
                description = concept.description
            )
        }
        indexingPort.bulkIndex(conceptOnlyEntries)
        logger.info("Indexed {} concept-only entries for search", conceptOnlyEntries.size)
    }
}
