package com.kgd.quant.application.usecase

import com.kgd.quant.application.indicator.IndicatorCalculator
import com.kgd.quant.application.port.persistence.OhlcvRepositoryPort
import com.kgd.quant.domain.market.MarketCode
import com.kgd.quant.domain.strategy.HybridStrategy
import com.kgd.quant.domain.strategy.MaCross
import com.kgd.quant.domain.strategy.RsiBreakout
import com.kgd.quant.domain.strategy.SignalConfig
import com.kgd.quant.domain.strategy.VolumeSpike
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant

/**
 * RunHybridBacktestUseCase — HybridStrategy 백테스트 (ADR-0036 P2-T16~T19).
 *
 * 평가 시퀀스:
 * 1. 기간 OHLCV 로드
 * 2. 시그널 게이트 평가 (signalGate.entrySignal)
 * 3. 게이트 trigger 가 true 인 봉 → 분할 진입(tranche) 시작
 * 4. 회차별 익절은 trancheBase.config 의 take-profit 규칙 (단순화: 회차 매수가 대비 +X%)
 * 5. 결과: 시그널 trigger 횟수 / 진입 회차 / 실현 PnL placeholder
 *
 * Phase 2 단순화:
 * - 슬리피지 / 수수료 미반영 (Phase 3)
 * - paper trading 으로 확장은 Phase 3
 */
@Component
class RunHybridBacktestUseCase(
    private val ohlcvRepo: OhlcvRepositoryPort,
    private val calculator: IndicatorCalculator,
) {
    suspend fun execute(
        strategy: HybridStrategy,
        from: Instant,
        to: Instant,
        interval: String = "1d",
    ): HybridBacktestSummary {
        val bars = ohlcvRepo.query(strategy.asset.code, strategy.market.code, interval, from, to)
        if (bars.isEmpty()) return EMPTY

        val triggers = evaluateGate(bars, strategy.signalGate.entrySignal)
        val triggerCount = triggers.count { it }
        val entryBarIndices = triggers.withIndex().filter { it.value }.map { it.index }

        // 단순화: 첫 게이트 trigger 봉에서 분할 진입 시작 — 회차는 trancheBase.config.roundCount
        val roundCount = strategy.trancheBase.config.roundCount
        val rounds = entryBarIndices.firstOrNull()?.let { firstIdx ->
            (0 until roundCount).mapNotNull { round ->
                val barIdx = firstIdx + round
                if (barIdx < bars.size) RoundFill(round, bars[barIdx].ts, bars[barIdx].close) else null
            }
        } ?: emptyList()

        val realizedPnl = if (rounds.isEmpty()) BigDecimal.ZERO
        else {
            val avgEntry = rounds.map { it.entryPrice }
                .reduce { a, b -> a.add(b) }
                .divide(BigDecimal(rounds.size), 8, RoundingMode.HALF_UP)
            val finalClose = bars.last().close
            finalClose.subtract(avgEntry).multiply(BigDecimal(rounds.size))
                .setScale(8, RoundingMode.HALF_UP)
        }

        return HybridBacktestSummary(
            strategyId = strategy.id.value.toString(),
            from = bars.first().ts,
            to = bars.last().ts,
            barCount = bars.size,
            signalTriggerCount = triggerCount,
            roundEntries = rounds,
            realizedPnl = realizedPnl,
        )
    }

    /**
     * 시그널 평가 — VolumeSpike/RsiBreakout/MaCross/BB squeeze/KimchiPremium 5종 중 일부 지원.
     * Phase 2 단순화: VolumeSpike / RsiBreakout / MaCross 만. 나머지는 false.
     */
    private fun evaluateGate(bars: List<IndicatorCalculator.Bar>, config: SignalConfig): List<Boolean> {
        return when (config) {
            is VolumeSpike -> evaluateVolumeSpike(bars, config)
            is RsiBreakout -> evaluateRsiBreakout(bars, config)
            is MaCross -> evaluateMaCross(bars, config)
            else -> List(bars.size) { false }
        }
    }

    private fun evaluateVolumeSpike(bars: List<IndicatorCalculator.Bar>, config: VolumeSpike): List<Boolean> {
        val window = config.window
        return bars.indices.map { i ->
            if (i < window) false
            else {
                val avg = (i - window until i).map { bars[it].volume }
                    .reduce { a, b -> a.add(b) }
                    .divide(BigDecimal(window), 8, RoundingMode.HALF_UP)
                bars[i].volume >= avg.multiply(config.multiplier)
            }
        }
    }

    private fun evaluateRsiBreakout(bars: List<IndicatorCalculator.Bar>, config: RsiBreakout): List<Boolean> {
        val rsi = calculator.rsi(bars, config.period)
        return rsi.map { p ->
            when (config.direction) {
                RsiBreakout.Direction.OVERSOLD -> p.value < config.threshold
                RsiBreakout.Direction.OVERBOUGHT -> p.value > config.threshold
            }
        }
    }

    private fun evaluateMaCross(bars: List<IndicatorCalculator.Bar>, config: MaCross): List<Boolean> {
        val fast = calculator.sma(bars, config.fastPeriod)
        val slow = calculator.sma(bars, config.slowPeriod)
        return bars.indices.map { i ->
            if (i == 0) false
            else when (config.direction) {
                MaCross.CrossDirection.GOLDEN ->
                    fast[i - 1].value <= slow[i - 1].value && fast[i].value > slow[i].value
                MaCross.CrossDirection.DEAD ->
                    fast[i - 1].value >= slow[i - 1].value && fast[i].value < slow[i].value
            }
        }
    }

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

    companion object {
        private val EMPTY = HybridBacktestSummary(
            strategyId = "",
            from = Instant.EPOCH,
            to = Instant.EPOCH,
            barCount = 0,
            signalTriggerCount = 0,
            roundEntries = emptyList(),
            realizedPnl = BigDecimal.ZERO,
        )
    }
}
