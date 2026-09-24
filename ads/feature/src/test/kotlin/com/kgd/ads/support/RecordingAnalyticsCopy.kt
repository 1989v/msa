package com.kgd.ads.support

import com.kgd.ads.application.event.port.AnalyticsCopyPort
import com.kgd.common.analytics.AnalyticsEvent
import java.util.concurrent.CopyOnWriteArrayList

/**
 * 통합 컨텍스트에는 Kafka 가 없다 — 사본 발행 포트를 이것으로 바꿔 보낸 사본을 모아 둔다.
 * [failing] 을 켜면 발행이 예외를 던진다(브로커 장애를 흉내). 모든 스펙이 같은 빈을 쓰므로 판정은 소재 id 로 거른다.
 */
class RecordingAnalyticsCopy : AnalyticsCopyPort {
    val published = CopyOnWriteArrayList<AnalyticsEvent>()

    @Volatile
    var failing: Boolean = false

    override fun publish(events: List<AnalyticsEvent>) {
        if (failing) throw IllegalStateException("테스트 — Kafka 발행 실패")
        published += events
    }

    fun forCreative(creativeId: Long): List<AnalyticsEvent> = published.filter { it.entityId == creativeId.toString() }
}
