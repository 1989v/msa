package com.kgd.ads.infrastructure.metrics

import com.kgd.ads.application.event.port.EventMetricsPort
import com.kgd.ads.domain.token.model.TokenKind
import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.stereotype.Component

/**
 * 광고 이벤트 메트릭.
 *
 * - `ads_event_total` (counter) — `kind`(imp·clk) × `outcome`(`accepted` 또는 거절 사유).
 *   `visitor_mismatch` 비율은 이 카운터의 outcome 비로 본다 — 첫 방문 병렬 요청에서 vid 가 둘 생기면 오른다
 * - `ads_click_redirect_total` (counter) — `destination`(landing·home). home 이 늘면 서명 불량·승인 취소 클릭이다
 */
@Component
class EventMetrics(
    private val meterRegistry: MeterRegistry,
) : EventMetricsPort {

    override fun recordEvent(kind: TokenKind, outcome: String) {
        Counter.builder(EVENT)
            .description("광고 이벤트 수락·거절")
            .tag("kind", kind.name.lowercase())
            .tag("outcome", outcome)
            .register(meterRegistry)
            .increment()
    }

    override fun recordClickDestination(destination: String) {
        Counter.builder(CLICK_REDIRECT)
            .description("광고 클릭이 보낸 곳")
            .tag("destination", destination)
            .register(meterRegistry)
            .increment()
    }

    companion object {
        const val EVENT = "ads_event_total"
        const val CLICK_REDIRECT = "ads_click_redirect_total"
    }
}
