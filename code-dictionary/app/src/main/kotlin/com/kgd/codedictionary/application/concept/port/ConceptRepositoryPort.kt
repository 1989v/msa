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
}
