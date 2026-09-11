package com.kgd.quant.application.strategy.usecase

import com.kgd.quant.domain.asset.Asset
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.market.Market
import com.kgd.quant.domain.strategy.PositionSizing
import com.kgd.quant.domain.strategy.SignalConfig
import com.kgd.quant.domain.strategy.SignalStrategy

/** 시그널 strategy 신규 등록 (ADR-0033 Phase 1) */
interface RegisterSignalStrategyUseCase {
    suspend fun execute(
        tenantId: TenantId,
        asset: Asset,
        market: Market,
        entrySignal: SignalConfig,
        exitSignal: SignalConfig?,
        sizing: PositionSizing,
    ): SignalStrategy
}
