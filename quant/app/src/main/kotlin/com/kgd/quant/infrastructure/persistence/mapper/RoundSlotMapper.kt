package com.kgd.quant.infrastructure.persistence.mapper

import com.kgd.quant.domain.common.Percent
import com.kgd.quant.domain.common.Price
import com.kgd.quant.domain.common.Quantity
import com.kgd.quant.domain.common.RunId
import com.kgd.quant.domain.common.SlotId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.slot.TrancheSlot
import com.kgd.quant.domain.slot.TrancheSlotState
import com.kgd.quant.infrastructure.persistence.entity.TrancheSlotEntity
import java.time.Instant

/**
 * TG-08.4: `TrancheSlot` ↔ `TrancheSlotEntity` 변환.
 *
 * 도메인 `TrancheSlot` 은 tenantId 를 가지지 않으므로, adapter 호출부에서 명시적으로
 * [TenantId] 를 주입받아 저장한다 (INV-05).
 */
object TrancheSlotMapper {

    fun toEntity(
        domain: TrancheSlot,
        tenantId: TenantId,
        updatedAt: Instant
    ): TrancheSlotEntity = TrancheSlotEntity(
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
        entity: TrancheSlotEntity,
        domain: TrancheSlot,
        tenantId: TenantId,
        updatedAt: Instant
    ): TrancheSlotEntity {
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

    fun toDomain(entity: TrancheSlotEntity): TrancheSlot = TrancheSlot.reconstruct(
        id = SlotId(entity.slotId),
        runId = RunId(entity.runId),
        roundIndex = entity.roundIndex,
        state = TrancheSlotState.valueOf(entity.state),
        entryPrice = entity.entryPrice?.let { Price(it) },
        targetQty = Quantity(entity.targetQty),
        filledQty = Quantity(entity.filledQty),
        takeProfitPercent = Percent(entity.takeProfitPercent)
    )
}
