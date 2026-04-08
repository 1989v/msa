package com.kgd.analytics.domain.port

import com.kgd.analytics.domain.model.ProductScore

interface ProductScoreRepositoryPort {
    fun save(score: ProductScore)
    fun findByProductId(productId: Long): ProductScore?
    fun findByProductIds(productIds: List<Long>): List<ProductScore>
}
