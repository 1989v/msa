package com.kgd.inventory.infrastructure.persistence.outbox.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime
import java.util.UUID

@Entity
@Table(name = "outbox_event")
class OutboxJpaEntity(
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

    status: String = "PENDING",

    @Column(nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    publishedAt: LocalDateTime? = null,
) {
    @Column(nullable = false, length = 20)
    var status: String = status
        private set

    var publishedAt: LocalDateTime? = publishedAt
        private set

    /** 발행 완료 마킹 — PENDING → PUBLISHED 상태 전이 (entity-mutation.md) */
    fun markPublished() {
        status = "PUBLISHED"
        publishedAt = LocalDateTime.now()
    }
}
