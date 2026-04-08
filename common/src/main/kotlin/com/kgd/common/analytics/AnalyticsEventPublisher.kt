package com.kgd.common.analytics

import org.slf4j.LoggerFactory
import org.springframework.kafka.core.KafkaTemplate

class AnalyticsEventPublisher(
    private val kafkaTemplate: KafkaTemplate<String, AnalyticsEvent>
) {
    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        const val TOPIC = "analytics.event.collected"
    }

    fun publish(event: AnalyticsEvent) {
        kafkaTemplate.send(TOPIC, event.visitorId, event)
            .whenComplete { _, ex ->
                if (ex != null) {
                    log.warn("Analytics event publish failed: {}", event.eventId, ex)
                }
            }
    }
}
