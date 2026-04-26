package com.kgd.sevensplit.infrastructure.persistence.adapter

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.sevensplit.application.port.persistence.OutboxRecord
import com.kgd.sevensplit.application.port.persistence.OutboxRepositoryPort
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.event.DomainEvent
import com.kgd.sevensplit.infrastructure.persistence.entity.OutboxEntity
import com.kgd.sevensplit.infrastructure.persistence.repository.OutboxJpaRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionTemplate
import java.time.Instant
import java.util.UUID

/**
 * TG-08.5/08.6: `OutboxRepositoryPort` JPA 구현.
 *
 * ## Outbox 패턴 (INV-04)
 * [append] 는 도메인 상태 전이와 **같은** DB 트랜잭션에서 호출되어야 한다. Application UseCase 가
 * 메서드 레벨 `@Transactional` 을 걸고 그 안에서 append 를 호출하면, JPA flush 시 `outbox` row 와
 * 도메인 row 가 원자적으로 커밋된다.
 *
 * ## @Transactional 배치 (ADR-0020)
 * 본 adapter 는 클래스 레벨 `@Transactional` 을 선언하지 않는다. 메서드 레벨 또한 suspend 함수와
 * Spring AOP 의 ThreadLocal 컨텍스트가 충돌할 수 있으므로, 트랜잭션이 필수인 [markPublished] 는
 * 명시적 [TransactionTemplate] 로 경계를 만든다 — 이 방식이 coroutine 과도 호환되고
 * self-invocation 프록시 우회 문제도 없다.
 *
 * ## Relay 경로
 * 포트 `findUnpublished` 는 `DomainEvent` 재구성을 요구하지만, 도메인 이벤트 sealed 계층은 15+ 종이라
 * 전면 역직렬화 구현은 Phase 2 에서 수행한다. 본 Phase 1 에서는 infrastructure 전용 쿼리
 * [findUnpublishedRaw] 를 노출해 relay 가 `OutboxEntity` 를 그대로 소비하도록 한다.
 */
@Component
class JpaOutboxRepositoryAdapter(
    private val jpa: OutboxJpaRepository,
    private val objectMapper: ObjectMapper,
    private val transactionTemplate: TransactionTemplate
) : OutboxRepositoryPort {

    override suspend fun append(event: DomainEvent) {
        // 중복 append 방지 — eventId UNIQUE 제약에 의존해도 되지만, 읽기 선행으로 명시성 확보.
        val duplicate = jpa.findByEventId(event.eventId)
        if (duplicate != null) return

        val entity = OutboxEntity(
            eventId = event.eventId,
            eventType = event::class.simpleName ?: "UnknownDomainEvent",
            tenantId = event.tenantId.value,
            payload = objectMapper.writeValueAsString(event),
            occurredAt = event.occurredAt,
            publishedAt = null
        )
        jpa.save(entity)
    }

    /**
     * Phase 1 relay 전용: `DomainEvent` 재구성 없이 엔티티 스냅샷을 그대로 반환.
     * Phase 2 에서 [findUnpublished] 구현이 확정되면 본 메서드는 유지하되 내부 전용으로 좁힌다.
     */
    fun findUnpublishedRaw(limit: Int): List<OutboxEntity> =
        jpa.findTop100ByPublishedAtIsNullOrderByOccurredAtAsc().take(limit)

    override suspend fun findUnpublished(tenantId: TenantId, limit: Int): List<OutboxRecord> {
        // Phase 2 에서 DomainEvent sealed 계층 역직렬화 전략 확정 후 구현.
        throw NotImplementedError(
            "JpaOutboxRepositoryAdapter.findUnpublished 는 Phase 2 에서 구현된다. " +
                    "Phase 1 relay 는 findUnpublishedRaw 를 사용하라."
        )
    }

    override suspend fun markPublished(eventIds: List<UUID>) {
        if (eventIds.isEmpty()) return
        // @Modifying JPQL 은 트랜잭션을 요구. TransactionTemplate 로 명시적 경계 생성.
        transactionTemplate.execute {
            jpa.markPublished(eventIds, Instant.now())
        }
    }
}
