package com.kgd.quant.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.time.Instant
import java.util.UUID

/**
 * TG-P3-31 — `audit_event` JPA Entity (chain, ADR-0037).
 */
@Entity
@Table(
    name = "audit_event",
    indexes = [
        Index(name = "idx_tenant_time", columnList = "tenant_id,occurred_at"),
    ],
    uniqueConstraints = [
        UniqueConstraint(name = "uq_current_hash", columnNames = ["current_hash"]),
    ],
)
class AuditEventEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @Column(name = "tenant_id", columnDefinition = "BINARY(16)", nullable = false)
    var tenantId: UUID = UUID(0, 0),

    @Column(name = "event_type", nullable = false, length = 32)
    var eventType: String = "",

    @Column(name = "payload_json", nullable = false, columnDefinition = "LONGTEXT")
    var payloadJson: String = "",

    @Column(name = "occurred_at", nullable = false)
    var occurredAt: Instant = Instant.EPOCH,

    @Column(name = "prev_hash", length = 64)
    var prevHash: String? = null,

    @Column(name = "current_hash", nullable = false, length = 64)
    var currentHash: String = "",
)
