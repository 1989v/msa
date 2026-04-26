package com.kgd.sevensplit.domain.event

/**
 * EventPublisher — 도메인 이벤트 발행 port.
 *
 * ## 배치 위치
 * 도메인 레이어. `StrategyExecutor`/엔진이 이벤트를 생성 즉시 발행하므로 도메인에 둔다
 * (spec.md §4, ADR-0014). Application/Infrastructure 는 구현만 담당.
 *
 * ## 계약
 * - 구현체는 **Outbox append (같은 트랜잭션) + Kafka 발행 (Outbox relay)** 으로 분리한다
 *   — ADR-0015 (Resilience), ADR-0020 (Transactional) 준수.
 * - `publish` 는 at-least-once 로 발행되며, 소비자는 `eventId` 기준 멱등 처리 필요 (ADR-0012).
 * - 실패 시 RuntimeException 을 재던지되, 도메인 로직이 rollback 되도록 보장한다.
 */
fun interface EventPublisher {
    suspend fun publish(event: DomainEvent)
}
