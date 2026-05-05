package com.kgd.quant.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/**
 * TG-P3-13 — `kill_switch_log` JPA Entity (append-only audit, ADR-0037).
 */
@Entity
@Table(
    name = "kill_switch_log",
    indexes = [
        Index(name = "idx_scope_target", columnList = "scope,target_id"),
        Index(name = "idx_occurred_at", columnList = "occurred_at"),
    ],
)
class KillSwitchLogEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @Column(name = "scope", nullable = false, length = 16)
    var scope: String = "",

    @Column(name = "target_id", columnDefinition = "BINARY(16)")
    var targetId: UUID? = null,

    @Column(name = "enabled", nullable = false)
    var enabled: Boolean = false,

    @Column(name = "reason", length = 255)
    var reason: String? = null,

    @Column(name = "actor_id", nullable = false)
    var actorId: Long = 0L,

    @Column(name = "occurred_at", nullable = false)
    var occurredAt: Instant = Instant.EPOCH,
)
