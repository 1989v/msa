package com.kgd.sevensplit.application.view

import com.kgd.sevensplit.domain.common.Percent
import com.kgd.sevensplit.domain.common.Price
import com.kgd.sevensplit.domain.common.Quantity
import com.kgd.sevensplit.domain.common.SlotId
import com.kgd.sevensplit.domain.slot.RoundSlot
import com.kgd.sevensplit.domain.slot.RoundSlotState

/**
 * SlotView — 백테스트 상세 응답의 회차 슬롯 한 건.
 */
data class SlotView(
    val slotId: SlotId,
    val roundIndex: Int,
    val state: RoundSlotState,
    val entryPrice: Price?,
    val targetQty: Quantity,
    val filledQty: Quantity,
    val takeProfitPercent: Percent
) {
    companion object {
        fun from(slot: RoundSlot): SlotView = SlotView(
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
