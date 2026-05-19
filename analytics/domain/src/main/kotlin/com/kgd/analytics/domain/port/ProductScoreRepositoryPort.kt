package com.kgd.analytics.domain.port

import com.kgd.analytics.domain.model.ProductScore
import java.time.Duration

interface ProductScoreRepositoryPort {
    fun save(score: ProductScore)
    fun findByProductId(productId: Long): ProductScore?
    fun findByProductIds(productIds: List<Long>): List<ProductScore>

    /** [productId] 의 [duration] 기간 누적 GMV 합. 데이터 없으면 0.0. ADR-0050 Phase 2 */
    fun findGmvSince(productId: Long, duration: Duration): Double
}
