package com.kgd.fulfillment.infrastructure.persistence.idempotency

import com.kgd.common.messaging.ProcessedEventRecord
import com.kgd.common.messaging.ProcessedEventRepositoryPort
import org.springframework.stereotype.Component
import java.time.Instant
import java.util.UUID

/**
 * ADR-0029 PR-4 (Phase 2b) — `ProcessedEventRepositoryPort` JPA 어댑터.
 *
 * fulfillment 의 [ProcessedEventJpaEntity] / [ProcessedEventJpaRepository] (BINARY(16) UUID +
 * (event_id, consumer_group) 복합 PK 표준 스키마) 를 common 헬퍼가 사용 가능한 Port 로 노출한다.
 *
 * Phase 3 (PR-5) 에서 [com.kgd.fulfillment.infrastructure.messaging.FulfillmentEventConsumer] 가
 * 본 Port 를 통해 [com.kgd.common.messaging.IdempotentEventHandler] 를 사용하도록 wire-up 된다.
 */
@Component
class JpaProcessedEventRepositoryAdapter(
    private val jpa: ProcessedEventJpaRepository,
) : ProcessedEventRepositoryPort {

    override fun existsBy(eventId: UUID, consumerGroup: String): Boolean =
        jpa.existsById(ProcessedEventId(eventId = eventId, consumerGroup = consumerGroup))

    override fun mark(record: ProcessedEventRecord) {
        jpa.save(
            ProcessedEventJpaEntity(
                eventId = record.eventId,
                consumerGroup = record.consumerGroup,
                processedAt = record.processedAt,
            )
        )
    }

    override fun deleteOlderThan(cutoff: Instant): Int =
        jpa.deleteByProcessedAtBefore(cutoff)
}
