package com.kgd.search.infrastructure.client

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestTemplate

/**
 * ADR-0050 Phase 4 후속 — 검색 랭킹 온라인 A/B 를 위한 experiment 서비스 bucket assignment 호출.
 *
 * 실패/타임아웃 시 null → 호출자가 기본 ranking 적용 (graceful degradation).
 * 검색 P99 보호를 위해 connect 300ms / read 1000ms 로 제한 (recommendation 의
 * RecommendationExperimentClient 와 동일 패턴).
 */
@Component
class SearchExperimentClient(
    private val properties: SearchExperimentProperties,
) {
    private val log = KotlinLogging.logger {}

    private val restTemplate: RestTemplate = RestTemplate(
        SimpleClientHttpRequestFactory().apply {
            setConnectTimeout(300)
            setReadTimeout(1000)
        }
    )

    fun getVariant(experimentId: Long, userId: String): String? {
        return try {
            val response = restTemplate.getForObject(
                "${properties.url}/api/v1/experiments/$experimentId/assignment?userId=$userId",
                AssignmentApiResponse::class.java,
            )
            val variant = response?.data?.variant
            if (variant.isNullOrBlank()) null else variant
        } catch (e: Exception) {
            log.debug { "experiment 호출 실패 (id=$experimentId, userId=$userId): ${e.message}" }
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

/**
 * 검색 온라인 A/B 설정. 운영자가 experiment 서비스에 실험 등록 후:
 *   search.experiment.enabled = true
 *   search.experiment.id = {experimentId}
 * variant 키는 `search.ranking-variants.variants` 의 키와 일치해야 하며,
 * 미정의 키 (control 등) 는 기본 ranking 으로 동작한다.
 */
@ConfigurationProperties(prefix = "search.experiment")
data class SearchExperimentProperties(
    val enabled: Boolean = false,
    val id: Long = 0,
    val url: String = "http://experiment:8091",
)
