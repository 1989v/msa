package com.kgd.sevensplit.infrastructure.outbox

import com.kgd.sevensplit.application.port.persistence.OutboxRepositoryPort
import com.kgd.sevensplit.domain.event.DomainEvent
import com.kgd.sevensplit.domain.event.EventPublisher
import org.springframework.stereotype.Component

/**
 * TG-08.6: `EventPublisher` 의 Outbox 기반 구현.
 *
 * 도메인 레이어가 이벤트를 발행하면, 같은 트랜잭션에서 `outbox` 테이블에 append 된다 (INV-04).
 * 별도 [OutboxRelay] 스케줄러가 `published_at IS NULL` 레코드를 주기적으로 Kafka 로 발행한다 (Phase 2).
 *
 * ## @Transactional
 * 본 클래스는 `@Transactional` 을 직접 선언하지 않는다 (ADR-0020 — 클래스 레벨 금지). 실제 트랜잭션
 * 경계는 `OutboxRepositoryPort.append` 구현체 메서드 레벨에 선언되어 있으며, 상위 UseCase 가 이미
 * `@Transactional` 을 열어 둔 경우 `Propagation.REQUIRED` 로 해당 트랜잭션에 참여한다.
 */
@Component
class OutboxEventPublisher(
    private val outboxRepository: OutboxRepositoryPort
) : EventPublisher {

    override suspend fun publish(event: DomainEvent) {
        outboxRepository.append(event)
    }
}
