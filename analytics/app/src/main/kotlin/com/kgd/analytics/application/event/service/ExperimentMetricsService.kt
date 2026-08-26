package com.kgd.analytics.application.event.service

import com.kgd.analytics.application.event.port.EventRepositoryPort
import com.kgd.analytics.application.event.port.ExperimentMetricRow
import com.kgd.analytics.application.event.usecase.GetExperimentMetricsUseCase
import org.springframework.stereotype.Service

@Service
class ExperimentMetricsService(
    private val eventRepository: EventRepositoryPort
) : GetExperimentMetricsUseCase {
    override fun execute(query: GetExperimentMetricsUseCase.Query): List<ExperimentMetricRow> =
        eventRepository.queryExperimentMetrics(query.experimentId, query.start, query.end)
}
