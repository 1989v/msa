package com.kgd.analytics.infrastructure.messaging

import com.kgd.analytics.application.event.port.EventPublisherPort
import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.AnalyticsEventPublisher
import org.springframework.stereotype.Component

/** [EventPublisherPort] 를 공통 Kafka 발행기로 구현한다 (ADR-0083 어댑터). */
@Component
class KafkaEventPublisherAdapter(
    private val publisher: AnalyticsEventPublisher,
) : EventPublisherPort {
    override fun publish(event: AnalyticsEvent) = publisher.publish(event)
}
