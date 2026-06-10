package com.kgd.analytics.infrastructure.bandit

import com.fasterxml.jackson.databind.ObjectMapper
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
class SearchImpressionConsumer(
    private val objectMapper: ObjectMapper,
    private val banditStateRedisWriter: BanditStateRedisWriter
) {

    private val log = KotlinLogging.logger {}

    @KafkaListener(
        topics = ["search.impression.logged"],
        groupId = "analytics-bandit-impression",
        containerFactory = "stringKafkaListenerContainerFactory"
    )
    fun consume(message: String) {
        val payload = runCatching { objectMapper.readValue(message, ImpressionPayload::class.java) }
            .onFailure { log.warn { "Bad impression payload: ${it.message}" } }
            .getOrNull() ?: return

        if (!banditStateRedisWriter.markSeen(payload.searchId, payload.productId, "imp")) {
            log.debug { "Duplicate impression searchId=${payload.searchId} productId=${payload.productId}" }
            return
        }
        banditStateRedisWriter.incrementImpression(payload.effectiveScope(), payload.productId, payload.ts)
    }

    /**
     * ADR-0050 Phase 3 — `scope` 필드를 우선 사용. 구 발행자(legacy publisher)가 보낸
     * `categoryId` 필드도 backward-compat 으로 받아 `category:{categoryId}` 로 변환.
     */
    data class ImpressionPayload(
        val searchId: String = "",
        val scope: String? = null,
        val categoryId: String? = null,
        val productId: String = "",
        val position: Int = 0,
        val userId: String? = null,
        val ts: Long = 0
    ) {
        fun effectiveScope(): String {
            scope?.takeIf { it.isNotBlank() }?.let { return it }
            val legacyCategory = categoryId?.takeIf { it.isNotBlank() }
            return if (legacyCategory != null) "category:$legacyCategory" else "_default_"
        }
    }
}
