package com.kgd.recommendation.port

import com.kgd.recommendation.recommendation.RecommendationItem

/**
 * Phase 4 + 5 — Funnel Stage 2 Ranking (Wide & Deep / DLRM).
 *
 * Retrieval (Phase 3) 결과를 정밀 재정렬. Ranker 미배치/실패 시 입력 순서 유지.
 */
interface RankingPort {
    /**
     * @param userId        타깃 사용자
     * @param userCity      사용자 컨텍스트 city (0 = unknown)
     * @param candidates    Retrieval 결과 (Top-100 권장)
     * @param k             최종 Top-K 반환 수
     * @param rankerType    "wide_and_deep" (Phase 4) 또는 "dlrm" (Phase 5)
     */
    fun rerank(
        userId: Long,
        userCity: Long,
        candidates: List<RecommendationItem>,
        k: Int,
        rankerType: String = "wide_and_deep",
    ): List<RecommendationItem>
}
