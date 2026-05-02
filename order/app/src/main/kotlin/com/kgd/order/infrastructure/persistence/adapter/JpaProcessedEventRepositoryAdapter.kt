package com.kgd.order.infrastructure.persistence.adapter

import com.kgd.common.messaging.ProcessedEventRecord
import com.kgd.common.messaging.ProcessedEventRepositoryPort
import com.kgd.order.infrastructure.persistence.entity.ProcessedEventEntity
import com.kgd.order.infrastructure.persistence.entity.ProcessedEventId
import com.kgd.order.infrastructure.persistence.repository.ProcessedEventJpaRepository
import org.springframework.stereotype.Component
import java.time.Instant
import java.util.UUID

/**
 * ADR-0029 PR-3b — `ProcessedEventRepositoryPort` JPA 어댑터 (order).
 *
 * order 의 [ProcessedEventEntity] / [ProcessedEventJpaRepository] (BINARY(16) UUID +
 * (event_id, consumer_group) 복합 PK 표준 스키마) 를 common 헬퍼가 사용 가능한 Port 로 노출한다.
 *
 * ## 책임
 * - [existsBy] : `(eventId, consumerGroup)` 복합 키 존재 여부.
 * - [mark]     : 새 row 삽입. PK 충돌 시 `DataIntegrityViolationException` 을 호출자
 *                ([com.kgd.common.messaging.IdempotentEventHandler]) 에 전파해 race 흡수에 위임.
 * - [deleteOlderThan] : 7일 retention 스케줄러용. order 는 PR-9 시점에 cleanup 을 enable 하며 본 PR 에선
 *                       Port contract 충족만 한다.
 *
 * ## @Transactional
 * 본 어댑터는 클래스 레벨 `@Transactional` 을 선언하지 않는다. 헬퍼가 `TransactionTemplate` 으로
 * 마킹 INSERT 단독 트랜잭션 경계를 만든다 (ADR-0029 §3 Policy A, ADR-0020 외부 IO 분리). 단,
 * [deleteOlderThan] 은 `@Modifying` 쿼리를 사용하므로 호출 시 트랜잭션이 필요하며, 호출자
 * ([com.kgd.common.messaging.IdempotentEventCleanupScheduler]) 측에서 `TransactionTemplate`
 * 또는 `@Transactional` 로 경계를 잡아야 한다.
 *
 * ## 참고
 * quant 의 [com.kgd.quant.infrastructure.persistence.adapter.JpaProcessedEventRepositoryAdapter]
 * 와 1:1 대응 패턴. ADR-0029 PR-6 부터 [com.kgd.order.infrastructure.messaging.OrderEventConsumer]
 * 가 본 어댑터를 통해 common 헬퍼([com.kgd.common.messaging.IdempotentEventHandler]) 로 멱등 처리를
 * 위임한다.
 */
@Component
class JpaProcessedEventRepositoryAdapter(
    private val jpa: ProcessedEventJpaRepository,
) : ProcessedEventRepositoryPort {

    override fun existsBy(eventId: UUID, consumerGroup: String): Boolean =
        jpa.existsById(ProcessedEventId(eventId = eventId, consumerGroup = consumerGroup))

    override fun mark(record: ProcessedEventRecord) {
        jpa.save(
            ProcessedEventEntity(
                eventId = record.eventId,
                consumerGroup = record.consumerGroup,
                processedAt = record.processedAt,
            )
        )
    }

    override fun deleteOlderThan(cutoff: Instant): Int =
        jpa.deleteByProcessedAtBefore(cutoff)
}
