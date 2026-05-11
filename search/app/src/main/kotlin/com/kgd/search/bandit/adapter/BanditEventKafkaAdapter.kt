package com.kgd.search.bandit.adapter

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.search.domain.bandit.model.ClickEvent
import com.kgd.search.domain.bandit.model.ImpressionEvent
import com.kgd.search.domain.bandit.port.BanditEventPort
import org.slf4j.LoggerFactory
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component

@Component
class BanditEventKafkaAdapter(
    private val kafkaTemplate: KafkaTemplate<String, String>,
    private val objectMapper: ObjectMapper
) : BanditEventPort {

    private val log = LoggerFactory.getLogger(javaClass)

    override fun recordImpression(event: ImpressionEvent) {
        val payload = ImpressionPayload(
            searchId = event.searchId,
            categoryId = event.key.categoryId,
            productId = event.key.productId,
            position = event.position,
            userId = event.userId,
            ts = event.occurredAt.toEpochMilli()
        )
        publish(TOPIC_IMPRESSION, payload, partitionKey = event.key.productId)
    }

    override fun recordClick(event: ClickEvent) {
        val payload = ClickPayload(
            searchId = event.searchId,
            categoryId = event.key.categoryId,
            productId = event.key.productId,
            position = event.position,
            userId = event.userId,
            ts = event.occurredAt.toEpochMilli()
        )
        publish(TOPIC_CLICK, payload, partitionKey = event.key.productId)
    }

    private fun publish(topic: String, payload: Any, partitionKey: String) {
        val json = objectMapper.writeValueAsString(payload)
        kafkaTemplate.send(topic, partitionKey, json).whenComplete { _, err ->
            if (err != null) log.error("Kafka publish fail topic={} key={}: {}", topic, partitionKey, err.message)
        }
    }

    data class ImpressionPayload(
        val searchId: String,
        val categoryId: String,
        val productId: String,
        val position: Int,
        val userId: String?,
        val ts: Long
    )

    data class ClickPayload(
        val searchId: String,
        val categoryId: String,
        val productId: String,
        val position: Int,
        val userId: String?,
        val ts: Long
    )

    companion object {
        const val TOPIC_IMPRESSION = "search.impression.logged"
        const val TOPIC_CLICK = "search.click.logged"
    }
}
