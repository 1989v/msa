package com.kgd.quant.application.indicator

import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant

/**
 * IndicatorCalculator — 기술적 지표 계산 (ADR-0033/0034).
 *
 * ## 구현 메모
 * 본 Phase 1 구현은 ta4j 0.18 API 의 BarSeriesBuilder 변경에 영향받지 않도록 자체 단순
 * 구현으로 시작한다. SMA / EMA / RSI / Bollinger 4종 — 수식 공개이므로 추가 의존성 없이
 * 정확한 결과 보장 가능.
 *
 * ta4j 정통 통합은 Phase 1 후반 follow-up task (T15.x) — golden test 와 함께 마이그레이션.
 *
 * 입력: 시간순 [Bar] 리스트. 출력: 시계열 [IndicatorPoint] 또는 [BollingerBands].
 */
@Component
class IndicatorCalculator {

    fun sma(bars: List<Bar>, period: Int): List<IndicatorPoint> {
        require(period > 0) { "period must be > 0" }
        return bars.indices.map { i ->
            val from = maxOf(0, i - period + 1)
            val window = bars.subList(from, i + 1)
            val mean = window.map { it.close }
                .reduce { acc, v -> acc.add(v) }
                .divide(BigDecimal(window.size), 8, RoundingMode.HALF_UP)
            IndicatorPoint(bars[i].ts, mean)
        }
    }

    fun ema(bars: List<Bar>, period: Int): List<IndicatorPoint> {
        require(period > 0) { "period must be > 0" }
        val k = BigDecimal(2).divide(BigDecimal(period + 1), 16, RoundingMode.HALF_UP)
        var prev: BigDecimal? = null
        return bars.map { bar ->
            val current = if (prev == null) bar.close
            else bar.close.multiply(k).add(prev!!.multiply(BigDecimal.ONE.subtract(k)))
                .setScale(8, RoundingMode.HALF_UP)
            prev = current
            IndicatorPoint(bar.ts, current)
        }
    }

    fun rsi(bars: List<Bar>, period: Int): List<IndicatorPoint> {
        require(period > 0) { "period must be > 0" }
        if (bars.size < 2) return bars.map { IndicatorPoint(it.ts, BigDecimal("50.0000")) }

        val gains = mutableListOf<BigDecimal>()
        val losses = mutableListOf<BigDecimal>()
        for (i in 1 until bars.size) {
            val change = bars[i].close.subtract(bars[i - 1].close)
            gains.add(if (change > BigDecimal.ZERO) change else BigDecimal.ZERO)
            losses.add(if (change < BigDecimal.ZERO) change.negate() else BigDecimal.ZERO)
        }

        val out = mutableListOf<IndicatorPoint>()
        out.add(IndicatorPoint(bars[0].ts, BigDecimal("50.0000")))
        var avgGain: BigDecimal? = null
        var avgLoss: BigDecimal? = null

        for (i in 1 until bars.size) {
            if (i < period) {
                out.add(IndicatorPoint(bars[i].ts, BigDecimal("50.0000")))
                continue
            }
            if (i == period) {
                val gSum = gains.subList(0, period).reduce { a, b -> a.add(b) }
                val lSum = losses.subList(0, period).reduce { a, b -> a.add(b) }
                avgGain = gSum.divide(BigDecimal(period), 8, RoundingMode.HALF_UP)
                avgLoss = lSum.divide(BigDecimal(period), 8, RoundingMode.HALF_UP)
            } else {
                val g = gains[i - 1]
                val l = losses[i - 1]
                avgGain = avgGain!!.multiply(BigDecimal(period - 1)).add(g)
                    .divide(BigDecimal(period), 8, RoundingMode.HALF_UP)
                avgLoss = avgLoss!!.multiply(BigDecimal(period - 1)).add(l)
                    .divide(BigDecimal(period), 8, RoundingMode.HALF_UP)
            }
            val rsiValue = if (avgLoss!!.signum() == 0) BigDecimal("100.0000")
            else {
                val rs = avgGain!!.divide(avgLoss, 8, RoundingMode.HALF_UP)
                BigDecimal(100).subtract(
                    BigDecimal(100).divide(BigDecimal.ONE.add(rs), 4, RoundingMode.HALF_UP)
                )
            }
            out.add(IndicatorPoint(bars[i].ts, rsiValue.setScale(4, RoundingMode.HALF_UP)))
        }
        return out
    }

