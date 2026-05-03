package com.kgd.quant.application.usecase

import com.kgd.quant.application.port.persistence.SignalStrategyRepositoryPort
import com.kgd.quant.domain.asset.Asset
import com.kgd.quant.domain.common.Clock
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.market.Market
import com.kgd.quant.domain.strategy.PositionSizing
import com.kgd.quant.domain.strategy.SignalConfig
import com.kgd.quant.domain.strategy.SignalStrategy
import org.springframework.stereotype.Component
import java.util.UUID

/**
 * RegisterSignalStrategyUseCase — 시그널 strategy 신규 등록 (ADR-0033 Phase 1).
 */
@Component
class RegisterSignalStrategyUseCase(
    private val repo: SignalStrategyRepositoryPort,
    private val clock: Clock,
) {
    suspend fun execute(
        tenantId: TenantId,
        asset: Asset,
        market: Market,
        entrySignal: SignalConfig,
        exitSignal: SignalConfig?,
        sizing: PositionSizing,
    ): SignalStrategy {
        val strategy = SignalStrategy(
            id = StrategyId(UUID.randomUUID()),
            tenantId = tenantId,
            asset = asset,
            market = market,
            entrySignal = entrySignal,
            exitSignal = exitSignal,
            sizing = sizing,
            createdAt = clock.now(),
        )
        return repo.save(strategy)
    }
}
