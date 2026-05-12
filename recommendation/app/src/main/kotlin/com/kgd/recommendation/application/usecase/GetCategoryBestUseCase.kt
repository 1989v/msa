package com.kgd.recommendation.application.usecase

import com.kgd.recommendation.port.RecommendationRepository
import com.kgd.recommendation.recommendation.Recommendation
import org.springframework.stereotype.Service

@Service
class GetCategoryBestUseCase(
    private val repository: RecommendationRepository,
) {
    fun execute(cityId: Long, categoryId: Long, limit: Int): Recommendation {
        require(limit in 1..MAX_LIMIT) { "limit must be in 1..$MAX_LIMIT, got $limit" }
        require(cityId > 0) { "cityId must be > 0, got $cityId" }
        require(categoryId > 0) { "categoryId must be > 0, got $categoryId" }

        return repository.findCategoryBest(cityId, categoryId, limit)
    }

    companion object {
        const val MAX_LIMIT = 100
    }
}
