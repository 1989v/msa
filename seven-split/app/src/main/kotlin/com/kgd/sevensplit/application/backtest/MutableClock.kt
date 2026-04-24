package com.kgd.sevensplit.application.backtest

import com.kgd.sevensplit.domain.common.Clock
import java.time.Instant

/**
 * MutableClock — 백테스트 전용 가변 [Clock] 구현.
 *
 * 엔진 루프가 현재 bar 의 `timestamp` 를 주입한 뒤, 해당 bar 처리 중에 생성되는
 * 모든 시간 필드 (`OrderAck.acceptedAt`, `Execution.executedAt`, event.occurredAt 등)
 * 가 동일한 값으로 확정되도록 한다 — 결정론의 핵심 축 (TG-05.5).
 *
 * 스레드 안전성은 보장하지 않는다. 엔진 루프 단일 스레드에서만 호출.
 */
class MutableClock(initial: Instant) : Clock {
    private var current: Instant = initial

    override fun now(): Instant = current

    fun advanceTo(instant: Instant) {
        current = instant
    }
}
