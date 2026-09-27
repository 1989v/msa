package com.kgd.codedictionary.application.concept.port

import com.kgd.codedictionary.domain.concept.model.Concept
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface ConceptRepositoryPort {
    fun save(concept: Concept): Concept
    fun findById(id: Long): Concept?
    fun findByConceptId(conceptId: String): Concept?
    fun findAll(pageable: Pageable): Page<Concept>
    fun findByCategory(category: ConceptCategory, pageable: Pageable): Page<Concept>
    fun findByLevel(level: ConceptLevel, pageable: Pageable): Page<Concept>
    fun findAllWithSynonyms(): List<Concept>
    fun delete(id: Long)
    fun existsByConceptId(conceptId: String): Boolean
    fun findAllList(): List<Concept>

    /**
     * 개념 화면의 이웃 — 동의어 · 옛 관계 없이 칸만 id 목록만큼 읽는다. [findAllList] 의 EAGER 로드는
     * 개념마다 추가 쿼리가 나가 수천 개에서 수십 초가 걸린다.
     */
    fun findSummariesByConceptIds(conceptIds: Collection<String>): List<Concept>
}
