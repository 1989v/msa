package com.kgd.recommendation.infrastructure.client

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestTemplate

/**
 * Phase 4.5 — experiment 서비스의 bucket assignment 호출.
 *
 * 실패 시 null → 호출자가 default variant 적용 (graceful degradation).
 *
 * 실험 ID 와 변형 (variant) 키는 운영자가 experiment 서비스에 등록 후 정의:
 *   recommendation.experiment.id = 1
 *   recommendation.experiment.variants = control | retrieval-only | retrieval-and-rank
 */
@Component
class RecommendationExperimentClient(
    @Value("\${recommendation.experiment.url:http://experiment:8091}") private val experimentUrl: String,
) {
    private val logger = KotlinLogging.logger {}

    private val restTemplate: RestTemplate = RestTemplate(
        SimpleClientHttpRequestFactory().apply {
            setConnectTimeout(300)
            setReadTimeout(1000)
        }
    )

    fun getVariant(experimentId: Long, userId: Long): String? {
        return try {
            val response = restTemplate.getForObject(
                "$experimentUrl/api/v1/experiments/$experimentId/assignment?userId=$userId",
                AssignmentApiResponse::class.java,
            )
            val variant = response?.data?.variant
            if (variant.isNullOrBlank()) null else variant
        } catch (e: Exception) {
            logger.debug { "experiment 호출 실패 (id=$experimentId, userId=$userId): ${e.message}" }
            null
        }
    }

    data class AssignmentApiResponse(
        val success: Boolean = false,
        val data: AssignmentData? = null,
    )

    data class AssignmentData(
        val experimentId: Long = 0,
        val userId: String = "",
        val variant: String? = null,
    )
}
