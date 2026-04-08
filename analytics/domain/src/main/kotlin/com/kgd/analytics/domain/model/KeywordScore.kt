package com.kgd.analytics.domain.model

import java.time.Instant

data class KeywordScore(
    val keyword: String,
    val searchCount: Long,
    val totalClicks: Long,
    val totalOrders: Long,
    val ctr: Double,
    val cvr: Double,
    val score: Double,
    val updatedAt: Instant
) {
    companion object {
        private const val SEARCH_WEIGHT = 1.0
        private const val CTR_WEIGHT = 5.0
        private const val CVR_WEIGHT = 10.0

        fun compute(
            keyword: String,
            searchCount: Long,
            totalClicks: Long,
            totalOrders: Long,
            normalizer: (Double) -> Double = { it }
        ): KeywordScore {
            val ctr = if (searchCount > 0) totalClicks.toDouble() / searchCount else 0.0
            val cvr = if (totalClicks > 0) totalOrders.toDouble() / totalClicks else 0.0
            val rawScore = searchCount * SEARCH_WEIGHT + ctr * CTR_WEIGHT + cvr * CVR_WEIGHT
            val score = normalizer(rawScore)

            return KeywordScore(
                keyword = keyword,
                searchCount = searchCount,
                totalClicks = totalClicks,
                totalOrders = totalOrders,
                ctr = ctr,
                cvr = cvr,
                score = score,
                updatedAt = Instant.now()
            )
        }
    }
}
