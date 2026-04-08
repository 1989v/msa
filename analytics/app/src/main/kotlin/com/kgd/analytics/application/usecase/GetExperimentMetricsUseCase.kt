package com.kgd.analytics.application.usecase

import com.kgd.analytics.domain.port.EventRepositoryPort
import com.kgd.analytics.domain.port.ExperimentMetricRow
import org.springframework.stereotype.Service
import java.time.Instant

@Service
class GetExperimentMetricsUseCase(
    private val eventRepository: EventRepositoryPort
) {
    fun execute(experimentId: Long, start: Instant, end: Instant): List<ExperimentMetricRow> =
        eventRepository.queryExperimentMetrics(experimentId, start, end)
}
