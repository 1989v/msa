package com.kgd.codedictionary.application.index.port

import com.kgd.codedictionary.domain.index.model.ConceptIndex
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface ConceptIndexRepositoryPort {
    fun save(conceptIndex: ConceptIndex): ConceptIndex
    fun saveAll(indices: List<ConceptIndex>): List<ConceptIndex>
    fun findById(id: Long): ConceptIndex?
    fun findByConceptId(conceptId: String, pageable: Pageable): Page<ConceptIndex>
    fun findAll(pageable: Pageable): Page<ConceptIndex>
    fun deleteByConceptId(conceptId: String)
    fun deleteByFilePath(filePath: String)
    fun count(): Long
    fun findByConceptId(conceptId: String): List<ConceptIndex>
    fun findAll(): List<ConceptIndex>
}
