package com.kgd.quant.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/**
 * TG-P3-04 — `live_trading_state` JPA Entity (ADR-0037).
 */
@Entity
@Table(
    name = "live_trading_state",
    indexes = [Index(name = "idx_mode", columnList = "mode")],
)
class LiveTradingStateEntity(
    @Id
    @Column(name = "tenant_id", columnDefinition = "BINARY(16)")
    var tenantId: UUID = UUID(0, 0),

    @Column(name = "mode", nullable = false, length = 16)
    var mode: String = "DISABLED",

    @Column(name = "activated_at")
    var activatedAt: Instant? = null,

    @Column(name = "activated_by")
    var activatedBy: Long? = null,

    @Column(name = "suspend_reason", length = 32)
    var suspendReason: String? = null,

    @Column(name = "suspended_at")
    var suspendedAt: Instant? = null,

    @Column(name = "two_fa_token_hash", length = 64)
    var twoFaTokenHash: String? = null,

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.EPOCH,
)
