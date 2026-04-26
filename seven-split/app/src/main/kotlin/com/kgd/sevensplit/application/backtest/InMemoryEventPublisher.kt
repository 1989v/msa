package com.kgd.sevensplit.application.backtest

import com.kgd.sevensplit.domain.event.DomainEvent
import com.kgd.sevensplit.domain.event.EventPublisher

/**
 * InMemoryEventPublisher — 테스트/백테스트 전용 [EventPublisher] 구현.
 *
 * - 발행된 모든 [DomainEvent] 를 내부 리스트에 순서대로 누적한다.
 * - 결정론 검증, 시나리오 테스트에서 이벤트 시퀀스 단언에 사용.
 * - 프로덕션 Outbox 경로가 아니므로 Kafka 로 흐르지 않음.
 *
 * 스레드 안전성은 보장하지 않는다 (백테스트 엔진은 단일 스레드로 동작).
 */
class InMemoryEventPublisher : EventPublisher {
    private val _events: MutableList<DomainEvent> = mutableListOf()

    val events: List<DomainEvent> get() = _events.toList()

    override suspend fun publish(event: DomainEvent) {
        _events.add(event)
    }

    fun clear() {
        _events.clear()
    }
}
