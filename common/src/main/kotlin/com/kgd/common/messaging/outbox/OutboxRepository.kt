package com.kgd.common.messaging.outbox

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

/**
 * Spring Data JPA repository for [OutboxEntity].
 *
 * 릴레이 쿼리는 [OutboxPollingPublisher] 의 트랜잭션 안에서만 부른다 — `FOR UPDATE SKIP LOCKED` 의 잠금이
 * 그 트랜잭션이 끝날 때까지 유지되어야 다른 릴레이가 같은 행을 건너뛴다.
 */
interface OutboxRepository : JpaRepository<OutboxEntity, Long> {
    fun countByStatus(status: String): Long

    /** 발행할 차례인 행: 재시도 시각이 된 PENDING, 또는 리스가 끝난 SENDING(릴레이가 전송 중 죽은 경우). */
    @Query(
        value = """
            SELECT * FROM outbox_event
            WHERE (status = 'PENDING' AND (next_attempt_at IS NULL OR next_attempt_at <= :now))
               OR (status = 'SENDING' AND lease_until < :now)
            ORDER BY id
            LIMIT :limit
            FOR UPDATE SKIP LOCKED
        """,
        nativeQuery = true,
    )
    fun findClaimable(@Param("now") now: LocalDateTime, @Param("limit") limit: Int): List<OutboxEntity>

    @Modifying
    @Query("UPDATE OutboxEntity e SET e.status = 'SENDING', e.leaseUntil = :leaseUntil WHERE e.id IN :ids")
    fun markSending(@Param("ids") ids: Collection<Long>, @Param("leaseUntil") leaseUntil: LocalDateTime): Int

    /** 전송 결과 반영. SENDING 인 행만 바꾼다 — 리스를 잃은 뒤 다른 릴레이가 이미 정산한 행을 덮지 않는다. */
    @Modifying
    @Query(
        """
        UPDATE OutboxEntity e
        SET e.status = :status, e.attempts = :attempts, e.nextAttemptAt = :nextAttemptAt,
            e.publishedAt = :publishedAt, e.leaseUntil = NULL
        WHERE e.id = :id AND e.status = 'SENDING'
        """,
    )
    fun settle(
        @Param("id") id: Long,
        @Param("status") status: String,
        @Param("attempts") attempts: Int,
        @Param("nextAttemptAt") nextAttemptAt: LocalDateTime?,
        @Param("publishedAt") publishedAt: LocalDateTime?,
    ): Int

    @Modifying
    @Query(
        value = "DELETE FROM outbox_event WHERE status = 'PUBLISHED' AND published_at < :cutoff LIMIT :limit",
        nativeQuery = true,
    )
    fun deletePublishedBefore(@Param("cutoff") cutoff: LocalDateTime, @Param("limit") limit: Int): Int

    @Query(
        value = """
            SELECT status AS status, COUNT(*) AS count FROM outbox_event
            WHERE status IN ('PENDING', 'SENDING', 'FAILED')
            GROUP BY status
        """,
        nativeQuery = true,
    )
    fun countUnpublishedByStatus(): List<OutboxStatusCount>
}

interface OutboxStatusCount {
    val status: String
    val count: Long
}
