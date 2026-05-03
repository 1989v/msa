package com.kgd.quant.application.view

import com.kgd.quant.domain.common.Percent
import com.kgd.quant.domain.common.Price
import com.kgd.quant.domain.common.Quantity
import com.kgd.quant.domain.common.SlotId
import com.kgd.quant.domain.tranche.TrancheSlot
import com.kgd.quant.domain.tranche.TrancheSlotState

/**
 * SlotView — 백테스트 상세 응답의 회차 슬롯 한 건.
 */
data class SlotView(
    val slotId: SlotId,
    val roundIndex: Int,
    val state: TrancheSlotState,
    val entryPrice: Price?,
    val targetQty: Quantity,
    val filledQty: Quantity,
    val takeProfitPercent: Percent
) {
    companion object {
        fun from(slot: TrancheSlot): SlotView = SlotView(
            slotId = slot.id,
            roundIndex = slot.roundIndex,
            state = slot.state,
            entryPrice = slot.entryPrice,
            targetQty = slot.targetQty,
            filledQty = slot.filledQty,
            takeProfitPercent = slot.takeProfitPercent
        )
    }
}
