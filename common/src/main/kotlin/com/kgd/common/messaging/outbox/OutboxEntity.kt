package com.kgd.common.messaging.outbox

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import java.time.LocalDateTime
import java.util.UUID

/**
 * Generic Transactional Outbox row mapped onto each service's `outbox_event` table.
 *
 * 모든 서비스가 동일한 schema 를 사용한다 (ADR-0011 §2 / ADR-0032 Phase 0). 서비스별 DB
 * (서비스별 schema, ADR-0006) 를 그대로 유지한 채 ORM 매핑만 common 으로 단일화한다.
 *
 * - `aggregateType` 을 통해 동일 outbox 테이블에 여러 도메인 aggregate 의 이벤트를 적재 가능.
 * - `eventId` (UUID) 는 publisher 가 message body 안에 enrichment 하여 consumer 의 멱등 처리에 사용.
 * - `status` 는 PENDING → SENDING(리스 보유 중) → PUBLISHED | FAILED. 문자열 컬럼이라 값만 늘었다.
 * - `partitionKey` 가 있으면 Kafka 레코드 키, 없으면 `aggregateId`.
 * - `headers` 는 발행 시 Kafka 헤더로 복원할 JSON 객체(`traceparent` 등).
 *
 * 모든 생성자 인자에 기본값을 둔다 — common 에는 kotlin-jpa(no-arg) 플러그인이 없어서, 없으면 Hibernate 가
 * 행을 읽을 때 "No default constructor" 로 실패한다([com.kgd.common.messaging.idempotency.ProcessedEventEntity] 와 같은 방식).
 */
@Entity
@Table(
    name = "outbox_event",
    indexes = [
        Index(name = "idx_outbox_status_created", columnList = "status, createdAt"),
    ],
)
class OutboxEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 36)
    val eventId: String = UUID.randomUUID().toString(),

    @Column(nullable = false, length = 50)
    val aggregateType: String = "",

    @Column(nullable = false)
    val aggregateId: Long = 0,

    @Column(nullable = false, length = 100)
    val eventType: String = "",

    @Column(nullable = false, columnDefinition = "JSON")
    val payload: String = "",

    @Column(nullable = false, length = 20)
    var status: String = "PENDING",

    @Column(nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    var publishedAt: LocalDateTime? = null,

    @Column(length = 100)
    val partitionKey: String? = null,

    @Column(columnDefinition = "JSON")
    val headers: String? = null,

    @Column(nullable = false)
    var attempts: Int = 0,

    var nextAttemptAt: LocalDateTime? = null,

    var leaseUntil: LocalDateTime? = null,
)
