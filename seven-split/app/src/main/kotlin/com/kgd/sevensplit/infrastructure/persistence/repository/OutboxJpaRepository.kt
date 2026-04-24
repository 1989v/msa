package com.kgd.sevensplit.infrastructure.persistence.repository

import com.kgd.sevensplit.infrastructure.persistence.entity.OutboxEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant
import java.util.UUID

/**
 * TG-08.6: Outbox JpaRepository.
 *
 * relay 배치는 `findTop100ByPublishedAtIsNullOrderByOccurredAtAsc()` 로 미발행 레코드를 fetch 하고,
 * Kafka 발행 성공 시 `markPublished` 로 published_at 을 업데이트한다.
 */
interface OutboxJpaRepository : JpaRepository<OutboxEntity, Long> {

    fun findByEventId(eventId: UUID): OutboxEntity?

    fun findTop100ByPublishedAtIsNullOrderByOccurredAtAsc(): List<OutboxEntity>

    fun findTop100ByTenantIdAndPublishedAtIsNullOrderByOccurredAtAsc(
        tenantId: String
    ): List<OutboxEntity>

    @Modifying
    @Query("UPDATE OutboxEntity o SET o.publishedAt = :publishedAt WHERE o.eventId IN :eventIds")
    fun markPublished(
        @Param("eventIds") eventIds: Collection<UUID>,
        @Param("publishedAt") publishedAt: Instant
    ): Int
}
