package com.kgd.analytics.infrastructure.streaming

import com.kgd.analytics.domain.model.SmoothingConfig
import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * ADR-0050 Phase 2 — CTR/CVR Bayesian smoothing 외부 설정.
 *
 * 예시 (application.yml):
 * ```
 * analytics:
 *   smoothing:
 *     enabled: true
 *     alpha: 1.0
 *     beta: 9.0
 * ```
 */
@ConfigurationProperties(prefix = "analytics.smoothing")
data class SmoothingProperties(
    val enabled: Boolean = false,
    val alpha: Double = 1.0,
    val beta: Double = 9.0
) {
    fun toConfig(): SmoothingConfig =
        if (enabled) SmoothingConfig(alpha = alpha, beta = beta) else SmoothingConfig.NONE
}
