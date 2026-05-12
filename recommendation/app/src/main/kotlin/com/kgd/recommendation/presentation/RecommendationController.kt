package com.kgd.recommendation.presentation

import com.kgd.common.response.ApiResponse
import com.kgd.recommendation.application.usecase.GetCategoryBestUseCase
import com.kgd.recommendation.application.usecase.GetSimilarItemsUseCase
import com.kgd.recommendation.presentation.dto.RecommendationDto
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/recommendations")
class RecommendationController(
    private val getCategoryBest: GetCategoryBestUseCase,
    private val getSimilarItems: GetSimilarItemsUseCase,
) {
    /**
     * 도시 × 카테고리 단위 인기 추천 Top-N.
     *
     * Phase 1 (ADR-0044) — 룰 기반 행동 가중합 + Wilson LCB.
     */
    @GetMapping("/category-best")
    fun categoryBest(
        @RequestParam cityId: Long,
        @RequestParam categoryId: Long,
        @RequestParam(defaultValue = "20") limit: Int,
    ): ApiResponse<RecommendationDto> {
        val result = getCategoryBest.execute(cityId, categoryId, limit)
        return ApiResponse.success(RecommendationDto.from(result))
    }

    /**
     * 특정 item 과 유사한 상품 Top-N.
     *
     * Phase 2 (ADR-0044) — Item-Item CF (PPMI). Sparse 시 Category Best 로 fallback.
     */
    @GetMapping("/similar-items")
    fun similarItems(
        @RequestParam itemId: Long,
        @RequestParam(defaultValue = "20") limit: Int,
    ): ApiResponse<RecommendationDto> {
        val result = getSimilarItems.execute(itemId, limit)
        return ApiResponse.success(RecommendationDto.from(result))
    }
}
