package com.kgd.ads.application.event.port

import com.kgd.ads.application.event.dto.AcceptanceBatch
import com.kgd.ads.application.event.dto.AcceptanceOutcome
import com.kgd.ads.domain.token.model.TokenKind
import com.kgd.common.analytics.AnalyticsEvent

interface EventCounterPort {
    /**
     * 일회성 표식·클릭 속도·예산 확인과 수락 카운터 증가, 채움 출처 카운트를 **한 번의 명령**으로 한다.
     * 반환은 [AcceptanceBatch.events] 와 같은 순서의 판정. Redis 실패·타임아웃이면 null(아무것도 올리지 않았다).
     */
    fun accept(batch: AcceptanceBatch): List<AcceptanceOutcome>?
}

interface EventMetricsPort {
    /** [outcome] 은 `accepted` 또는 거절 사유 코드. */
    fun recordEvent(kind: TokenKind, outcome: String)

    /** 클릭이 보낸 곳 — `landing` 또는 `home`. */
    fun recordClickDestination(destination: String)
}

/**
 * 수락한 노출·클릭의 사본을 analytics 원장(`analytics.event.collected`)으로 보낸다.
 * 과금 근거가 아니므로 Outbox 없이 보내고, 실패는 경고만 남긴다 — 구현은 예외를 밖으로 던지지 않는 것이 원칙이지만
 * 부르는 쪽도 실패를 삼킨다.
 */
interface AnalyticsCopyPort {
    fun publish(events: List<AnalyticsEvent>)
}
