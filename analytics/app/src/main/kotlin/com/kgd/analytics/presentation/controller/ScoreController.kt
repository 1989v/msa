package com.kgd.analytics.presentation.controller

import com.kgd.analytics.application.usecase.GetKeywordScoreUseCase
import com.kgd.analytics.application.usecase.GetProductScoreUseCase
import com.kgd.analytics.presentation.dto.KeywordScoreResponse
import com.kgd.analytics.presentation.dto.ProductScoreResponse
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/scores")
class ScoreController(
    private val getProductScore: GetProductScoreUseCase,
    private val getKeywordScore: GetKeywordScoreUseCase
) {
    @GetMapping("/products/{productId}")
    fun getProductScore(@PathVariable productId: Long): ApiResponse<ProductScoreResponse> {
        val score = getProductScore.execute(productId)
            ?: return ApiResponse.success()
        return ApiResponse.success(ProductScoreResponse.from(score))
    }

    @GetMapping("/products/bulk")
    fun getBulkProductScores(@RequestParam ids: List<Long>): ApiResponse<List<ProductScoreResponse>> {
        val scores = getProductScore.executeBulk(ids)
        return ApiResponse.success(scores.map { ProductScoreResponse.from(it) })
    }

    @GetMapping("/keywords/{keyword}")
    fun getKeywordScore(@PathVariable keyword: String): ApiResponse<KeywordScoreResponse> {
        val score = getKeywordScore.execute(keyword)
            ?: return ApiResponse.success()
        return ApiResponse.success(KeywordScoreResponse.from(score))
    }
}
