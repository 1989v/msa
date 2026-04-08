package com.kgd.analytics.presentation.dto

import com.kgd.analytics.domain.model.ProductScore
import java.time.Instant

data class ProductScoreResponse(
    val productId: Long,
    val impressions: Long,
    val clicks: Long,
    val orders: Long,
    val ctr: Double,
    val cvr: Double,
    val popularityScore: Double,
    val updatedAt: Instant
) {
    companion object {
        fun from(score: ProductScore) = ProductScoreResponse(
            productId = score.productId,
            impressions = score.impressions,
            clicks = score.clicks,
            orders = score.orders,
            ctr = score.ctr,
            cvr = score.cvr,
            popularityScore = score.popularityScore,
            updatedAt = score.updatedAt
        )
    }
}
