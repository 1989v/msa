package com.kgd.analytics.domain.port

import com.kgd.analytics.domain.model.KeywordScore
import com.kgd.analytics.domain.model.ProductScore
import com.kgd.analytics.domain.model.ScoreStats

interface ScoreCachePort {
    fun cacheProductScore(score: ProductScore)
    fun getProductScore(productId: Long): ProductScore?
    fun getProductScores(productIds: List<Long>): List<ProductScore>
    fun cacheKeywordScore(score: KeywordScore)
    fun getKeywordScore(keyword: String): KeywordScore?
    fun updateProductStats(stats: ScoreStats)
    fun getProductStats(): ScoreStats?
    fun updateKeywordStats(stats: ScoreStats)
    fun getKeywordStats(): ScoreStats?
}
