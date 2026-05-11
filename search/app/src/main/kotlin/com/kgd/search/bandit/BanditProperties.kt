package com.kgd.search.bandit

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "search.bandit")
data class BanditProperties(
    val enabled: Boolean = true,
    val topN: Int = 100,
    val priorAlpha: Double = 1.0,
    val priorBeta: Double = 9.0,
    val decayLambdaPerDay: Double = 0.02,
    val hybridWeight: Double = 0.8,
    val impressionThreshold: Long = 50,
    val sessionCacheSeconds: Long = 60,
    val categoryPriors: Map<String, String> = emptyMap()
) {
    fun priorFor(categoryId: String): Pair<Double, Double> {
        val raw = categoryPriors[categoryId] ?: return priorAlpha to priorBeta
        val parts = raw.split(",").map { it.trim() }
        if (parts.size != 2) return priorAlpha to priorBeta
        val a = parts[0].toDoubleOrNull() ?: return priorAlpha to priorBeta
        val b = parts[1].toDoubleOrNull() ?: return priorAlpha to priorBeta
        return a to b
    }

    init {
        require(topN > 0) { "topN must be > 0" }
        require(priorAlpha > 0.0 && priorBeta > 0.0) { "priors must be > 0" }
        require(decayLambdaPerDay >= 0.0) { "decay lambda must be >= 0" }
        require(hybridWeight in 0.0..1.0) { "hybridWeight must be in [0,1]" }
        require(impressionThreshold >= 0) { "impressionThreshold must be >= 0" }
        require(sessionCacheSeconds >= 0) { "sessionCacheSeconds must be >= 0" }
    }
}
