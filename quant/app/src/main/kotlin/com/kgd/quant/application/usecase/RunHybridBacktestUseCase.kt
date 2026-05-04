package com.kgd.quant.application.usecase

import com.kgd.quant.application.indicator.IndicatorCalculator
import com.kgd.quant.application.port.persistence.KimchiPremiumTickRepositoryPort
import com.kgd.quant.application.port.persistence.OhlcvRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import com.kgd.quant.domain.strategy.BollingerSqueeze
import com.kgd.quant.domain.strategy.HybridStrategy
import com.kgd.quant.domain.strategy.KimchiPremiumThreshold
import com.kgd.quant.domain.strategy.MaCross
import com.kgd.quant.domain.strategy.RsiBreakout
import com.kgd.quant.domain.strategy.SignalConfig
import com.kgd.quant.domain.strategy.VolumeSpike
import kotlinx.coroutines.runBlocking
import org.springframework.beans.factory.ObjectProvider
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
    private val kimchiTickRepoProvider: ObjectProvider<KimchiPremiumTickRepositoryPort>,
) {
    suspend fun execute(
        strategy: HybridStrategy,
        from: Instant,
        to: Instant,
        interval: String = "1d",
    ): HybridBacktestSummary {
        val bars = ohlcvRepo.query(strategy.asset.code, strategy.market.code, interval, from, to)
        if (bars.isEmpty()) return EMPTY

        val triggers = evaluateGate(bars, strategy.signalGate.entrySignal, strategy.asset.code, strategy.market.code)
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
     * 시그널 평가 — 5종 시그널 모두 정통 평가 (I1 정통화 후).
     */
    private fun evaluateGate(
        bars: List<IndicatorCalculator.Bar>,
        config: SignalConfig,
        krAsset: AssetCode,
        krMarket: MarketCode,
    ): List<Boolean> = when (config) {
        is VolumeSpike -> evaluateVolumeSpike(bars, config)
        is RsiBreakout -> evaluateRsiBreakout(bars, config)
        is MaCross -> evaluateMaCross(bars, config)
        is BollingerSqueeze -> evaluateBollingerSqueeze(bars, config)
        is KimchiPremiumThreshold -> evaluateKimchiPremium(bars, config, krAsset, krMarket)
    }

    private fun evaluateBollingerSqueeze(
        bars: List<IndicatorCalculator.Bar>,
        c: BollingerSqueeze,
    ): List<Boolean> {
        val bb = calculator.bollinger(bars, c.period, c.stdDev)
        return bars.indices.map { i ->
            val mid = bb.middle[i].value
            if (mid.signum() == 0) false
            else {
                val width = bb.upper[i].value.subtract(bb.lower[i].value)
                val ratio = width.divide(mid, 8, RoundingMode.HALF_UP)
                ratio < c.squeezeThreshold
            }
        }
    }

    /**
     * KimchiPremium 평가 — H3 와 동일 패턴. Tick repo 미등록 환경에서는 trigger 없음.
     * suspend 가 아닌 evaluateGate 컨텍스트라 runBlocking 으로 호출 (백테스트는 동기 흐름).
     */
    private fun evaluateKimchiPremium(
        bars: List<IndicatorCalculator.Bar>,
        c: KimchiPremiumThreshold,
        krAsset: AssetCode,
        krMarket: MarketCode,
    ): List<Boolean> {
        val repo = kimchiTickRepoProvider.ifAvailable ?: return List(bars.size) { false }
        val from = bars.first().ts
        val to = bars.last().ts.plusSeconds(1)
        val ticks = runBlocking {
            repo.query(krAsset, krMarket, c.foreignMarket, from, to)
        }
        if (ticks.isEmpty()) return List(bars.size) { false }
        val tsArray = ticks.map { it.ts }
        val premiums = ticks.map { it.premiumPercent }
        return bars.map { bar ->
            val idx = priorIndex(tsArray, bar.ts)
            if (idx < 0) false else premiums[idx] >= c.entryThresholdPercent
        }
    }

    private fun priorIndex(tsArray: List<Instant>, target: Instant): Int {
        var lo = 0; var hi = tsArray.size - 1; var ans = -1
        while (lo <= hi) {
            val mid = (lo + hi) ushr 1
            if (tsArray[mid] <= target) { ans = mid; lo = mid + 1 } else hi = mid - 1
        }
        return ans
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
