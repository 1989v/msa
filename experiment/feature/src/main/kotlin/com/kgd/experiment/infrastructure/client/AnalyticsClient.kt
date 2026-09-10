package com.kgd.experiment.infrastructure.client

import com.kgd.experiment.application.experiment.port.AnalyticsMetricsPort
import com.kgd.experiment.application.experiment.port.ExperimentMetrics
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import java.time.Instant

@Component
class AnalyticsClient(
    webClientBuilder: WebClient.Builder,
    @Value("\${analytics.service.url:http://localhost:8090}") private val baseUrl: String
) : AnalyticsMetricsPort {
    private val webClient = webClientBuilder.baseUrl(baseUrl).build()

    override fun getExperimentMetrics(experimentId: Long, start: Instant, end: Instant): ExperimentMetrics? {
        return webClient.get()
            .uri("/api/v1/analytics/experiments/{id}/metrics?start={start}&end={end}",
                experimentId, start.toString(), end.toString())
            .retrieve()
            .bodyToMono(ExperimentMetricsApiResponse::class.java)
            .block()
            ?.data
    }
}

data class ExperimentMetricsApiResponse(
    val success: Boolean = false,
    val data: ExperimentMetrics? = null,
    val error: Any? = null
)
