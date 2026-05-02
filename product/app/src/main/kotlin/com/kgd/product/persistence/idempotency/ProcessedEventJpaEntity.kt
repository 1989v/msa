package com.kgd.product.infrastructure.persistence.idempotency

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table
import java.io.Serializable
import java.time.Instant
import java.util.UUID

/**
 * ADR-0029 PR-7 — product 의 `processed_event` 테이블 매핑 Entity.
 *
 * ## 책임
 * Kafka consumer 가 동일 `event_id` 를 두 번 받아도 한 번만 처리하도록 보장한다.
 * Composite PK = (event_id, consumer_group) 으로 컨슈머 그룹별 독립 멱등성을 유지한다.
 *
 * ## 사용 흐름
 * 1. consumer 가 메시지 수신 → [eventId] / [consumerGroup] 으로 lookup.
 * 2. 존재하면 skip (이미 처리됨).
 * 3. 미존재면 비즈니스 처리 → INSERT 로 마킹.
 *    - INSERT 충돌(PK violation) 시 다른 instance 가 처리한 것이므로 silent skip.
 *
 * 본 마킹/조회는 [com.kgd.common.messaging.IdempotentEventHandler] 헬퍼가 담당한다.
 *
 * ## V20260502_010 스키마
 * ```
 * processed_event (
 *   event_id BINARY(16) NOT NULL,
 *   consumer_group VARCHAR(64) NOT NULL,
 *   processed_at DATETIME(6) NOT NULL,
 *   PRIMARY KEY (event_id, consumer_group)
 * )
 * ```
 *
 * ## 참고
 * quant / order / inventory 의 동명 Entity 와 동일 구조. product 는 §5 적용 범위 표에 누락돼
 * 있었으나 Verification Follow-up §2 로 명시 추가되어 본 PR 에서 신규 도입한다.
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
