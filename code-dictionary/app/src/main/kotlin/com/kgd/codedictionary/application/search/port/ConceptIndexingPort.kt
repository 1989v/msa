package com.kgd.codedictionary.application.search.port

import com.kgd.codedictionary.domain.concept.model.Concept
import com.kgd.codedictionary.domain.index.model.ConceptIndex

interface ConceptIndexingPort {
    fun indexConceptIndex(concept: Concept, conceptIndex: ConceptIndex)
    fun bulkIndex(entries: List<Pair<Concept, ConceptIndex>>)
    fun deleteByConceptId(conceptId: String)
    fun createOrUpdateIndex()
    fun updateSynonyms(synonymMap: Map<String, List<String>>)
}
