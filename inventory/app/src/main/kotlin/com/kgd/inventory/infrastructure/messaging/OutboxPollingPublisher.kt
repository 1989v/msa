package com.kgd.inventory.infrastructure.messaging

import com.kgd.inventory.infrastructure.persistence.outbox.repository.OutboxJpaRepository
import org.slf4j.LoggerFactory
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Component
class OutboxPollingPublisher(
    private val outboxRepository: OutboxJpaRepository,
    private val kafkaTemplate: KafkaTemplate<String, Any>,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(fixedDelayString = "\${inventory.outbox.polling-interval-ms:1000}")
    @Transactional
    fun publishPendingEvents() {
        val events = outboxRepository.findAllByStatusOrderByCreatedAtAsc("PENDING")
        if (events.isEmpty()) return

        log.debug("Found {} pending outbox events", events.size)

        for (event in events) {
            try {
                kafkaTemplate.send(event.eventType, event.aggregateId.toString(), event.payload).get()
                event.status = "PUBLISHED"
                event.publishedAt = LocalDateTime.now()
                outboxRepository.save(event)
                log.info("Published outbox event: id={}, type={}, aggregateId={}", event.id, event.eventType, event.aggregateId)
            } catch (e: Exception) {
                log.error("Failed to publish outbox event id={}, type={}", event.id, event.eventType, e)
            }
        }
    }
}
