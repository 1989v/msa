package com.kgd.sevensplit.infrastructure.persistence.mapper

import com.kgd.sevensplit.domain.common.Percent
import com.kgd.sevensplit.domain.common.Price
import com.kgd.sevensplit.domain.common.Quantity
import com.kgd.sevensplit.domain.common.RunId
import com.kgd.sevensplit.domain.common.SlotId
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.slot.RoundSlot
import com.kgd.sevensplit.domain.slot.RoundSlotState
import com.kgd.sevensplit.infrastructure.persistence.entity.RoundSlotEntity
import java.time.Instant

/**
 * TG-08.4: `RoundSlot` ↔ `RoundSlotEntity` 변환.
 *
 * 도메인 `RoundSlot` 은 tenantId 를 가지지 않으므로, adapter 호출부에서 명시적으로
 * [TenantId] 를 주입받아 저장한다 (INV-05).
 */
object RoundSlotMapper {

    fun toEntity(
        domain: RoundSlot,
        tenantId: TenantId,
        updatedAt: Instant
    ): RoundSlotEntity = RoundSlotEntity(
        slotId = domain.id.value,
        runId = domain.runId.value,
        tenantId = tenantId.value,
        roundIndex = domain.roundIndex,
        state = domain.state.name,
        entryPrice = domain.entryPrice?.value,
        targetQty = domain.targetQty.value,
        filledQty = domain.filledQty.value,
        takeProfitPercent = domain.takeProfitPercent.value,
        updatedAt = updatedAt
    )

    fun applyToEntity(
        entity: RoundSlotEntity,
        domain: RoundSlot,
        tenantId: TenantId,
        updatedAt: Instant
    ): RoundSlotEntity {
        entity.runId = domain.runId.value
        entity.tenantId = tenantId.value
        entity.roundIndex = domain.roundIndex
        entity.state = domain.state.name
        entity.entryPrice = domain.entryPrice?.value
        entity.targetQty = domain.targetQty.value
        entity.filledQty = domain.filledQty.value
        entity.takeProfitPercent = domain.takeProfitPercent.value
        entity.updatedAt = updatedAt
        return entity
    }

    fun toDomain(entity: RoundSlotEntity): RoundSlot = RoundSlot.reconstruct(
        id = SlotId(entity.slotId),
        runId = RunId(entity.runId),
        roundIndex = entity.roundIndex,
        state = RoundSlotState.valueOf(entity.state),
        entryPrice = entity.entryPrice?.let { Price(it) },
        targetQty = Quantity(entity.targetQty),
        filledQty = Quantity(entity.filledQty),
        takeProfitPercent = Percent(entity.takeProfitPercent)
    )
}
