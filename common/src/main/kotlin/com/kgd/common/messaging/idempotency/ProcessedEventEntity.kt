package com.kgd.common.messaging.idempotency

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table
import java.io.Serializable
import java.time.Instant
import java.util.UUID

/**
 * 멱등 소비 원장 `processed_event` (ADR-0012/0029) — 스키마는 모든 도메인이 같다.
 *
 * 엔티티는 common 이 한 벌만 갖고, 각 도메인은 [ProcessedEventRepository] 서브인터페이스를
 * 자기 패키지에 두어 자기 EMF 에 바인딩한다(outbox 와 같은 방식). EMF `packages(...)` 에
 * `com.kgd.common.messaging.idempotency` 를 넣어야 이 엔티티가 그 DB 에 매핑된다.
 */
@Entity
@Table(name = "processed_event")
@IdClass(ProcessedEventId::class)
class ProcessedEventEntity(
    eventId: UUID = UUID.randomUUID(),
    consumerGroup: String = "",
    processedAt: Instant = Instant.now(),
) {
    @Id
    @Column(name = "event_id", columnDefinition = "BINARY(16)", nullable = false)
    var eventId: UUID = eventId
        private set

    @Id
    @Column(name = "consumer_group", nullable = false, length = 64)
    var consumerGroup: String = consumerGroup
        private set

    @Column(name = "processed_at", nullable = false)
    var processedAt: Instant = processedAt
        private set
}

data class ProcessedEventId(
    var eventId: UUID = UUID.randomUUID(),
    var consumerGroup: String = "",
) : Serializable
