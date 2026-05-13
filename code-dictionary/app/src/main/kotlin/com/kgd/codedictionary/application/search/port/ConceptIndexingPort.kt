package com.kgd.codedictionary.application.search.port

import com.kgd.codedictionary.domain.concept.model.Concept
import com.kgd.codedictionary.domain.index.model.ConceptIndex

interface ConceptIndexingPort {
    /** 단건/단일 변경: alias 를 통해 색인 (실시간 변경) */
    fun indexConceptIndex(concept: Concept, conceptIndex: ConceptIndex)

    /** 단건 삭제: alias 통해 */
    fun deleteByConceptId(conceptId: String)

    /** 풀 리인덱싱: 명시한 target index 에 bulk 색인 (alias swap 직전) */
    fun bulkIndex(targetIndex: String, entries: List<Pair<Concept, ConceptIndex>>)

    /** 풀 리인덱싱: 명시한 target index 의 synonym filter 갱신 */
    fun updateSynonyms(targetIndex: String, synonymMap: Map<String, List<String>>)
}
