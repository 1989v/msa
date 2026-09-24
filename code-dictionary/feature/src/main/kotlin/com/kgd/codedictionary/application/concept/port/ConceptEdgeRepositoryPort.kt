package com.kgd.codedictionary.application.concept.port

import com.kgd.codedictionary.domain.concept.model.ConceptEdge

interface ConceptEdgeRepositoryPort {
    /** 전량 — 층 계산은 메모리에서 한다 */
    fun findAll(): List<ConceptEdge>

    /** 개념 하나에 닿는 간선(나가는 · 들어오는) — 개념 화면 한 번에 전량을 읽지 않는다 */
    fun findTouching(conceptId: String): List<ConceptEdge>
}
