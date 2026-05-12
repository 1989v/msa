package com.kgd.recommendation.recommendation

import java.time.Instant

/**
 * 추천 결과 Aggregate Root.
 *
 * Phase 별 use case 가 생성하며, 항상 score 내림차순으로 정렬된 items 를 보유한다.
 */
data class Recommendation(
    val type: RecommendationType,
    val userId: Long?,
    val context: RecommendationContext,
    val items: List<RecommendationItem>,
    val generatedAt: Instant,
) {
    /** Top-K 만 잘라낸 새 Recommendation 을 반환. */
    fun topK(k: Int): Recommendation {
        require(k >= 0) { "k must be >= 0, got $k" }
        return copy(items = items.sortedByDescending { it.score }.take(k))
    }

    /** 결과가 충분치 않은지 (fallback 트리거 판단용). */
    fun isInsufficient(requiredLimit: Int): Boolean = items.size < requiredLimit
}
