package com.kgd.analytics.application.event.service

import com.kgd.analytics.application.event.port.EventPublisherPort
import com.kgd.analytics.application.event.usecase.CollectEventsUseCase
import com.kgd.common.analytics.AnalyticsEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service

@Service
class EventCollectService(
    private val publisher: EventPublisherPort,
) : CollectEventsUseCase {
    private val log = KotlinLogging.logger {}

    /**
     * **한 건이 실패해도 나머지를 보낸다.** 묶음으로 받으므로 한 건 때문에 20건을 버리면
     * 그 화면의 노출이 통째로 사라져 CTR 분모가 틀어진다.
     */
    override fun collect(events: List<AnalyticsEvent>): Int =
        events.count { event ->
            runCatching { publisher.publish(event) }
                .onFailure { log.warn(it) { "이벤트 발행 실패 — ${event.entityType}/${event.entityId}" } }
                .isSuccess
        }
}
