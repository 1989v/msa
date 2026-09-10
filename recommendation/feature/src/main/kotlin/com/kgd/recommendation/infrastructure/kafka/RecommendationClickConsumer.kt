package com.kgd.recommendation.infrastructure.kafka

import com.kgd.recommendation.infrastructure.bandit.BanditPolicy
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

/**
 * Phase 7 — recommendation 노출 후 click 이벤트 consumer.
 *
 * Topic `recommendation.click.recorded` 의 payload:
 * - userId: Long
 * - itemId: Long
 * - variant: String (Thompson sampler / A/B 의 variant)
 *
 * Bandit posterior 의 success counter update.
 * Source: analytics 서비스 또는 frontend 가 직접 publish (운영 흐름에 따라).
 */
@Component
class RecommendationClickConsumer(
    private val banditPolicy: BanditPolicy,
) {
    private val logger = KotlinLogging.logger {}

    @KafkaListener(
        topics = ["recommendation.click.recorded"],
        groupId = "recommendation-click-consumer",
        containerFactory = "recommendationStringKafkaListenerContainerFactory",
    )
    fun handle(payload: String) {
        // 간단 JSON parsing 대신 fastJSON / Jackson 미사용 — payload 가 작아서 정규식 또는 line split
        // 운영에서는 별도 ClickEvent data class + JsonDeserializer 권장
        val variant = extractField(payload, "variant") ?: return
        banditPolicy.recordClick(variant)
        logger.debug { "Click recorded for variant=$variant" }
    }

    private fun extractField(json: String, key: String): String? {
        val pattern = "\"$key\"\\s*:\\s*\"([^\"]+)\"".toRegex()
        return pattern.find(json)?.groupValues?.getOrNull(1)
    }
}
