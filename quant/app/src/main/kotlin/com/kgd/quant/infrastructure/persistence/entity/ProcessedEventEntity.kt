package com.kgd.quant.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table
import java.io.Serializable
import java.time.Instant
import java.util.UUID

/**
 * TG-P2-12.4 — `processed_event` 테이블 매핑 Entity (ADR-0012 idempotent consumer 패턴).
 *
 * ## 책임
 * Kafka consumer 가 동일 `event_id` 를 두 번 받아도 한 번만 처리하도록 보장한다.
 * Composite PK = (event_id, consumer_group) 으로 컨슈머 그룹별 독립 멱등성을 유지한다.
 *
 * ## 사용 흐름
 * 1. consumer 가 메시지 수신 → [event_id] / [consumer_group] 으로 lookup.
 * 2. 존재하면 skip (이미 처리됨).
 * 3. 미존재면 비즈니스 처리 → INSERT 로 마킹.
 *    - INSERT 충돌(PK violation) 시 다른 instance 가 처리한 것이므로 silent skip.
 *
 * 본 마킹/조회는 common 모듈의 [com.kgd.common.messaging.IdempotentEventHandler] 헬퍼가 담당하며,
 * 본 엔티티는 [com.kgd.quant.infrastructure.persistence.adapter.JpaProcessedEventRepositoryAdapter]
 * 를 통해 [com.kgd.common.messaging.ProcessedEventRepositoryPort] 로 노출된다 (ADR-0029).
 *
 * ## V001 스키마
 * ```
 * processed_event (
 *   event_id BINARY(16) NOT NULL,
 *   consumer_group VARCHAR(64) NOT NULL,
 *   processed_at DATETIME(6) NOT NULL,
 *   PRIMARY KEY (event_id, consumer_group)
 * )
 * ```
 */
@Entity
@Table(name = "processed_event")
@IdClass(ProcessedEventId::class)
class ProcessedEventEntity(
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
 * Composite PK ID class for [ProcessedEventEntity]. JPA 요구사항 — Serializable + equals/hashCode.
 */
data class ProcessedEventId(
    var eventId: UUID = UUID.randomUUID(),
    var consumerGroup: String = "",
) : Serializable
