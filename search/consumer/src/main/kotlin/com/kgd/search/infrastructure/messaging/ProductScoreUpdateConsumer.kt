package com.kgd.search.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.document.Document
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
import org.springframework.data.elasticsearch.core.query.UpdateQuery
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
class ProductScoreUpdateConsumer(
    private val elasticsearchOperations: ElasticsearchOperations,
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

            val updateQuery = UpdateQuery.builder(event.productId.toString())
                .withDocument(Document.create().apply {
                    put("popularityScore", event.popularityScore)
                    put("ctr", event.ctr)
                    put("cvr", event.cvr)
                    put("ctrRaw", event.ctrRaw)
                    put("cvrRaw", event.cvrRaw)
                    put("gmv7d", event.gmv7d)
                    put("gmv30d", event.gmv30d)
                    put("scoreUpdatedAt", event.updatedAt)
                })
                .build()

            elasticsearchOperations.update(updateQuery, IndexCoordinates.of("products"))
            log.debug { "Updated product score in ES: productId=${event.productId}" }
        } catch (e: Exception) {
            log.error(e) { "Failed to update product score in ES: $message" }
        }
    }
}
