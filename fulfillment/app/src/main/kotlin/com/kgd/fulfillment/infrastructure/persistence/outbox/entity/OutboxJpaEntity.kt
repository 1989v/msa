package com.kgd.fulfillment.infrastructure.persistence.outbox.entity

import jakarta.persistence.*
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
    @Column(nullable = false, length = 20)
    var status: String = "PENDING",
    @Column(nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
    var publishedAt: LocalDateTime? = null
)
