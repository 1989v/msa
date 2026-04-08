package com.kgd.analytics.infrastructure.messaging

data class ScoreUpdateEvent(
    val productId: Long,
    val popularityScore: Double,
    val ctr: Double,
    val cvr: Double,
    val updatedAt: Long
)
