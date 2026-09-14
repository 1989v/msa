package com.kgd.analytics.application.event.port

import com.kgd.common.analytics.AnalyticsEvent

/** 원장 토픽으로 내보내는 출력 포트. 구현은 infrastructure 가 갖는다 (ADR-0083). */
interface EventPublisherPort {
    fun publish(event: AnalyticsEvent)
}
