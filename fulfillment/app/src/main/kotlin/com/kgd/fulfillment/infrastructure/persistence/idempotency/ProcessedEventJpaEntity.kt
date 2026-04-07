package com.kgd.fulfillment.infrastructure.persistence.idempotency

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "processed_event")
class ProcessedEventJpaEntity(
    @Id
    @Column(length = 36)
    val eventId: String,

    @Column(nullable = false, length = 100)
    val topic: String,

    @Column(nullable = false)
    val processedAt: LocalDateTime = LocalDateTime.now(),
)
