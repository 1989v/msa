package com.kgd.codedictionary.application.graph.usecase

import com.kgd.codedictionary.application.graph.dto.ConceptRelationsDto

/** 개념 하나의 이웃 — 나가는·들어오는 간선, 근거, 질문 */
interface ConceptRelationsUseCase {
    fun getRelations(conceptId: String): ConceptRelationsDto
}
