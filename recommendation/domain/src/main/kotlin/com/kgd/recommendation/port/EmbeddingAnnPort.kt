package com.kgd.recommendation.port

import com.kgd.recommendation.recommendation.RecommendationItem

/**
 * Phase 3 — Two-Tower retrieval 결과를 가져오는 port.
 *
 * 구현체 (Phase 3 PoC) 는 recommendation-ann Python sidecar 를 REST 호출.
 * recommendation-ann 이 user_id 로 user_tower forward → FAISS HNSW Top-K 검색.
 */
interface EmbeddingAnnPort {
    /**
     * user 의 retrieval 후보 Top-K. 결과가 비어있을 수 있음 — 호출자가 fallback 결정.
     */
    fun retrievePersonalized(userId: Long, k: Int): List<RecommendationItem>
}
