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
     * 계층 · 아틀라스용 — 동의어 · 옛 관계 없이 칸만 읽는다. 개념이 수천 개라 [findAllList] 의 EAGER 로드는
     * 개념마다 추가 쿼리가 나가 수십 초가 걸린다.
     */
    fun findAllSummaries(): List<Concept>
}
