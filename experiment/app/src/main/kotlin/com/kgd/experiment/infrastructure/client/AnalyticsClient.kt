package com.kgd.experiment.infrastructure.client

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import java.time.Instant

@Component
class AnalyticsClient(
    webClientBuilder: WebClient.Builder,
    @Value("\${analytics.service.url:http://localhost:8090}") private val baseUrl: String
) {
    private val webClient = webClientBuilder.baseUrl(baseUrl).build()

    fun getExperimentMetrics(experimentId: Long, start: Instant, end: Instant): ExperimentMetricsDto? {
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
    val data: ExperimentMetricsDto? = null,
    val error: Any? = null
)

data class ExperimentMetricsDto(
    val experimentId: Long = 0,
    val variants: List<VariantMetricsDto> = emptyList()
)

data class VariantMetricsDto(
    val variantName: String = "",
    val impressions: Long = 0,
    val clicks: Long = 0,
    val orders: Long = 0,
    val ctr: Double = 0.0,
    val cvr: Double = 0.0
)
