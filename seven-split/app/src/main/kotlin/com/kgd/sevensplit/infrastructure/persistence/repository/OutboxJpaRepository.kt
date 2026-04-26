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
 *
 * TG-14.3: `countByPublishedAtIsNull` 은 Micrometer gauge `seven_split_outbox_pending_rows` 용
 * 경량 카운트 쿼리. 미발행 outbox 가 과도하게 쌓이면 알람 트리거 포인트가 된다.
 */
interface OutboxJpaRepository : JpaRepository<OutboxEntity, Long> {

    fun findByEventId(eventId: UUID): OutboxEntity?

    fun findTop100ByPublishedAtIsNullOrderByOccurredAtAsc(): List<OutboxEntity>

    fun findTop100ByTenantIdAndPublishedAtIsNullOrderByOccurredAtAsc(
        tenantId: String
    ): List<OutboxEntity>

    /** TG-14.3: gauge 백업용. 트랜잭션 밖에서 가끔 호출되므로 인덱스(`idx_outbox_published`)에 의존. */
    fun countByPublishedAtIsNull(): Long

    @Modifying
    @Query("UPDATE OutboxEntity o SET o.publishedAt = :publishedAt WHERE o.eventId IN :eventIds")
    fun markPublished(
        @Param("eventIds") eventIds: Collection<UUID>,
        @Param("publishedAt") publishedAt: Instant
    ): Int
}
