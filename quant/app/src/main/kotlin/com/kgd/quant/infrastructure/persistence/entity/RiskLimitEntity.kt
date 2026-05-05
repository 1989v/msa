package com.kgd.quant.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

/**
 * TG-P3-14 — `risk_limit` JPA Entity (ADR-0037).
 *
 * tenant_id 는 도메인 TenantId 가 String 이지만, DB 컬럼은 BINARY(16) 으로 UUID 가정 (다른 테이블과 일관).
 * 도메인이 String 인 이유는 opaque 식별자 호환성 때문 — 실 운영에서 UUID 형식 enforced.
 */
@Entity
@Table(name = "risk_limit")
class RiskLimitEntity(
    @Id
    @Column(name = "tenant_id", columnDefinition = "BINARY(16)")
    var tenantId: UUID = UUID(0, 0),

    @Column(name = "daily_loss_limit_krw", nullable = false, precision = 20, scale = 2)
    var dailyLossLimitKrw: BigDecimal = BigDecimal.ZERO,

    @Column(name = "daily_volume_limit_krw", nullable = false, precision = 20, scale = 2)
    var dailyVolumeLimitKrw: BigDecimal = BigDecimal.ZERO,

    @Column(name = "single_order_max_krw", nullable = false, precision = 20, scale = 2)
    var singleOrderMaxKrw: BigDecimal = BigDecimal.ZERO,

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.EPOCH,

    @Column(name = "updated_by", nullable = false)
    var updatedBy: Long = 0L,
)
