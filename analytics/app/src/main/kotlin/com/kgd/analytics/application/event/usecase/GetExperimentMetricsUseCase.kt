package com.kgd.analytics.application.event.usecase

import com.kgd.analytics.application.event.port.ExperimentMetricRow
import java.time.Instant

interface GetExperimentMetricsUseCase {
    fun execute(query: Query): List<ExperimentMetricRow>

    data class Query(val experimentId: Long, val start: Instant, val end: Instant)
}
