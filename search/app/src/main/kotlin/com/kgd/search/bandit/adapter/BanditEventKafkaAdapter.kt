package com.kgd.search.bandit.adapter

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.search.domain.bandit.model.ClickEvent
import com.kgd.search.domain.bandit.model.ImpressionEvent
import com.kgd.search.domain.bandit.port.BanditEventPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component

/**
 * Bandit impression/click 이벤트 발행. ADR-0050 Phase 3 — payload 에 `scope` 필드를 채워
 * analytics consumer 가 Redis key prefix 를 그대로 사용하도록 한다.
 *
 * 추후 확장: `extraScopes` 필드로 brand 등 추가 scope 동시 발행 (현재 search 측은 단일 scope).
 */
@Component
class BanditEventKafkaAdapter(
    private val kafkaTemplate: KafkaTemplate<String, String>,
    private val objectMapper: ObjectMapper
) : BanditEventPort {

    private val log = KotlinLogging.logger {}

    override fun recordImpression(event: ImpressionEvent) {
        val payload = ImpressionPayload(
            searchId = event.searchId,
            scope = event.key.scope,
            productId = event.key.productId,
            position = event.position,
            userId = event.userId,
            anonymousId = event.anonymousId,
            ts = event.occurredAt.toEpochMilli()
        )
        publish(TOPIC_IMPRESSION, payload, partitionKey = event.key.productId)
    }

    override fun recordClick(event: ClickEvent) {
        val payload = ClickPayload(
            searchId = event.searchId,
            scope = event.key.scope,
            productId = event.key.productId,
            position = event.position,
            userId = event.userId,
            anonymousId = event.anonymousId,
            ts = event.occurredAt.toEpochMilli()
        )
        publish(TOPIC_CLICK, payload, partitionKey = event.key.productId)
    }

    private fun publish(topic: String, payload: Any, partitionKey: String) {
        val json = objectMapper.writeValueAsString(payload)
        kafkaTemplate.send(topic, partitionKey, json).whenComplete { _, err ->
            if (err != null) log.error(err) { "Kafka publish fail topic=$topic key=$partitionKey: ${err.message}" }
        }
    }

    data class ImpressionPayload(
        val searchId: String,
        val scope: String,
        val productId: String,
        val position: Int,
        val userId: String?,
        val anonymousId: String?,
        val ts: Long
    )

    data class ClickPayload(
        val searchId: String,
        val scope: String,
        val productId: String,
        val position: Int,
        val userId: String?,
        val anonymousId: String?,
        val ts: Long
    )

    companion object {
        const val TOPIC_IMPRESSION = "search.impression.logged"
        const val TOPIC_CLICK = "search.click.logged"
    }
}
