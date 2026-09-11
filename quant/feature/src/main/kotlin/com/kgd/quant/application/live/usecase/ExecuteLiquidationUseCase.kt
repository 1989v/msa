package com.kgd.quant.application.live.usecase

import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId

/** Phase 3 실매매 긴급 청산 — Phase 1 에서는 501 로 차단된다 */
interface ExecuteLiquidationUseCase {
    suspend fun execute(tenantId: TenantId, strategyId: StrategyId)
}
