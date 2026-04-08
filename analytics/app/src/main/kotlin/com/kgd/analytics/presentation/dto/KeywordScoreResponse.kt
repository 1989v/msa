package com.kgd.analytics.presentation.dto

import com.kgd.analytics.domain.model.KeywordScore
import java.time.Instant

data class KeywordScoreResponse(
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
        fun from(score: KeywordScore) = KeywordScoreResponse(
            keyword = score.keyword,
            searchCount = score.searchCount,
            totalClicks = score.totalClicks,
            totalOrders = score.totalOrders,
            ctr = score.ctr,
            cvr = score.cvr,
            score = score.score,
            updatedAt = score.updatedAt
        )
    }
}
