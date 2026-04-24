package com.kgd.sevensplit.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/**
 * TG-08.6: `outbox` 테이블 매핑 Entity.
 *
 * INV-04 (상태 전이 + 이벤트 발행 원자성) 를 보장하기 위해, 같은 트랜잭션에서 append 된다.
 * relay worker 가 `published_at IS NULL` 레코드를 주기적으로 fetch 하여 Kafka 로 발행한다.
 *
 * ## 컬럼
 * - `id`: auto-increment PK (relay 배치 안정 순서 보장).
 * - `event_id`: 도메인 이벤트 UUID — uq_outbox_event 로 dedupe.
 * - `payload`: Jackson 으로 직렬화한 `DomainEvent` JSON.
 */
@Entity
@Table(name = "outbox")
class OutboxEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    var id: Long? = null,

    @Column(name = "event_id", columnDefinition = "BINARY(16)", nullable = false, unique = true)
    var eventId: UUID = UUID.randomUUID(),

    @Column(name = "event_type", nullable = false, length = 128)
    var eventType: String = "",

    @Column(name = "tenant_id", nullable = false, length = 64)
    var tenantId: String = "",

    @Column(name = "payload", nullable = false, columnDefinition = "JSON")
    var payload: String = "{}",

    @Column(name = "occurred_at", nullable = false)
    var occurredAt: Instant = Instant.now(),

    @Column(name = "published_at", nullable = true)
    var publishedAt: Instant? = null
)
