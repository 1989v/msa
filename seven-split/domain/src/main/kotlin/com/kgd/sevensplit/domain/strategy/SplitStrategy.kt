package com.kgd.sevensplit.domain.strategy

import com.kgd.sevensplit.domain.common.ExecutionMode
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.event.DomainEvent
import com.kgd.sevensplit.domain.event.StrategyActivated
import com.kgd.sevensplit.domain.event.StrategyLiquidated
import com.kgd.sevensplit.domain.event.StrategyPaused
import com.kgd.sevensplit.domain.event.StrategyResumed
import com.kgd.sevensplit.domain.slot.RoundSlot
import com.kgd.sevensplit.domain.slot.RoundSlotState

/**
 * SplitStrategy — 7분할 전략 Aggregate Root.
 *
 * 상태 전이는 반드시 이 Aggregate의 메서드를 경유한다 (ADR-0022).
 * 메서드는 `DomainEvent` 를 반환하여 Application 레이어가 이벤트 버스에 실을 수 있게 한다.
 */
class SplitStrategy internal constructor(
    val id: StrategyId,
    val tenantId: TenantId,
    val config: SplitStrategyConfig,
    val executionMode: ExecutionMode,
    status: StrategyStatus
) {
    var status: StrategyStatus = status
        private set

    fun activate(): DomainEvent {
        status.ensureTransition(StrategyStatus.ACTIVE)
        status = StrategyStatus.ACTIVE
        return StrategyActivated(
            tenantId = tenantId,
            strategyId = id
        )
    }

    fun pause(): DomainEvent {
        status.ensureTransition(StrategyStatus.PAUSED)
        status = StrategyStatus.PAUSED
        return StrategyPaused(
            tenantId = tenantId,
            strategyId = id
        )
    }

    fun resume(): DomainEvent {
        status.ensureTransition(StrategyStatus.ACTIVE)
        status = StrategyStatus.ACTIVE
        return StrategyResumed(
            tenantId = tenantId,
            strategyId = id
        )
    }

    fun liquidate(reason: EndReason): DomainEvent {
        status.ensureTransition(StrategyStatus.LIQUIDATED)
        status = StrategyStatus.LIQUIDATED
        return StrategyLiquidated(
            tenantId = tenantId,
            strategyId = id,
            reason = reason
        )
    }

    /**
     * 다음 회차 진입 조건을 반환한다.
     *
     * - `lastFilled == null` 이면 1회차 시작이므로 [PriceCondition.Immediate] (즉시 시장가).
     * - 그 외에는 직전 체결가에서 `entryGapPercent` 만큼 하락한 가격 이하를 트리거로 삼는다
     *   (`entryGapPercent`는 음수이므로 `(1 + entryGapPercent/100)` < 1).
     */
    fun nextRoundEntryCondition(lastFilled: RoundSlot?): PriceCondition {
        if (lastFilled == null) return PriceCondition.Immediate
        require(lastFilled.state == RoundSlotState.FILLED) {
            "nextRoundEntryCondition requires a FILLED slot but was ${lastFilled.state}"
        }
        val entry = lastFilled.entryPrice
            ?: error("FILLED slot must have entryPrice")
        val threshold = entry * config.entryGapPercent.toMultiplier()
        return PriceCondition.AtOrBelow(threshold)
    }

    companion object {
        /** 신규 전략 생성 — 항상 DRAFT 로 시작. */
        fun create(
            tenantId: TenantId,
            config: SplitStrategyConfig,
            executionMode: ExecutionMode,
            id: StrategyId = StrategyId.newId()
        ): SplitStrategy = SplitStrategy(
            id = id,
            tenantId = tenantId,
            config = config,
            executionMode = executionMode,
            status = StrategyStatus.DRAFT
        )

        /** Repository 복원용. */
        fun reconstruct(
            id: StrategyId,
            tenantId: TenantId,
            config: SplitStrategyConfig,
            executionMode: ExecutionMode,
            status: StrategyStatus
        ): SplitStrategy = SplitStrategy(
            id = id,
            tenantId = tenantId,
            config = config,
            executionMode = executionMode,
            status = status
        )
    }
}
