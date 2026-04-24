package com.kgd.sevensplit.application.port.persistence

import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.event.DomainEvent
import java.time.Instant
import java.util.UUID

/**
 * OutboxRepositoryPort — 도메인 이벤트 Outbox 테이블 추상화.
 *
 * ## 배치 위치
 * Application 레이어. Outbox 패턴은 INV-04 (상태 전이와 이벤트 발행의 원자성) 을 보장한다.
 *
 * ## 계약
 * - `append` 는 상태 전이 트랜잭션과 **같은** 트랜잭션 안에서 호출되어야 한다 (ADR-0020).
 * - `findUnpublished` 는 아직 Kafka 에 발행되지 않은 이벤트를 배치로 가져온다 (relay worker 용).
 * - `markPublished` 는 relay 발행 성공 후 published_at 을 찍는다. 실패 이벤트는 재시도.
 */
interface OutboxRepositoryPort {
    /** 상태 전이 트랜잭션에서 도메인 이벤트를 Outbox 에 append. */
    suspend fun append(event: DomainEvent)

    /** 미발행 이벤트를 최대 [limit] 건 조회 — occurredAt 오름차순. */
    suspend fun findUnpublished(tenantId: TenantId, limit: Int): List<OutboxRecord>

    /** relay 발행이 성공한 이벤트들을 published 로 마킹. */
    suspend fun markPublished(eventIds: List<UUID>)
}

/**
 * OutboxRecord — Outbox 한 레코드의 스냅샷.
 *
 * relay worker 가 Kafka 발행에 필요한 최소 필드만 포함한다.
 */
data class OutboxRecord(
    val eventId: UUID,
    val tenantId: TenantId,
    val event: DomainEvent,
    val occurredAt: Instant,
    val publishedAt: Instant?
)
