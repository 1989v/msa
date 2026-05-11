package com.kgd.analytics.infrastructure.bandit

import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
class SearchImpressionConsumer(
    private val objectMapper: ObjectMapper,
    private val banditStateRedisWriter: BanditStateRedisWriter
) {

    private val log = LoggerFactory.getLogger(javaClass)

    @KafkaListener(
        topics = ["search.impression.logged"],
        groupId = "analytics-bandit-impression",
        containerFactory = "stringKafkaListenerContainerFactory"
    )
    fun consume(message: String) {
        val payload = runCatching { objectMapper.readValue(message, ImpressionPayload::class.java) }
            .onFailure { log.warn("Bad impression payload: {}", it.message) }
            .getOrNull() ?: return

        if (!banditStateRedisWriter.markSeen(payload.searchId, payload.productId, "imp")) {
            log.debug("Duplicate impression searchId={} productId={}", payload.searchId, payload.productId)
            return
        }
        banditStateRedisWriter.incrementImpression(payload.categoryId, payload.productId, payload.ts)
    }

    data class ImpressionPayload(
        val searchId: String = "",
        val categoryId: String = "_default_",
        val productId: String = "",
        val position: Int = 0,
        val userId: String? = null,
        val ts: Long = 0
    )
}
