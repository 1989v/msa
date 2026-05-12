package com.kgd.recommendation.infrastructure.kafka

import com.kgd.recommendation.recommendation.Recommendation
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component

/**
 * Phase 7 — 추천 노출 이벤트 publish.
 *
 * Topic `recommendation.impression.recorded` 의 payload (단순 JSON, 운영 시 schema registry 권장):
 *   { "userId": 1, "itemId": 1046, "rank": 0, "score": 0.997, "source": "ranker-wide_and_deep", "variant": "retrieval-and-rank" }
 *
 * Frontend 또는 분석 시스템이 이 노출과 click event 를 join 하여 CTR 계산.
 * 실패 graceful — recommendation 응답 자체는 영향 없음.
 *
 * env `recommendation.impression.publish.enabled=true` 일 때 활성.
 */
@Component
class RecommendationImpressionPublisher(
    private val kafkaTemplate: KafkaTemplate<String, String>,
    @Value("\${recommendation.impression.publish.enabled:false}") private val enabled: Boolean,
    @Value("\${recommendation.impression.topic:recommendation.impression.recorded}") private val topic: String,
) {
    private val logger = KotlinLogging.logger {}

    fun publishImpressions(rec: Recommendation, variant: String) {
        if (!enabled || rec.items.isEmpty() || rec.userId == null) return
        try {
            rec.items.forEachIndexed { rank, item ->
                val payload = """
                    {"userId":${rec.userId},"itemId":${item.itemId},"rank":$rank,"score":${item.score},"source":"${item.source}","variant":"$variant"}
                """.trimIndent()
                kafkaTemplate.send(topic, rec.userId.toString(), payload)
            }
        } catch (e: Exception) {
            logger.warn { "Impression publish 실패 (userId=${rec.userId}): ${e.message}" }
        }
    }
}
