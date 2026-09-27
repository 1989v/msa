package com.kgd.codedictionary.presentation.graph.controller

import com.kgd.codedictionary.application.graph.dto.ConceptRelationsDto
import com.kgd.codedictionary.application.graph.usecase.ConceptRelationsUseCase
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/concepts")
class ConceptRelationsController(
    private val relations: ConceptRelationsUseCase,
) {
    /** 개념 하나의 이웃 전부 — 계층 응답 밖(다른 루트)의 간선까지. 도메인 간 탐색은 이것으로 한 홉씩 */
    @GetMapping("/{conceptId}/relations")
    fun getRelations(@PathVariable conceptId: String): ApiResponse<ConceptRelationsDto> =
        ApiResponse.success(relations.getRelations(conceptId))
}
