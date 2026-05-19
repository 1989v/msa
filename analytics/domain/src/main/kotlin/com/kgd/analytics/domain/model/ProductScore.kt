package com.kgd.analytics.domain.model

import java.time.Instant

/**
 * 시간 윈도우 단위 (default 1h) 상품 지표 스냅샷.
 *
 * Phase 2 (ADR-0050) 확장:
 * - ctr/cvr : Bayesian-smoothed 값 (smoothing config 적용)
 * - ctrRaw/cvrRaw : 원시 비율 (디버그/평가 용)
 * - gmv1h : 해당 윈도우의 GMV 합 (orders 의 amount 합)
 *
 * 7d/30d GMV 는 [ProductScore] 자체에는 없고 repository.findGmvSince 로 별도 조회.
 */
data class ProductScore(
    val productId: Long,
    val impressions: Long,
    val clicks: Long,
    val orders: Long,
    val ctr: Double,
    val cvr: Double,
    val ctrRaw: Double,
    val cvrRaw: Double,
    val popularityScore: Double,
    val gmv1h: Double,
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
            gmv1h: Double = 0.0,
            smoothing: SmoothingConfig = SmoothingConfig.NONE,
            normalizer: (Double) -> Double = { it }
        ): ProductScore {
            val ctrRaw = if (impressions > 0) clicks.toDouble() / impressions else 0.0
            val cvrRaw = if (clicks > 0) orders.toDouble() / clicks else 0.0
            val ctr = smoothing.smooth(clicks, impressions)
            val cvr = smoothing.smooth(orders, clicks)
            val rawPopularity = impressions * VIEW_WEIGHT + clicks * CLICK_WEIGHT + orders * ORDER_WEIGHT
            val popularityScore = normalizer(rawPopularity)

            return ProductScore(
                productId = productId,
                impressions = impressions,
                clicks = clicks,
                orders = orders,
                ctr = ctr,
                cvr = cvr,
                ctrRaw = ctrRaw,
                cvrRaw = cvrRaw,
                popularityScore = popularityScore,
                gmv1h = gmv1h,
                updatedAt = Instant.now()
            )
        }
    }
}
