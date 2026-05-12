package com.kgd.recommendation.port

import com.kgd.recommendation.recommendation.RecommendationItem

/**
 * Item-Item CF (Phase 2) 의 조회 port.
 *
 * 사전 계산된 유사도 Top-K 를 lookup 한다. 비어있으면 빈 list (cold-start fallback 은 use case 가 처리).
 */
interface ItemSimilarityPort {
    fun findSimilar(itemId: Long, limit: Int): List<RecommendationItem>
}
