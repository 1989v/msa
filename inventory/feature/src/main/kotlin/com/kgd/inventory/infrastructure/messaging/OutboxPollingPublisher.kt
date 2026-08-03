package com.kgd.inventory.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.kgd.inventory.infrastructure.persistence.outbox.repository.OutboxJpaRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

@Component
@ConditionalOnProperty(name = ["outbox.polling.enabled"], havingValue = "true", matchIfMissing = true)
class OutboxPollingPublisher(
    private val outboxRepository: OutboxJpaRepository,
    private val kafkaTemplate: KafkaTemplate<String, Any>,
    private val objectMapper: ObjectMapper,
) {
    private val log = KotlinLogging.logger {}

    @Scheduled(fixedDelayString = "\${inventory.outbox.polling-interval-ms:1000}")
    fun publishPendingEvents() {
        val events = outboxRepository.findAllByStatusOrderByCreatedAtAsc("PENDING")
        if (events.isEmpty()) return

        log.debug { "Found ${events.size} pending outbox events" }

        for (event in events) {
            try {
                val enrichedPayload = objectMapper.readTree(event.payload).let { node ->
                    (node as ObjectNode).put("eventId", event.eventId)
                    objectMapper.writeValueAsString(node)
                }
                kafkaTemplate.send(event.eventType, event.aggregateId.toString(), enrichedPayload)
                    .whenComplete { _, ex ->
                        if (ex != null) {
                            log.error(ex) { "Failed to publish outbox event id=${event.id}, type=${event.eventType}" }
                        } else {
                            event.markPublished()
                            outboxRepository.save(event)
                            log.info { "Published outbox event: id=${event.id}, type=${event.eventType}, aggregateId=${event.aggregateId}" }
                        }
                    }
            } catch (e: Exception) {
                log.error(e) { "Failed to publish outbox event id=${event.id}, type=${event.eventType}" }
            }
        }
    }
}
