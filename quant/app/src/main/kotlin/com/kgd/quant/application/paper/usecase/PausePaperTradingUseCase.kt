package com.kgd.quant.application.paper.usecase

import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId

/** PAPER 모드 전략 일시정지 (TG-P2-09) */
interface PausePaperTradingUseCase {
    suspend fun execute(command: PausePaperTradingCommand)
}

data class PausePaperTradingCommand(
    val tenantId: TenantId,
    val strategyId: StrategyId
)
