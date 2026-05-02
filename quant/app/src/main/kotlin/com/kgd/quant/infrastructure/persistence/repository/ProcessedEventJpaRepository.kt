package com.kgd.quant.infrastructure.persistence.repository

import com.kgd.quant.infrastructure.persistence.entity.ProcessedEventEntity
import com.kgd.quant.infrastructure.persistence.entity.ProcessedEventId
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

/**
 * TG-P2-12.4 / ADR-0029 — `processed_event` JpaRepository (idempotent consumer 패턴).
 *
 * Composite PK 는 [ProcessedEventId] (event_id + consumer_group). lookup 만 사용한다 — INSERT 는
 * `save()` 가 처리, 충돌 시 [org.springframework.dao.DataIntegrityViolationException] 가 발생한다
 * (호출자 [com.kgd.common.messaging.IdempotentEventHandler] 가 silent skip).
 *
 * [deleteByProcessedAtBefore] 는 ADR-0029 Verification Follow-up §1 의 7일 retention 스케줄러
 * ([com.kgd.common.messaging.IdempotentEventCleanupScheduler]) 가 사용한다. 호출 시 트랜잭션 필수.
 */
interface ProcessedEventJpaRepository : JpaRepository<ProcessedEventEntity, ProcessedEventId> {

    @Modifying
    @Query("DELETE FROM ProcessedEventEntity p WHERE p.processedAt < :cutoff")
    fun deleteByProcessedAtBefore(@Param("cutoff") cutoff: Instant): Int
}
