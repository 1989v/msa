package com.kgd.recommendation.application.recommendation.usecase

import com.kgd.recommendation.domain.recommendation.model.Recommendation

/** Two-Tower retrieval + Wide & Deep ranking + A/B·밴딧 variant 분기 (Phase 3~6) */
interface GetPersonalizedUseCase {
    fun execute(query: Query): Recommendation

    data class Query(val userId: Long, val limit: Int, val defaultCityId: Long = 1, val defaultCategoryId: Long = 1)

    companion object {
        const val MAX_LIMIT = 100
        const val MIN_ACTIONS_FOR_PERSONALIZED = 5L
        const val RETRIEVAL_K_DEFAULT = 100
        const val DEFAULT_VARIANT = "retrieval-and-rank"
    }
}
