package com.kgd.quant.application.backtest.usecase

import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import java.math.BigDecimal
import java.time.Instant

/**
 * SignalStrategy 백테스트 (ADR-0036 P2 + G2/H3).
 *
 * VolumeSpike / RsiBreakout / MaCross / BollingerSqueeze / KimchiPremiumThreshold 를 평가하고
 * 첫 trigger 봉 매수 → 마지막 봉 매도의 단순 PnL 을 낸다. 슬리피지/수수료 미반영.
 */
interface RunSignalBacktestUseCase {
    suspend fun execute(
        tenantId: TenantId,
        strategyId: StrategyId,
        from: Instant,
        to: Instant,
        interval: String = "1d",
    ): SignalBacktestSummary

    data class SignalBacktestSummary(
        val strategyId: String,
        val from: Instant,
        val to: Instant,
        val barCount: Int,
        val triggerCount: Int,
        val firstEntryAt: Instant?,
        val entryPrice: BigDecimal,
        val exitPrice: BigDecimal,
        val realizedPnl: BigDecimal,
    )
}
