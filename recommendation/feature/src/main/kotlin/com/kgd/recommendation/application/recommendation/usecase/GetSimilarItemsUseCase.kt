package com.kgd.recommendation.application.recommendation.usecase

import com.kgd.recommendation.domain.recommendation.model.Recommendation

/** Item-Item CF 유사 상품 (Phase 2). sparse 하면 Category Best 로 보완 */
interface GetSimilarItemsUseCase {
    fun execute(query: Query): Recommendation

    data class Query(val itemId: Long, val limit: Int)

    companion object {
        const val MAX_LIMIT = 100
    }
}
