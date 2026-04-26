package com.kgd.sevensplit.application.view

import com.kgd.sevensplit.domain.event.DomainEvent
import java.time.Instant
import java.util.UUID

/**
 * EventSummary — 백테스트 결과에 포함될 이벤트 타임라인 한 건.
 *
 * UI/API 응답에서 도메인 이벤트를 통째로 노출하지 않고 요약 형태로만 내려준다.
 * `type` 은 sealed class 단순 이름 (예: `OrderFilled`, `RoundSlotClosed`).
 */
data class EventSummary(
    val eventId: UUID,
    val type: String,
    val occurredAt: Instant
) {
    companion object {
        fun from(event: DomainEvent): EventSummary = EventSummary(
            eventId = event.eventId,
            type = event::class.simpleName ?: "DomainEvent",
            occurredAt = event.occurredAt
        )
    }
}
