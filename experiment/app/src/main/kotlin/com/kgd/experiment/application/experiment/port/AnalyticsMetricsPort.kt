package com.kgd.experiment.application.experiment.port

import java.time.Instant

/** analytics 서비스의 실험 지표 조회. 실패는 null — 결과 화면이 지표 없이도 열려야 한다 */
interface AnalyticsMetricsPort {
    fun getExperimentMetrics(experimentId: Long, start: Instant, end: Instant): ExperimentMetrics?
}

data class ExperimentMetrics(
    val experimentId: Long = 0,
    val variants: List<VariantMetrics> = emptyList(),
)

data class VariantMetrics(
    val variantName: String = "",
    val impressions: Long = 0,
    val clicks: Long = 0,
    val orders: Long = 0,
    val ctr: Double = 0.0,
    val cvr: Double = 0.0,
)
