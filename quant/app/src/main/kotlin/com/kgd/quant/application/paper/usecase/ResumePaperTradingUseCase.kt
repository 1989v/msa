package com.kgd.quant.application.paper.usecase

import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId

/** PAPER 모드 전략 재개 (TG-P2-09) */
interface ResumePaperTradingUseCase {
    suspend fun execute(command: ResumePaperTradingCommand)
}

data class ResumePaperTradingCommand(
    val tenantId: TenantId,
    val strategyId: StrategyId
)
