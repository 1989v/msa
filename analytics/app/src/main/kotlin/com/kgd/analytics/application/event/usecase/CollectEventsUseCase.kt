package com.kgd.analytics.application.event.usecase

import com.kgd.common.analytics.AnalyticsEvent

/**
 * 화면이 보낸 노출·클릭을 원장 파이프라인에 넣는다 (ADR-0095).
 *
 * 발행 실패가 화면을 막지 않는다 — 몇 건이 들어갔는지만 돌려주고, 못 넣은 것은 로그로 남긴다.
 * 계측이 기능을 막는 것은 본말전도다.
 */
interface CollectEventsUseCase {
    /** @return 실제로 발행된 건수 */
    fun collect(events: List<AnalyticsEvent>): Int
}
