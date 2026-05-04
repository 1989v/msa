package com.kgd.quant.application.usecase

import com.kgd.quant.application.indicator.IndicatorCalculator
import com.kgd.quant.application.port.persistence.KimchiPremiumTickRepositoryPort
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
import org.springframework.beans.factory.ObjectProvider
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant

private val log = KotlinLogging.logger {}

/**
 * RunSignalBacktestUseCase — SignalStrategy 백테스트 (ADR-0036 P2 + G2/H3).
 *
 * Phase 2 지원 시그널:
 * - VolumeSpike / RsiBreakout / MaCross / BollingerSqueeze (단일 거래소)
 * - **KimchiPremiumThreshold** (H3 정통화) — `quant.kimchi_premium_tick` 시계열을 read 하여
 *   각 봉 시각의 직전 tick 의 `premiumPercent` 를 entry/exit threshold 와 비교한다.
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
    private val kimchiTickRepoProvider: ObjectProvider<KimchiPremiumTickRepositoryPort>,
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
     * H3 — KimchiPremium 시그널 평가 (정통화).
     *
     * `quant.kimchi_premium_tick(asset_code, kr_market, foreign_market, ts, premium_percent)`
     * 시계열을 read 한 후, 각 OHLCV 봉의 ts 직전 tick 의 premiumPercent 가
     * entryThresholdPercent 이상이면 진입 trigger 로 간주한다 (exit 평가는 본 백테스트
     * 단순화 모델 — final close PnL — 에서는 사용하지 않음).
     *
     * Tick repo 빈이 없는 환경 (ClickHouse 비활성) → trigger 없음 (백테스트는 정상 종료).
     */
    private suspend fun evaluateKimchiPremium(
        strategy: SignalStrategy,
        bars: List<IndicatorCalculator.Bar>,
        c: KimchiPremiumThreshold,
    ): List<Boolean> {
        val repo = kimchiTickRepoProvider.ifAvailable
        if (repo == null) {
            log.warn { "KimchiPremiumTickRepositoryPort 빈 미등록 — trigger 없음 (strategy=${strategy.id.value})" }
            return List(bars.size) { false }
        }
        val from = bars.first().ts
        val to = bars.last().ts.plusSeconds(1)
        val ticks = repo.query(
            assetCode = strategy.asset.code,
            krMarketCode = strategy.market.code,
            foreignMarketCode = c.foreignMarket,
            from = from,
            to = to,
        )
        if (ticks.isEmpty()) {
            log.info {
                "KimchiPremium 백테스트 — 시계열 비어있음 " +
                    "(asset=${strategy.asset.code.value} kr=${strategy.market.code.value} fx=${c.foreignMarket.value})"
            }
            return List(bars.size) { false }
        }
        // ts ASC 정렬 보장 — 각 봉 시각 t 에 대해 t 이전 마지막 tick 을 찾는다 (이진 탐색).
        val tsArray = ticks.map { it.ts }
        val premiums = ticks.map { it.premiumPercent }
        return bars.map { bar ->
            val idx = priorIndex(tsArray, bar.ts)
            if (idx < 0) false
            else premiums[idx] >= c.entryThresholdPercent
        }
    }

    /** ts ASC 배열에서 target 이하 마지막 index — 없으면 -1. */
    private fun priorIndex(tsArray: List<Instant>, target: Instant): Int {
        var lo = 0
        var hi = tsArray.size - 1
        var ans = -1
        while (lo <= hi) {
            val mid = (lo + hi) ushr 1
            if (tsArray[mid] <= target) {
                ans = mid; lo = mid + 1
            } else hi = mid - 1
        }
        return ans
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
