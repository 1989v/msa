package com.kgd.analytics.presentation.dto

data class ExperimentMetricsResponse(
    val experimentId: Long,
    val variants: List<VariantMetrics>
)

data class VariantMetrics(
    val variantName: String,
    val impressions: Long,
    val clicks: Long,
    val orders: Long,
    val ctr: Double,
    val cvr: Double
)
