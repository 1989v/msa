package com.kgd.analytics.domain.model

object ScoreNormalizer {
    fun normalize(
        value: Double,
        min: Double,
        max: Double,
        clipPercentile: Double = 0.95
    ): Double {
        val upperBound = max * clipPercentile
        if (upperBound <= min) return 0.0
        val clipped = value.coerceIn(min, upperBound)
        return (clipped - min) / (upperBound - min)
    }
}
