package com.kgd.quant.application.usecase

import com.kgd.quant.domain.strategy.HybridStrategy
import java.math.BigDecimal
import java.time.Instant

/**
 * HybridStrategy 백테스트 (ADR-0036 P2-T16~T19).
 *
 * 1. 기간 OHLCV 로드 → 2. 시그널 게이트 평가 → 3. trigger 봉에서 분할 진입 →
 * 4. 회차별 익절은 trancheBase.config 규칙 → 5. 결과 요약. 슬리피지/수수료는 Phase 3.
 */
interface RunHybridBacktestUseCase {
    suspend fun execute(
        strategy: HybridStrategy,
        from: Instant,
        to: Instant,
        interval: String = "1d",
    ): HybridBacktestSummary

    data class HybridBacktestSummary(
        val strategyId: String,
        val from: Instant,
        val to: Instant,
        val barCount: Int,
        val signalTriggerCount: Int,
        val roundEntries: List<RoundFill>,
        val realizedPnl: BigDecimal,
    )

    data class RoundFill(
        val roundNumber: Int,
        val ts: Instant,
        val entryPrice: BigDecimal,
    )
}
