package com.kgd.codedictionary.application.concept.port

import com.kgd.codedictionary.domain.concept.model.ConceptEdge

interface ConceptEdgeRepositoryPort {
    /** 전량 — 개념 수백 개 규모라 층 계산은 메모리에서 한다 */
    fun findAll(): List<ConceptEdge>
}
