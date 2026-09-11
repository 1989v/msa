package com.kgd.quant.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

/**
 * TG-P3-26 — `live_order_record` JPA Entity (ADR-0037, Phase 3 LIVE 전용).
 */
@Entity
@Table(
    name = "live_order_record",
    indexes = [
        Index(name = "idx_tenant_strategy_status", columnList = "tenant_id,strategy_id,status"),
        Index(name = "idx_status_placed_at", columnList = "status,placed_at"),
    ],
    uniqueConstraints = [UniqueConstraint(name = "uq_audit_hash", columnNames = ["audit_hash_current"])],
)
class LiveOrderRecordEntity(
    @Id
    @Column(name = "id", columnDefinition = "BINARY(16)")
    var id: UUID = UUID(0, 0),

    @Column(name = "tenant_id", columnDefinition = "BINARY(16)", nullable = false)
    var tenantId: UUID = UUID(0, 0),

    @Column(name = "strategy_id", columnDefinition = "BINARY(16)", nullable = false)
    var strategyId: UUID = UUID(0, 0),

    @Column(name = "market_code", nullable = false, length = 16)
    var marketCode: String = "",

    @Column(name = "asset_code", nullable = false, length = 32)
    var assetCode: String = "",

    @Column(name = "side", nullable = false, length = 8)
    var side: String = "",

    @Column(name = "type", nullable = false, length = 16)
    var type: String = "",

    @Column(name = "price_krw", precision = 28, scale = 8)
    var priceKrw: BigDecimal? = null,

    @Column(name = "quantity", nullable = false, precision = 28, scale = 8)
    var quantity: BigDecimal = BigDecimal.ZERO,

    @Column(name = "status", nullable = false, length = 16)
    var status: String = "",

    @Column(name = "exchange_order_id", length = 128)
    var exchangeOrderId: String? = null,

    @Column(name = "placed_at", nullable = false)
    var placedAt: Instant = Instant.EPOCH,

    @Column(name = "filled_at")
    var filledAt: Instant? = null,

    @Column(name = "cancelled_at")
    var cancelledAt: Instant? = null,

    @Column(name = "audit_hash_prev", length = 64)
    var auditHashPrev: String? = null,

    @Column(name = "audit_hash_current", nullable = false, length = 64)
    var auditHashCurrent: String = "",
)
