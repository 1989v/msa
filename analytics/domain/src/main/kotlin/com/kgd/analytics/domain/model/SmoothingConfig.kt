package com.kgd.analytics.domain.model

/**
 * Bayesian smoothing prior for CTR/CVR.
 *
 * smoothedRate(clicks, impressions) = (clicks + alpha) / (impressions + alpha + beta)
 *
 * 의미:
 * - alpha: pseudo-clicks (prior success count)
 * - beta : pseudo-non-clicks (prior failure count)
 *
 * 디폴트 (alpha=1.0, beta=9.0) 는 10% CTR 가정의 약한 prior — sparse arm 의 분산을
 * 줄이되 충분한 impressions 가 쌓이면 빠르게 empirical rate 로 수렴한다.
 *
 * Phase 2.5 이후 category 별 empirical Bayes 로 대체 가능 (ADR-0050).
 */
data class SmoothingConfig(
    val alpha: Double = 1.0,
    val beta: Double = 9.0
) {
    init {
        require(alpha > 0.0 && beta > 0.0) { "alpha/beta must be > 0" }
    }

    fun smooth(numerator: Long, denominator: Long): Double {
        require(numerator >= 0 && denominator >= 0) { "counts must be >= 0" }
        return (numerator + alpha) / (denominator + alpha + beta)
    }

    companion object {
        val NONE = SmoothingConfig(alpha = 1e-9, beta = 1e-9) // 실질적으로 raw 값과 동일
    }
}
