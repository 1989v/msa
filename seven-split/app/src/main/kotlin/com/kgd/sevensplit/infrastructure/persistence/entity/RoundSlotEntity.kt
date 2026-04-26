package com.kgd.sevensplit.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

/**
 * TG-08.2: `round_slot` 테이블 매핑 Entity.
 *
 * 도메인 `RoundSlot` 의 상태 (`EMPTY/PENDING_BUY/FILLED/PENDING_SELL/CLOSED`) 과
 * 부분체결 `filledQty` 를 그대로 스냅샷한다.
 */
@Entity
@Table(name = "round_slot")
class RoundSlotEntity(
    @Id
    @Column(name = "slot_id", columnDefinition = "BINARY(16)", nullable = false)
    var slotId: UUID = UUID.randomUUID(),

    @Column(name = "run_id", columnDefinition = "BINARY(16)", nullable = false)
    var runId: UUID = UUID.randomUUID(),

    @Column(name = "tenant_id", nullable = false, length = 64)
    var tenantId: String = "",

    @Column(name = "round_index", nullable = false)
    var roundIndex: Int = 0,

    @Column(name = "state", nullable = false, length = 32)
    var state: String = "",

    @Column(name = "entry_price", nullable = true, precision = 38, scale = 8)
    var entryPrice: BigDecimal? = null,

    @Column(name = "target_qty", nullable = false, precision = 38, scale = 8)
    var targetQty: BigDecimal = BigDecimal.ZERO,

    @Column(name = "filled_qty", nullable = false, precision = 38, scale = 8)
    var filledQty: BigDecimal = BigDecimal.ZERO,

    @Column(name = "take_profit_percent", nullable = false, precision = 18, scale = 8)
    var takeProfitPercent: BigDecimal = BigDecimal.ZERO,

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
)
