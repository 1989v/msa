package com.kgd.quant.infrastructure.persistence.repository

import com.kgd.quant.infrastructure.persistence.entity.ProcessedEventEntity
import com.kgd.quant.infrastructure.persistence.entity.ProcessedEventId
import org.springframework.data.jpa.repository.JpaRepository

/**
 * TG-P2-12.4 — `processed_event` JpaRepository (ADR-0012 idempotent consumer 패턴).
 *
 * Composite PK 는 [ProcessedEventId] (event_id + consumer_group). lookup 만 사용한다 — INSERT 는
 * `save()` 가 처리, 충돌 시 [org.springframework.dao.DataIntegrityViolationException] 가 발생한다
 * (호출자 [com.kgd.quant.infrastructure.outbox.IdempotentEventConsumer] 가 silent skip).
 */
interface ProcessedEventJpaRepository : JpaRepository<ProcessedEventEntity, ProcessedEventId>
