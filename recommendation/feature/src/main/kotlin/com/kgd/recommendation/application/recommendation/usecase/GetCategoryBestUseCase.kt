package com.kgd.recommendation.application.recommendation.usecase

import com.kgd.recommendation.domain.recommendation.model.Recommendation

/** 도시 × 카테고리 인기 Top-N (Phase 1, ADR-0044) */
interface GetCategoryBestUseCase {
    fun execute(query: Query): Recommendation

    data class Query(val cityId: Long, val categoryId: Long, val limit: Int)

    companion object {
        const val MAX_LIMIT = 100
    }
}
