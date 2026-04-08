package com.kgd.search.infrastructure.messaging

data class ScoreUpdateEvent(
    val productId: Long = 0,
    val popularityScore: Double = 0.0,
    val ctr: Double = 0.0,
    val cvr: Double = 0.0,
    val updatedAt: Long = 0
)
