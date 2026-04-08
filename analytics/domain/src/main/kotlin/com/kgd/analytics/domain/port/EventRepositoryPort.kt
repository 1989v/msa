package com.kgd.analytics.domain.port

import com.kgd.common.analytics.AnalyticsEvent
import java.time.Instant

interface EventRepositoryPort {
    fun saveEvents(events: List<AnalyticsEvent>)
    fun queryExperimentMetrics(
        experimentId: Long,
        startTime: Instant,
        endTime: Instant
    ): List<ExperimentMetricRow>
}

data class ExperimentMetricRow(
    val variantName: String,
    val eventType: String,
    val eventCount: Long
)
