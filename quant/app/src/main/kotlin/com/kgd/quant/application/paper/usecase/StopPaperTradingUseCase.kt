package com.kgd.quant.application.paper.usecase

import com.kgd.quant.domain.common.RunId
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.strategy.EndReason

/** PAPER 모드 전략 정지/청산 (TG-P2-09) — 종료 사유는 COMPLETED 가 아니다 */
interface StopPaperTradingUseCase {
    suspend fun execute(command: StopPaperTradingCommand)
}

/**
 * StopPaperTradingCommand — UseCase 입력 DTO.
 *
 * @param reason 기본 USER_LIQUIDATED. COMPLETED 는 require 가드로 차단된다.
 */
data class StopPaperTradingCommand(
    val tenantId: TenantId,
    val strategyId: StrategyId,
    val runId: RunId,
    val reason: EndReason = EndReason.USER_LIQUIDATED
)
