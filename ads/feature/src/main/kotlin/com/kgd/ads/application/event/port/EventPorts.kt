package com.kgd.ads.application.event.port

import com.kgd.ads.application.event.dto.AcceptanceBatch
import com.kgd.ads.application.event.dto.AcceptanceOutcome
import com.kgd.ads.domain.token.model.TokenKind

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
