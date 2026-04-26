package com.kgd.sevensplit.domain.slot

import com.kgd.sevensplit.domain.exception.IllegalSlotTransitionException

/**
 * RoundSlot 상태머신.
 *
 * 전이 테이블:
 *   EMPTY         → PENDING_BUY
 *   PENDING_BUY   → FILLED          (filledQty >= targetQty 시)
 *   PENDING_BUY   → EMPTY            (주문 취소/실패 시)
 *   FILLED        → PENDING_SELL
 *   PENDING_SELL  → CLOSED           (매도 체결)
 *   PENDING_SELL  → FILLED           (매도 주문 취소)
 *   CLOSED        → EMPTY            (slot 재활용)
 */
enum class RoundSlotState {
    EMPTY,
    PENDING_BUY,
    FILLED,
    PENDING_SELL,
    CLOSED;

    fun ensureTransition(to: RoundSlotState) {
        val allowed = when (this) {
            EMPTY -> to == PENDING_BUY
            PENDING_BUY -> to == FILLED || to == EMPTY
            FILLED -> to == PENDING_SELL
            PENDING_SELL -> to == CLOSED || to == FILLED
            CLOSED -> to == EMPTY
        }
        if (!allowed) {
            throw IllegalSlotTransitionException(
                "Illegal round slot transition: $this -> $to"
            )
        }
    }
}
