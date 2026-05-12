package com.kgd.recommendation.presentation

import com.kgd.common.response.ApiResponse
import com.kgd.recommendation.application.usecase.GetCategoryBestUseCase
import com.kgd.recommendation.presentation.dto.RecommendationDto
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/recommendations")
class RecommendationController(
    private val getCategoryBest: GetCategoryBestUseCase,
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
}
