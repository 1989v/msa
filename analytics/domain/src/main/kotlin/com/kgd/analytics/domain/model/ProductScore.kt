package com.kgd.analytics.domain.model

import java.time.Instant

data class ProductScore(
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
        private const val VIEW_WEIGHT = 1.0
        private const val CLICK_WEIGHT = 3.0
        private const val ORDER_WEIGHT = 10.0

        fun compute(
            productId: Long,
            impressions: Long,
            clicks: Long,
            orders: Long,
            normalizer: (Double) -> Double = { it }
        ): ProductScore {
            val ctr = if (impressions > 0) clicks.toDouble() / impressions else 0.0
            val cvr = if (clicks > 0) orders.toDouble() / clicks else 0.0
            val rawPopularity = impressions * VIEW_WEIGHT + clicks * CLICK_WEIGHT + orders * ORDER_WEIGHT
            val popularityScore = normalizer(rawPopularity)

            return ProductScore(
                productId = productId,
                impressions = impressions,
                clicks = clicks,
                orders = orders,
                ctr = ctr,
                cvr = cvr,
                popularityScore = popularityScore,
                updatedAt = Instant.now()
            )
        }
    }
}
