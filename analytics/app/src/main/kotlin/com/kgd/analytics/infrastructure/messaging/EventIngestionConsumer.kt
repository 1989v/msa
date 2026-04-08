package com.kgd.analytics.infrastructure.messaging

import com.kgd.analytics.domain.port.EventRepositoryPort
import com.kgd.common.analytics.AnalyticsEvent
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
class EventIngestionConsumer(
    private val eventRepository: EventRepositoryPort
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val buffer = mutableListOf<AnalyticsEvent>()
    private val bufferLock = Any()

    companion object {
        const val BATCH_SIZE = 100
    }

    @KafkaListener(
        topics = ["analytics.event.collected"],
        groupId = "analytics-event-ingestion",
        containerFactory = "kafkaListenerContainerFactory"
    )
    fun consume(event: AnalyticsEvent) {
        synchronized(bufferLock) {
            buffer.add(event)
            if (buffer.size >= BATCH_SIZE) {
                flush()
            }
        }
    }

    private fun flush() {
        if (buffer.isEmpty()) return
        try {
            eventRepository.saveEvents(buffer.toList())
            buffer.clear()
        } catch (e: Exception) {
            log.error("Failed to flush {} events to ClickHouse", buffer.size, e)
        }
    }
}