    fun macd(bars: List<Bar>, fastPeriod: Int = 12, slowPeriod: Int = 26, signalPeriod: Int = 9): Macd {
        require(fastPeriod > 0 && slowPeriod > fastPeriod && signalPeriod > 0) {
            "macd periods invalid (fast=$fastPeriod, slow=$slowPeriod, signal=$signalPeriod)"
        }
        val fast = ema(bars, fastPeriod)
        val slow = ema(bars, slowPeriod)
        val macdLine = bars.indices.map { i ->
            IndicatorPoint(bars[i].ts, fast[i].value.subtract(slow[i].value).setScale(8, RoundingMode.HALF_UP))
        }
        val k = BigDecimal(2).divide(BigDecimal(signalPeriod + 1), 16, RoundingMode.HALF_UP)
        var prev: BigDecimal? = null
        val signalLine = macdLine.map { p ->
            val current = if (prev == null) p.value
            else p.value.multiply(k).add(prev!!.multiply(BigDecimal.ONE.subtract(k)))
                .setScale(8, RoundingMode.HALF_UP)
            prev = current
            IndicatorPoint(p.ts, current)
        }
        val histogram = bars.indices.map { i ->
            IndicatorPoint(bars[i].ts, macdLine[i].value.subtract(signalLine[i].value).setScale(8, RoundingMode.HALF_UP))
        }
        return Macd(macd = macdLine, signal = signalLine, histogram = histogram)
    }

    fun stochastic(bars: List<Bar>, kPeriod: Int = 14, dPeriod: Int = 3): Stochastic {
        require(kPeriod > 0 && dPeriod > 0) { "stochastic periods must be > 0" }
        val k = bars.indices.map { i ->
            val from = maxOf(0, i - kPeriod + 1)
            val window = bars.subList(from, i + 1)
            val highestHigh = window.maxOf { it.high }
            val lowestLow = window.minOf { it.low }
            val range = highestHigh.subtract(lowestLow)
            val value = if (range.signum() == 0) BigDecimal("50.0000")
            else bars[i].close.subtract(lowestLow).multiply(BigDecimal(100))
                .divide(range, 4, RoundingMode.HALF_UP)
            IndicatorPoint(bars[i].ts, value)
        }
        val d = k.indices.map { i ->
            val from = maxOf(0, i - dPeriod + 1)
            val window = k.subList(from, i + 1)
            val mean = window.map { it.value }
                .reduce { acc, v -> acc.add(v) }
                .divide(BigDecimal(window.size), 4, RoundingMode.HALF_UP)
            IndicatorPoint(k[i].ts, mean)
        }
        return Stochastic(k = k, d = d)
    }

    fun bollinger(bars: List<Bar>, period: Int, stdDevMultiplier: BigDecimal): BollingerBands {
        require(period > 0) { "period must be > 0" }
        val middle = sma(bars, period)
        val upper = mutableListOf<IndicatorPoint>()
        val lower = mutableListOf<IndicatorPoint>()
        for (i in bars.indices) {
            val from = maxOf(0, i - period + 1)
            val window = bars.subList(from, i + 1).map { it.close }
            val mean = middle[i].value
            val variance = window.map { it.subtract(mean).pow(2) }
                .reduce { a, b -> a.add(b) }
                .divide(BigDecimal(window.size), 16, RoundingMode.HALF_UP)
            val sd = sqrt(variance)
            val band = sd.multiply(stdDevMultiplier)
            upper.add(IndicatorPoint(bars[i].ts, mean.add(band).setScale(8, RoundingMode.HALF_UP)))
            lower.add(IndicatorPoint(bars[i].ts, mean.subtract(band).setScale(8, RoundingMode.HALF_UP)))
        }
        return BollingerBands(middle = middle, upper = upper, lower = lower)
    }

    /** Newton-Raphson 단순 sqrt — BigDecimal 16 자릿수 정밀도. */
    private fun sqrt(value: BigDecimal): BigDecimal {
        if (value.signum() == 0) return BigDecimal.ZERO
        var x = BigDecimal(Math.sqrt(value.toDouble()))
        repeat(8) {
            x = x.add(value.divide(x, 16, RoundingMode.HALF_UP)).divide(BigDecimal(2), 16, RoundingMode.HALF_UP)
        }
        return x
    }

    data class Bar(
        val ts: Instant,
        val open: BigDecimal,
        val high: BigDecimal,
        val low: BigDecimal,
        val close: BigDecimal,
        val volume: BigDecimal,
    )

    data class IndicatorPoint(
        val ts: Instant,
        val value: BigDecimal,
    )

    data class BollingerBands(
        val middle: List<IndicatorPoint>,
        val upper: List<IndicatorPoint>,
        val lower: List<IndicatorPoint>,
    )

    data class Macd(
        val macd: List<IndicatorPoint>,
        val signal: List<IndicatorPoint>,
        val histogram: List<IndicatorPoint>,
    )

    data class Stochastic(
        val k: List<IndicatorPoint>,
        val d: List<IndicatorPoint>,
    )
}
