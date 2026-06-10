package com.kgd.common.analytics

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.kafka.core.KafkaTemplate

class AnalyticsEventPublisher(
    private val kafkaTemplate: KafkaTemplate<String, AnalyticsEvent>
) {
    private val log = KotlinLogging.logger {}

    companion object {
        const val TOPIC = "analytics.event.collected"
    }

    fun publish(event: AnalyticsEvent) {
        kafkaTemplate.send(TOPIC, event.visitorId, event)
            .whenComplete { _, ex ->
                if (ex != null) {
                    log.warn(ex) { "Analytics event publish failed: ${event.eventId}" }
                }
            }
    }
}
