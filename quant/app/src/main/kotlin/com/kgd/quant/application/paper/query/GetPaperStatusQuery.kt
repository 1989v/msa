package com.kgd.quant.application.paper.query

import com.kgd.quant.application.exception.StrategyNotFoundException
import com.kgd.quant.application.paper.port.PaperAccountRepositoryPort
import com.kgd.quant.application.port.persistence.TrancheSlotRepositoryPort
import com.kgd.quant.application.port.persistence.StrategyRepositoryPort
import com.kgd.quant.application.port.persistence.StrategyRunRepositoryPort
import com.kgd.quant.domain.common.ExecutionMode
import com.kgd.quant.domain.common.RunId
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.tranche.TrancheSlotState
import com.kgd.quant.domain.strategy.StrategyRunStatus
import com.kgd.quant.domain.strategy.StrategyStatus
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.time.Instant

/**
 * GetPaperStatusQuery — PAPER 전략의 현재 상태 스냅샷 조회 (TG-P2-09).
 *
 * 반환 [PaperStatusView] :
 * - StrategyStatus / 가장 최근 StrategyRun (있으면) 의 상태
 * - PaperAccount 현재 잔고
 * - TrancheSlot 상태 카운트 (FILLED/PENDING/EMPTY/CLOSED)
 *
 * Phase 2 단순화: realized PnL / unrealized PnL 계산은 TG-P2-13 SSE 와 함께 후속 도입.
 */
@Component
class GetPaperStatusQuery(
    private val strategyRepository: StrategyRepositoryPort,
    private val runRepository: StrategyRunRepositoryPort,
    private val slotRepository: TrancheSlotRepositoryPort,
    private val accountRepository: PaperAccountRepositoryPort
) {

    suspend fun execute(tenantId: TenantId, strategyId: StrategyId): PaperStatusView {
        val strategy = strategyRepository.findById(tenantId, strategyId)
            ?: throw StrategyNotFoundException(strategyId, tenantId)
        check(strategy.executionMode == ExecutionMode.PAPER) {
            "GetPaperStatusQuery: strategy executionMode must be PAPER but was ${strategy.executionMode}"
        }

        val runs = runRepository.findByStrategyId(tenantId, strategyId)
        val latestRun = runs.maxByOrNull { it.startedAt }

        val slots = latestRun?.let { slotRepository.findByRunId(tenantId, it.id) } ?: emptyList()
        val slotCounts = slots.groupingBy { it.state }.eachCount()

        val account = accountRepository.load(tenantId, strategyId)
        val balance = account?.balance ?: BigDecimal.ZERO

        return PaperStatusView(
            tenantId = tenantId,
            strategyId = strategyId,
            strategyStatus = strategy.status,
            runId = latestRun?.id,
            runStatus = latestRun?.status,
            startedAt = latestRun?.startedAt,
            endedAt = latestRun?.endedAt,
            balance = balance,
            slotCounts = slotCounts
        )
    }
}

/**
 * PaperStatusView — Phase 2 PAPER 모드 dashboard 응답 DTO.
 */
data class PaperStatusView(
    val tenantId: TenantId,
    val strategyId: StrategyId,
    val strategyStatus: StrategyStatus,
    val runId: RunId?,
    val runStatus: StrategyRunStatus?,
    val startedAt: Instant?,
    val endedAt: Instant?,
    val balance: BigDecimal,
    val slotCounts: Map<TrancheSlotState, Int>
)
