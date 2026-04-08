package com.kgd.analytics.application.usecase

import com.kgd.analytics.domain.model.ProductScore
import com.kgd.analytics.domain.port.ProductScoreRepositoryPort
import com.kgd.analytics.domain.port.ScoreCachePort
import org.springframework.stereotype.Service

@Service
class GetProductScoreUseCase(
    private val cache: ScoreCachePort,
    private val repository: ProductScoreRepositoryPort
) {
    fun execute(productId: Long): ProductScore? {
        cache.getProductScore(productId)?.let { return it }
        return repository.findByProductId(productId)?.also { cache.cacheProductScore(it) }
    }

    fun executeBulk(productIds: List<Long>): List<ProductScore> {
        if (productIds.isEmpty()) return emptyList()
        val cached = cache.getProductScores(productIds)
        val cachedIds = cached.map { it.productId }.toSet()
        val missingIds = productIds.filter { it !in cachedIds }
        if (missingIds.isEmpty()) return cached
        val fromDb = repository.findByProductIds(missingIds)
        fromDb.forEach { cache.cacheProductScore(it) }
        return cached + fromDb
    }
}
