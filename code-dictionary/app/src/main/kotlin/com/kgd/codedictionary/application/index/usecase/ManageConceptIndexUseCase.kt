package com.kgd.codedictionary.application.index.usecase

import com.kgd.codedictionary.application.index.dto.CreateIndexCommand
import com.kgd.codedictionary.application.index.dto.IndexResultDto
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

/** 개념 색인 항목 등록·조회. */
interface ManageConceptIndexUseCase {
    fun create(command: CreateIndexCommand): IndexResultDto
    fun findByConceptId(conceptId: String, pageable: Pageable): Page<IndexResultDto>
    fun count(): Long
}
