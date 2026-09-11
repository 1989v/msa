package com.kgd.quant.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/**
 * SignalStrategyEntity — `signal_strategy` 테이블 매핑 (V20260504_001).
 *
 * SignalConfig / PositionSizing 은 [com.kgd.quant.presentation.dto.SignalConfigDto] /
 * [com.kgd.quant.presentation.dto.PositionSizingDto] 의 polymorphic JSON 으로 직렬화되어
 * `entry_signal_json` / `exit_signal_json` / `sizing_json` 컬럼에 저장된다.
 */
@Entity
@Table(name = "signal_strategy")
class SignalStrategyEntity(
    @Id
    @Column(name = "strategy_id", columnDefinition = "BINARY(16)", nullable = false)
    var strategyId: UUID = UUID.randomUUID(),

    @Column(name = "tenant_id", nullable = false, length = 64)
    var tenantId: String = "",

    @Column(name = "asset_code", nullable = false, length = 32)
    var assetCode: String = "",

    @Column(name = "asset_class", nullable = false, length = 16)
    var assetClass: String = "",

    @Column(name = "market_code", nullable = false, length = 32)
    var marketCode: String = "",

    @Column(name = "entry_signal_json", nullable = false, columnDefinition = "JSON")
    var entrySignalJson: String = "",

    @Column(name = "exit_signal_json", nullable = true, columnDefinition = "JSON")
    var exitSignalJson: String? = null,

    @Column(name = "sizing_json", nullable = false, columnDefinition = "JSON")
    var sizingJson: String = "",

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),
)
