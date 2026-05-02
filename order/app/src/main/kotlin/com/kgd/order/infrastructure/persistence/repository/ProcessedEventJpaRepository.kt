package com.kgd.order.infrastructure.persistence.repository

import com.kgd.order.infrastructure.persistence.entity.ProcessedEventEntity
import com.kgd.order.infrastructure.persistence.entity.ProcessedEventId
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

/**
 * ADR-0029 PR-3b — order 의 `processed_event` JpaRepository.
 *
 * Composite PK 는 [ProcessedEventId] (event_id + consumer_group). lookup 만 사용한다 — INSERT 는
 * `save()` 가 처리, 충돌 시 [org.springframework.dao.DataIntegrityViolationException] 가 발생한다
 * (호출자 [com.kgd.common.messaging.IdempotentEventHandler] 가 silent skip).
 *
 * [deleteByProcessedAtBefore] 는 ADR-0029 Verification Follow-up §1 의 7일 retention 스케줄러
 * ([com.kgd.common.messaging.IdempotentEventCleanupScheduler]) 가 사용한다. 호출 시 트랜잭션 필수.
 *
 * 참고: quant 의 [com.kgd.quant.infrastructure.persistence.repository.ProcessedEventJpaRepository] 와 동일 시그니처.
 */
interface ProcessedEventJpaRepository : JpaRepository<ProcessedEventEntity, ProcessedEventId> {

    @Modifying
    @Query("DELETE FROM ProcessedEventEntity p WHERE p.processedAt < :cutoff")
    fun deleteByProcessedAtBefore(@Param("cutoff") cutoff: Instant): Int
}
