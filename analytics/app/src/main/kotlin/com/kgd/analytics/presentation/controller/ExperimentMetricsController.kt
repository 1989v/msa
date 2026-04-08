package com.kgd.analytics.presentation.controller

import com.kgd.analytics.application.usecase.GetExperimentMetricsUseCase
import com.kgd.analytics.presentation.dto.ExperimentMetricsResponse
import com.kgd.analytics.presentation.dto.VariantMetrics
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

@RestController
@RequestMapping("/api/v1/analytics/experiments")
class ExperimentMetricsController(
    private val getMetrics: GetExperimentMetricsUseCase
) {
    @GetMapping("/{experimentId}/metrics")
    fun getExperimentMetrics(
        @PathVariable experimentId: Long,
        @RequestParam start: Instant,
        @RequestParam end: Instant
    ): ApiResponse<ExperimentMetricsResponse> {
        val rows = getMetrics.execute(experimentId, start, end)

        val variants = rows.groupBy { it.variantName }.map { (variant, metrics) ->
            val impressions = metrics.find { it.eventType == "PRODUCT_VIEW" }?.eventCount ?: 0
            val clicks = metrics.find { it.eventType == "PRODUCT_CLICK" }?.eventCount ?: 0
            val orders = metrics.find { it.eventType == "ORDER_COMPLETE" }?.eventCount ?: 0
            VariantMetrics(
                variantName = variant,
                impressions = impressions,
                clicks = clicks,
                orders = orders,
                ctr = if (impressions > 0) clicks.toDouble() / impressions else 0.0,
                cvr = if (clicks > 0) orders.toDouble() / clicks else 0.0
            )
        }

        return ApiResponse.success(ExperimentMetricsResponse(experimentId, variants))
    }
}
