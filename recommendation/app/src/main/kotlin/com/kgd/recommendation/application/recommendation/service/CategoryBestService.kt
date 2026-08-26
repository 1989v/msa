package com.kgd.recommendation.application.recommendation.service

import com.kgd.recommendation.application.recommendation.port.RecommendationRepository
import com.kgd.recommendation.application.recommendation.usecase.GetCategoryBestUseCase
import com.kgd.recommendation.application.recommendation.usecase.GetCategoryBestUseCase.Companion.MAX_LIMIT
import com.kgd.recommendation.domain.recommendation.model.Recommendation
import org.springframework.stereotype.Service

@Service
class CategoryBestService(
    private val repository: RecommendationRepository,
) : GetCategoryBestUseCase {
    override fun execute(query: GetCategoryBestUseCase.Query): Recommendation {
        val (cityId, categoryId, limit) = query
        require(limit in 1..MAX_LIMIT) { "limit must be in 1..$MAX_LIMIT, got $limit" }
        require(cityId > 0) { "cityId must be > 0, got $cityId" }
        require(categoryId > 0) { "categoryId must be > 0, got $categoryId" }

        return repository.findCategoryBest(cityId, categoryId, limit)
    }
}
