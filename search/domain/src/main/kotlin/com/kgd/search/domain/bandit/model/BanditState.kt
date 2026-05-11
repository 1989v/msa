package com.kgd.search.domain.bandit.model

import java.time.Instant

data class BanditState(
    val key: BanditKey,
    val clicks: Long,
    val impressions: Long,
    val lastUpdatedAt: Instant
) {
    init {
        require(clicks >= 0) { "clicks must be non-negative: $clicks" }
        require(impressions >= clicks) {
            "impressions must be >= clicks: impressions=$impressions, clicks=$clicks"
        }
    }

    fun ageDays(now: Instant): Double {
        val seconds = (now.toEpochMilli() - lastUpdatedAt.toEpochMilli()) / 1000.0
        return seconds / 86_400.0
    }

    companion object {
        fun empty(key: BanditKey, now: Instant = Instant.now()): BanditState =
            BanditState(key = key, clicks = 0, impressions = 0, lastUpdatedAt = now)
    }
}
