package com.kgd.recommendation.infrastructure.client

import com.kgd.recommendation.port.RankingPort
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
 * Phase 4 — recommendation-ann 의 /rank endpoint 호출 (Wide & Deep ranking).
 *
 * 실패 시 입력 candidates 의 retrieval score 순서 그대로 take(k) 반환 — graceful degradation.
 */
@Component
class RankingAnnRestClient(
    @Value("\${recommendation.ann.url:http://recommendation-ann:8000}") private val annUrl: String,
) : RankingPort {

    private val logger = KotlinLogging.logger {}

    private val restTemplate: RestTemplate = RestTemplate(
        SimpleClientHttpRequestFactory().apply {
            setConnectTimeout(500)
            setReadTimeout(3000)
        }
    )

    override fun rerank(
        userId: Long,
        userCity: Long,
        candidates: List<RecommendationItem>,
        k: Int,
    ): List<RecommendationItem> {
        if (candidates.isEmpty()) return emptyList()

        val headers = HttpHeaders().apply { contentType = MediaType.APPLICATION_JSON }
        val payload = mapOf(
            "user_id" to userId,
            "user_city" to userCity,
            "candidate_item_ids" to candidates.map { it.itemId },
            "k" to k,
        )
        val request = HttpEntity(payload, headers)

        return try {
            val response = restTemplate.exchange(
                "$annUrl/rank",
                HttpMethod.POST,
                request,
                RankResponse::class.java,
            )
            val body = response.body ?: return candidates.take(k)
            if (body.itemIds.isEmpty()) {
                return candidates.take(k)
            }
            body.itemIds.zip(body.scores).map { (itemId, score) ->
                RecommendationItem(itemId = itemId, score = score, source = "ranker-wide-and-deep")
            }
        } catch (e: Exception) {
            logger.warn { "recommendation-ann /rank 실패 (userId=$userId): ${e.message} — retrieval 순서 유지" }
            candidates.take(k)
        }
    }

    data class RankResponse(
        val itemIds: List<Long> = emptyList(),
        val scores: List<Double> = emptyList(),
    )
}
