package com.kgd.sevensplit.domain.strategy

import com.kgd.sevensplit.domain.common.ExecutionMode
import com.kgd.sevensplit.domain.common.RunId
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import java.time.Instant

/**
 * StrategyRun — 전략의 한 실행 세션을 표현하는 Entity.
 *
 * 동일 전략을 여러 번 실행할 수 있으며, 각 실행은 독립된 run으로 기록된다.
 * `seed`는 BACKTEST/PAPER 모드에서 재현성을 보장하기 위한 난수 시드.
 */
class StrategyRun internal constructor(
    val id: RunId,
    val strategyId: StrategyId,
    val tenantId: TenantId,
    val startedAt: Instant,
    endedAt: Instant?,
    val executionMode: ExecutionMode,
    val seed: Long,
    endReason: EndReason?,
    status: StrategyRunStatus
) {
    var status: StrategyRunStatus = status
        private set

    var endedAt: Instant? = endedAt
        private set

    var endReason: EndReason? = endReason
        private set

    /** 초기 상태에서 실제 거래 진행 상태로 전이. */
    fun start() {
        status.ensureTransition(StrategyRunStatus.ACTIVE)
        status = StrategyRunStatus.ACTIVE
    }

    /** 모든 슬롯이 소진되어 (매도 완료 대기) 추가 매수가 없는 상태. */
    fun enterAwaitingExhausted() {
        status.ensureTransition(StrategyRunStatus.AWAITING_EXHAUSTED)
        status = StrategyRunStatus.AWAITING_EXHAUSTED
    }

    /** AWAITING_EXHAUSTED 에서 새 매수 기회가 생겨 다시 ACTIVE 로 돌아갈 때. */
    fun backToActive() {
        status.ensureTransition(StrategyRunStatus.ACTIVE)
        status = StrategyRunStatus.ACTIVE
    }

    /** 청산 절차 시작. */
    fun beginLiquidation() {
        status.ensureTransition(StrategyRunStatus.LIQUIDATING)
        status = StrategyRunStatus.LIQUIDATING
    }

    /**
     * 종료 — endedAt/endReason 설정 후 CLOSED 상태로 전이.
     * 이미 LIQUIDATING 상태에서만 호출 가능.
     */
    fun end(reason: EndReason, now: Instant) {
        status.ensureTransition(StrategyRunStatus.CLOSED)
        this.endedAt = now
        this.endReason = reason
        this.status = StrategyRunStatus.CLOSED
    }

    companion object {
        fun create(
            strategyId: StrategyId,
            tenantId: TenantId,
            startedAt: Instant,
            executionMode: ExecutionMode,
            seed: Long,
            id: RunId = RunId.newId()
        ): StrategyRun = StrategyRun(
            id = id,
            strategyId = strategyId,
            tenantId = tenantId,
            startedAt = startedAt,
            endedAt = null,
            executionMode = executionMode,
            seed = seed,
            endReason = null,
            status = StrategyRunStatus.INITIALIZED
        )

        fun reconstruct(
            id: RunId,
            strategyId: StrategyId,
            tenantId: TenantId,
            startedAt: Instant,
            endedAt: Instant?,
            executionMode: ExecutionMode,
            seed: Long,
            endReason: EndReason?,
            status: StrategyRunStatus
        ): StrategyRun = StrategyRun(
            id = id,
            strategyId = strategyId,
            tenantId = tenantId,
            startedAt = startedAt,
            endedAt = endedAt,
            executionMode = executionMode,
            seed = seed,
            endReason = endReason,
            status = status
        )
    }
}
