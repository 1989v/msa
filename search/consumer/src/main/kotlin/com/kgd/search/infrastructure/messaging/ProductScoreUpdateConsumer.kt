package com.kgd.search.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import io.github.oshai.kotlinlogging.KotlinLogging
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch.core.UpdateRequest
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
class ProductScoreUpdateConsumer(
    private val osClient: OpenSearchClient,
    private val objectMapper: ObjectMapper
) {
    private val log = KotlinLogging.logger {}

    @KafkaListener(
        topics = ["analytics.score.updated"],
        groupId = "search-score-updater"
    )
    fun consume(message: String) {
        try {
            val event = objectMapper.readValue(message, ScoreUpdateEvent::class.java)

            val partialDoc: Map<String, Any> = mapOf(
                "popularityScore" to event.popularityScore,
                "ctr" to event.ctr,
                "cvr" to event.cvr,
                "ctrRaw" to event.ctrRaw,
                "cvrRaw" to event.cvrRaw,
                "gmv7d" to event.gmv7d,
                "gmv30d" to event.gmv30d,
                "scoreUpdatedAt" to event.updatedAt
            )

            // ADR-0055 — Spring Data UpdateQuery 대체: opensearch-java partial update.
            val request = UpdateRequest.Builder<Map<String, Any>, Map<String, Any>>()
                .index("products")
                .id(event.productId.toString())
                .doc(partialDoc)
                .build()

            @Suppress("UNCHECKED_CAST")
            osClient.update(request, Map::class.java as Class<Map<String, Any>>)
            log.debug { "Updated product score in OpenSearch: productId=${event.productId}" }
        } catch (e: Exception) {
            log.error(e) { "Failed to update product score in OpenSearch: $message" }
        }
    }
}
