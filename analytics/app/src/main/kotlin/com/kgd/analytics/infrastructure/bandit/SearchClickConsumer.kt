package com.kgd.analytics.infrastructure.bandit

import com.fasterxml.jackson.databind.ObjectMapper
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
class SearchClickConsumer(
    private val objectMapper: ObjectMapper,
    private val banditStateRedisWriter: BanditStateRedisWriter
) {

    private val log = KotlinLogging.logger {}

    @KafkaListener(
        topics = ["search.click.logged"],
        groupId = "analytics-bandit-click",
        containerFactory = "stringKafkaListenerContainerFactory"
    )
    fun consume(message: String) {
        val payload = runCatching { objectMapper.readValue(message, ClickPayload::class.java) }
            .onFailure { log.warn { "Bad click payload: ${it.message}" } }
            .getOrNull() ?: return

        if (!banditStateRedisWriter.markSeen(payload.searchId, payload.productId, "click")) {
            log.debug { "Duplicate click searchId=${payload.searchId} productId=${payload.productId}" }
            return
        }
        banditStateRedisWriter.incrementClick(payload.effectiveScope(), payload.productId, payload.ts)
    }

    /**
     * ADR-0050 Phase 3 — `scope` 필드 우선, legacy `categoryId` 는 `category:{id}` 로 변환.
     */
    data class ClickPayload(
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
