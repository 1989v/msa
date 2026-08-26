package com.kgd.codedictionary.application.concept.usecase

import com.kgd.codedictionary.application.concept.dto.ConceptDetailDto
import com.kgd.codedictionary.application.concept.dto.ConceptResultDto
import com.kgd.codedictionary.application.concept.dto.CreateConceptCommand
import com.kgd.codedictionary.application.concept.dto.UpdateConceptCommand
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

/** 개념 사전 CRUD + 상세 조회. */
interface ConceptCatalogUseCase {
    fun create(command: CreateConceptCommand): ConceptResultDto
    fun findById(id: Long): ConceptResultDto
    fun findAll(category: ConceptCategory?, level: ConceptLevel?, pageable: Pageable): Page<ConceptResultDto>
    fun update(id: Long, command: UpdateConceptCommand): ConceptResultDto
    fun delete(id: Long)
    fun findByConceptIdDetail(conceptId: String): ConceptDetailDto
}
