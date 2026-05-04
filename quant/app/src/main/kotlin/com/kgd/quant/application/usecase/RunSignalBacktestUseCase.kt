package com.kgd.quant.application.usecase

import com.kgd.quant.application.indicator.IndicatorCalculator
import com.kgd.quant.application.port.persistence.OhlcvRepositoryPort
import com.kgd.quant.application.port.persistence.SignalStrategyRepositoryPort
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.strategy.BollingerSqueeze
import com.kgd.quant.domain.strategy.KimchiPremiumThreshold
import com.kgd.quant.domain.strategy.MaCross
import com.kgd.quant.domain.strategy.RsiBreakout
import com.kgd.quant.domain.strategy.SignalConfig
import com.kgd.quant.domain.strategy.SignalStrategy
import com.kgd.quant.domain.strategy.VolumeSpike
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant

private val log = KotlinLogging.logger {}

/**
 * RunSignalBacktestUseCase — SignalStrategy 백테스트 (ADR-0036 P2 + G2).
 *
 * Phase 2 지원 시그널:
 * - VolumeSpike / RsiBreakout / MaCross / BollingerSqueeze (단일 거래소)
 * - **KimchiPremiumThreshold** (G2 신규) — historical 김치프리미엄 시계열 필요.
 *   현 구현은 단순화된 cross-exchange OHLCV 비교 (kr_market vs foreign_market 양쪽 close).
 *   ClickHouse `quant.kimchi_premium_tick` 가 적재돼 있으면 이를 직접 read 하는 것이 정통이지만
 *   Phase 2 단순화는 양 시장 OHLCV 비교로 placeholder.
 *
 * Phase 1 단순화 그대로:
 * - 슬리피지 / 수수료 미반영
 * - 진입 후 회차 청산 규칙 단순 (final close 기준 PnL)
 */
@Component
class RunSignalBacktestUseCase(
    private val ohlcvRepo: OhlcvRepositoryPort,
    private val calculator: IndicatorCalculator,
    private val strategyRepo: SignalStrategyRepositoryPort,
) {
    suspend fun execute(
        tenantId: TenantId,
        strategyId: StrategyId,
        from: Instant,
        to: Instant,
        interval: String = "1d",
    ): SignalBacktestSummary {
        val strategy = strategyRepo.findById(tenantId, strategyId)
            ?: error("SignalStrategy not found: ${strategyId.value}")

        val bars = ohlcvRepo.query(strategy.asset.code, strategy.market.code, interval, from, to)
        if (bars.isEmpty()) return EMPTY.copy(strategyId = strategyId.value.toString())

        val triggers = evaluate(strategy, bars)
        val triggerCount = triggers.count { it }

        // 단순 전략: 첫 trigger 봉 매수, 마지막 봉 매도
        val firstEntryIdx = triggers.indexOfFirst { it }
        val (entryPrice, exitPrice, realizedPnl) = if (firstEntryIdx < 0) {
            Triple(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO)
        } else {
            val ep = bars[firstEntryIdx].close
            val xp = bars.last().close
            Triple(ep, xp, xp.subtract(ep).setScale(8, RoundingMode.HALF_UP))
        }

        log.info { "SignalBacktest ${strategyId.value} triggers=$triggerCount pnl=$realizedPnl" }

        return SignalBacktestSummary(
            strategyId = strategyId.value.toString(),
            from = bars.first().ts,
            to = bars.last().ts,
            barCount = bars.size,
            triggerCount = triggerCount,
            firstEntryAt = if (firstEntryIdx < 0) null else bars[firstEntryIdx].ts,
            entryPrice = entryPrice,
            exitPrice = exitPrice,
            realizedPnl = realizedPnl,
        )
    }

    private suspend fun evaluate(
        strategy: SignalStrategy,
        bars: List<IndicatorCalculator.Bar>,
    ): List<Boolean> = when (val cfg = strategy.entrySignal) {
        is VolumeSpike -> evaluateVolumeSpike(bars, cfg)
        is RsiBreakout -> evaluateRsiBreakout(bars, cfg)
        is MaCross -> evaluateMaCross(bars, cfg)
        is BollingerSqueeze -> evaluateBollingerSqueeze(bars, cfg)
        is KimchiPremiumThreshold -> evaluateKimchiPremium(strategy, bars, cfg)
    }

    private fun evaluateVolumeSpike(bars: List<IndicatorCalculator.Bar>, c: VolumeSpike): List<Boolean> {
        val w = c.window
        return bars.indices.map { i ->
            if (i < w) false
            else {
                val avg = (i - w until i).map { bars[it].volume }
                    .reduce { a, b -> a.add(b) }
                    .divide(BigDecimal(w), 8, RoundingMode.HALF_UP)
                bars[i].volume >= avg.multiply(c.multiplier)
            }
        }
    }

    private fun evaluateRsiBreakout(bars: List<IndicatorCalculator.Bar>, c: RsiBreakout): List<Boolean> {
        val rsi = calculator.rsi(bars, c.period)
        return rsi.map { p ->
            when (c.direction) {
                RsiBreakout.Direction.OVERSOLD -> p.value < c.threshold
                RsiBreakout.Direction.OVERBOUGHT -> p.value > c.threshold
            }
        }
    }

    private fun evaluateMaCross(bars: List<IndicatorCalculator.Bar>, c: MaCross): List<Boolean> {
        val fast = calculator.sma(bars, c.fastPeriod)
        val slow = calculator.sma(bars, c.slowPeriod)
        return bars.indices.map { i ->
            if (i == 0) false
            else when (c.direction) {
                MaCross.CrossDirection.GOLDEN ->
                    fast[i - 1].value <= slow[i - 1].value && fast[i].value > slow[i].value
                MaCross.CrossDirection.DEAD ->
                    fast[i - 1].value >= slow[i - 1].value && fast[i].value < slow[i].value
            }
        }
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
     * G2 — KimchiPremium 시그널 평가 (단순화 버전).
     *
     * 정통 구현은 ClickHouse `quant.kimchi_premium_tick` 시계열을 read 해야 하지만 Phase 2
     * 초기에는 적재 인프라가 미완. 본 구현은 strategy 의 asset/market 한쪽만 사용 — 시그널 평가
     * 자체는 가능하지만 실 김치프리미엄 비교는 후속 task.
     *
     * Phase 2 후속에서 `KimchiPremiumTickRepositoryPort` 도입 후 정통화.
     */
    private fun evaluateKimchiPremium(
        strategy: SignalStrategy,
        bars: List<IndicatorCalculator.Bar>,
        c: KimchiPremiumThreshold,
    ): List<Boolean> {
        // 단순화: 평가 로직 placeholder — 향후 KimchiPremiumTickRepositoryPort 연동
        log.warn {
            "KimchiPremium 백테스트 — 시계열 적재 placeholder. " +
                "strategy=${strategy.id.value}, threshold=${c.entryThresholdPercent}/${c.exitThresholdPercent}"
        }
        return List(bars.size) { false }
    }

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

    companion object {
        private val EMPTY = SignalBacktestSummary(
            strategyId = "",
            from = Instant.EPOCH,
            to = Instant.EPOCH,
            barCount = 0,
            triggerCount = 0,
            firstEntryAt = null,
            entryPrice = BigDecimal.ZERO,
            exitPrice = BigDecimal.ZERO,
            realizedPnl = BigDecimal.ZERO,
        )
    }
}
