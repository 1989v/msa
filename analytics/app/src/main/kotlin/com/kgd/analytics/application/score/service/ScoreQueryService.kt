package com.kgd.analytics.application.score.service

import com.kgd.analytics.application.score.port.KeywordScoreRepositoryPort
import com.kgd.analytics.application.score.port.ProductScoreRepositoryPort
import com.kgd.analytics.application.score.port.ScoreCachePort
import com.kgd.analytics.application.score.usecase.GetKeywordScoreUseCase
import com.kgd.analytics.application.score.usecase.GetProductScoreUseCase
import com.kgd.analytics.application.score.usecase.GetProductScoresUseCase
import com.kgd.analytics.domain.model.KeywordScore
import com.kgd.analytics.domain.model.ProductScore
import org.springframework.stereotype.Service

@Service
class ScoreQueryService(
    private val cache: ScoreCachePort,
    private val productRepository: ProductScoreRepositoryPort,
    private val keywordRepository: KeywordScoreRepositoryPort,
) : GetProductScoreUseCase, GetProductScoresUseCase, GetKeywordScoreUseCase {

    override fun execute(productId: Long): ProductScore? {
        cache.getProductScore(productId)?.let { return it }
        return productRepository.findByProductId(productId)?.also { cache.cacheProductScore(it) }
    }

    override fun execute(productIds: List<Long>): List<ProductScore> {
        if (productIds.isEmpty()) return emptyList()
        val cached = cache.getProductScores(productIds)
        val cachedIds = cached.map { it.productId }.toSet()
        val missingIds = productIds.filter { it !in cachedIds }
        if (missingIds.isEmpty()) return cached
        val fromDb = productRepository.findByProductIds(missingIds)
        fromDb.forEach { cache.cacheProductScore(it) }
        return cached + fromDb
    }

    override fun execute(keyword: String): KeywordScore? {
        cache.getKeywordScore(keyword)?.let { return it }
        return keywordRepository.findByKeyword(keyword)?.also { cache.cacheKeywordScore(it) }
    }
}
