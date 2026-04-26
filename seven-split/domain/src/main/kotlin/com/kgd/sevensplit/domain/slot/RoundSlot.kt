package com.kgd.sevensplit.domain.slot

import com.kgd.sevensplit.domain.common.Percent
import com.kgd.sevensplit.domain.common.Price
import com.kgd.sevensplit.domain.common.Quantity
import com.kgd.sevensplit.domain.common.RunId
import com.kgd.sevensplit.domain.common.SlotId
import com.kgd.sevensplit.domain.exception.IllegalSlotTransitionException
import com.kgd.sevensplit.domain.exception.StopLossAttemptException

/**
 * RoundSlot — 분할 매수의 한 회차를 표현하는 Entity.
 *
 * 상태 전이는 모두 이 Entity의 메서드를 통해서만 이루어지며, 필드는 `private set` 으로 캡슐화된다 (ADR-0022).
 *
 * 부분체결(OQ-020)은 별도 substate 없이 `filledQty / targetQty` 로 표현한다:
 *   - fillBuy() 호출 시 `filledQty` 누적
 *   - `filledQty >= targetQty` 이면 `FILLED` 전이
 *   - Phase 1은 단일 체결만 가정하므로 `entryPrice`는 마지막 체결가로 덮어쓴다.
 *     (partial fill 누적 가중평균은 Phase 2에서 도입 예정 — TODO)
 */
class RoundSlot internal constructor(
    val id: SlotId,
    val runId: RunId,
    val roundIndex: Int,
    state: RoundSlotState,
    entryPrice: Price?,
    val targetQty: Quantity,
    filledQty: Quantity,
    val takeProfitPercent: Percent
) {
    var state: RoundSlotState = state
        private set

    var entryPrice: Price? = entryPrice
        private set

    var filledQty: Quantity = filledQty
        private set

    init {
        require(roundIndex >= 0) { "roundIndex must be >= 0 but was $roundIndex" }
        require(takeProfitPercent.isPositive()) {
            "takeProfitPercent must be positive but was ${takeProfitPercent.value}"
        }
    }

    /** 매수 주문 요청 — 예정 진입가 기록. */
    fun requestBuy(price: Price) {
        state.ensureTransition(RoundSlotState.PENDING_BUY)
        this.entryPrice = price
        this.state = RoundSlotState.PENDING_BUY
    }

    /** 매수 체결 반영. partial fill은 targetQty 도달 전까지 PENDING_BUY 유지. */
    fun fillBuy(executedPrice: Price, executedQty: Quantity) {
        if (state != RoundSlotState.PENDING_BUY) {
            throw IllegalSlotTransitionException(
                "fillBuy requires PENDING_BUY state but was $state"
            )
        }
        val newFilledQty = filledQty + executedQty
        this.filledQty = newFilledQty
        if (newFilledQty >= targetQty) {
            // Phase 1 단순화: 가장 마지막 체결가를 entryPrice 로 확정.
            // TODO: Phase 2 — VWAP(가중평균체결가)로 교체.
            this.entryPrice = executedPrice
            state.ensureTransition(RoundSlotState.FILLED)
            this.state = RoundSlotState.FILLED
        }
    }

    /** 매수 주문이 취소/실패했을 때 EMPTY 로 되돌린다. */
    fun cancelBuy() {
        state.ensureTransition(RoundSlotState.EMPTY)
        this.entryPrice = null
        this.filledQty = Quantity.ZERO
        this.state = RoundSlotState.EMPTY
    }

    /** 매도 주문 요청 — FILLED 에서만 허용. */
    fun requestSell() {
        state.ensureTransition(RoundSlotState.PENDING_SELL)
        this.state = RoundSlotState.PENDING_SELL
    }

    /**
     * 매도 체결 반영.
     *
     * INV-02 precondition: `executedPrice >= entryPrice * (1 + takeProfitPercent/100)`
     * 위반 시 [StopLossAttemptException] — 7분할 전략은 손실 매도를 허용하지 않는다.
     */
    fun fillSell(executedPrice: Price) {
        if (state != RoundSlotState.PENDING_SELL) {
            throw IllegalSlotTransitionException(
                "fillSell requires PENDING_SELL state but was $state"
            )
        }
        val entry = entryPrice
            ?: throw IllegalSlotTransitionException("fillSell requires entryPrice to be set")
        val threshold = entry * takeProfitPercent.toMultiplier()
        if (executedPrice < threshold) {
            throw StopLossAttemptException(
                "Stop-loss attempted: executedPrice=${executedPrice.value} < threshold=${threshold.value} " +
                        "(entryPrice=${entry.value}, takeProfitPercent=${takeProfitPercent.value})"
            )
        }
        state.ensureTransition(RoundSlotState.CLOSED)
        this.state = RoundSlotState.CLOSED
    }

    /** 매도 주문 취소 — PENDING_SELL 에서 FILLED 로 되돌린다. */
    fun cancelSell() {
        state.ensureTransition(RoundSlotState.FILLED)
        this.state = RoundSlotState.FILLED
    }

    /** 슬롯 재활용: CLOSED → EMPTY. entryPrice/filledQty 리셋. */
    fun release() {
        state.ensureTransition(RoundSlotState.EMPTY)
        this.entryPrice = null
        this.filledQty = Quantity.ZERO
        this.state = RoundSlotState.EMPTY
    }

    /**
     * 현재가가 매도 트리거 조건을 만족하는지 pure 평가.
     * FILLED 상태가 아니면 항상 false.
     */
    fun evaluateSellTrigger(currentPrice: Price): Boolean {
        if (state != RoundSlotState.FILLED) return false
        val entry = entryPrice ?: return false
        val threshold = entry * takeProfitPercent.toMultiplier()
        return currentPrice >= threshold
    }

    companion object {
        /** 새 빈 슬롯 생성. */
        fun create(
            id: SlotId,
            runId: RunId,
            roundIndex: Int,
            targetQty: Quantity,
            takeProfitPercent: Percent
        ): RoundSlot = RoundSlot(
            id = id,
            runId = runId,
            roundIndex = roundIndex,
            state = RoundSlotState.EMPTY,
            entryPrice = null,
            targetQty = targetQty,
            filledQty = Quantity.ZERO,
            takeProfitPercent = takeProfitPercent
        )

        /** Repository 복원용 (모든 필드 명시). */
        fun reconstruct(
            id: SlotId,
            runId: RunId,
            roundIndex: Int,
            state: RoundSlotState,
            entryPrice: Price?,
            targetQty: Quantity,
            filledQty: Quantity,
            takeProfitPercent: Percent
        ): RoundSlot = RoundSlot(
            id = id,
            runId = runId,
            roundIndex = roundIndex,
            state = state,
            entryPrice = entryPrice,
            targetQty = targetQty,
            filledQty = filledQty,
            takeProfitPercent = takeProfitPercent
        )
    }
}
