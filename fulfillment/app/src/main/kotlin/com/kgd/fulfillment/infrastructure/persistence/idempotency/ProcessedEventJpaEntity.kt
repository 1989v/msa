package com.kgd.fulfillment.infrastructure.persistence.idempotency

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table
import java.io.Serializable
import java.time.Instant
import java.util.UUID

/**
 * ADR-0029 PR-4 (Phase 2b) — `processed_event` 테이블 매핑 Entity.
 *
 * Composite PK = (event_id, consumer_group). 컨슈머 그룹별 독립 멱등성을 유지한다.
 *
 * ## V2 스키마
 * ```
 * processed_event (
 *   event_id       BINARY(16)  NOT NULL,
 *   consumer_group VARCHAR(64) NOT NULL,
 *   processed_at   DATETIME(6) NOT NULL,
 *   PRIMARY KEY (event_id, consumer_group)
 * )
 * ```
 */
@Entity
@Table(name = "processed_event")
@IdClass(ProcessedEventId::class)
class ProcessedEventJpaEntity(
    @Id
    @Column(name = "event_id", columnDefinition = "BINARY(16)", nullable = false)
    var eventId: UUID = UUID.randomUUID(),

    @Id
    @Column(name = "consumer_group", nullable = false, length = 64)
    var consumerGroup: String = "",

    @Column(name = "processed_at", nullable = false)
    var processedAt: Instant = Instant.now(),
)

/**
 * Composite PK ID class for [ProcessedEventJpaEntity]. JPA 요구사항 — Serializable + equals/hashCode.
 */
data class ProcessedEventId(
    var eventId: UUID = UUID.randomUUID(),
    var consumerGroup: String = "",
) : Serializable
