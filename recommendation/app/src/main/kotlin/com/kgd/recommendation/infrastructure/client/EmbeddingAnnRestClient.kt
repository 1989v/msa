package com.kgd.recommendation.infrastructure.client

import com.kgd.recommendation.port.EmbeddingAnnPort
import com.kgd.recommendation.recommendation.RecommendationItem
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestTemplate

/**
 * Phase 3 — recommendation-ann Python sidecar 와 통신.
 *
 * 실패 시 빈 list 반환 — 호출 측 use case 가 cold-start fallback 처리.
 * Latency 목표: ~12ms (user tower forward 5 + FAISS 5 + network 2).
 */
@Component
class EmbeddingAnnRestClient(
    @Value("\${recommendation.ann.url:http://recommendation-ann:8000}") private val annUrl: String,
) : EmbeddingAnnPort {

    private val logger = KotlinLogging.logger {}

    private val restTemplate: RestTemplate = RestTemplate(
        SimpleClientHttpRequestFactory().apply {
            setConnectTimeout(500)
            setReadTimeout(2000)
        }
    )

    override fun retrievePersonalized(userId: Long, k: Int): List<RecommendationItem> {
        val headers = HttpHeaders().apply { contentType = MediaType.APPLICATION_JSON }
        val payload = mapOf("user_id" to userId, "k" to k)
        val request = HttpEntity(payload, headers)

        return try {
            val response = restTemplate.exchange(
                "$annUrl/search",
                HttpMethod.POST,
                request,
                AnnSearchResponse::class.java,
            )
            val body = response.body ?: return emptyList()
            body.itemIds.zip(body.scores).map { (itemId, score) ->
                RecommendationItem(itemId = itemId, score = score, source = "two-tower-ann")
            }
        } catch (e: Exception) {
            logger.warn { "recommendation-ann 호출 실패 (userId=$userId, k=$k): ${e.message}" }
            emptyList()
        }
    }

    data class AnnSearchResponse(
        val itemIds: List<Long> = emptyList(),
        val scores: List<Double> = emptyList(),
    )
}
