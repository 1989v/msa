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
 * - `status` 는 PENDING / PUBLISHED 두 값 (string) 만 사용. 필요 시 enum 화는 별도 ADR.
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
    val aggregateType: String,

    @Column(nullable = false)
    val aggregateId: Long,

    @Column(nullable = false, length = 100)
    val eventType: String,

    @Column(nullable = false, columnDefinition = "JSON")
    val payload: String,

    @Column(nullable = false, length = 20)
    var status: String = "PENDING",

    @Column(nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    var publishedAt: LocalDateTime? = null,
)
