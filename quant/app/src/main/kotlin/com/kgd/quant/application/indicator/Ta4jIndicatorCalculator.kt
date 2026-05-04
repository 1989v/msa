package com.kgd.quant.application.indicator

import org.springframework.stereotype.Component
import org.ta4j.core.BaseBarSeries
import org.ta4j.core.BaseBarSeriesBuilder
import org.ta4j.core.indicators.RSIIndicator
import org.ta4j.core.indicators.averages.EMAIndicator
import org.ta4j.core.indicators.averages.SMAIndicator
import org.ta4j.core.indicators.helpers.ClosePriceIndicator
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Duration
import java.time.Instant

/**
 * Ta4jIndicatorCalculator — ta4j 0.18 기반 지표 계산 (ADR-0033 Phase 1 후반).
 *
 * 자체 구현 [IndicatorCalculator] 와 cross-validation 골든 검증을 위한 평행 구현.
 * 운영 라우팅은 그대로 자체 구현 (속도/메모리). 본 클래스는 검증/디버깅 용도.
 *
 * Phase 2 에서 자체 구현과 결과 동등성 확인 후 단일 구현으로 통합 결정.
 */
@Component
class Ta4jIndicatorCalculator {

    fun sma(bars: List<IndicatorCalculator.Bar>, period: Int): List<IndicatorCalculator.IndicatorPoint> {
        val series = bars.toBarSeries()
        val close = ClosePriceIndicator(series)
        val sma = SMAIndicator(close, period)
        return bars.indices.map { i ->
            val v = BigDecimal(sma.getValue(i).toString()).setScale(8, RoundingMode.HALF_UP)
            IndicatorCalculator.IndicatorPoint(bars[i].ts, v)
        }
    }

    fun ema(bars: List<IndicatorCalculator.Bar>, period: Int): List<IndicatorCalculator.IndicatorPoint> {
        val series = bars.toBarSeries()
        val close = ClosePriceIndicator(series)
        val ema = EMAIndicator(close, period)
        return bars.indices.map { i ->
            val v = BigDecimal(ema.getValue(i).toString()).setScale(8, RoundingMode.HALF_UP)
            IndicatorCalculator.IndicatorPoint(bars[i].ts, v)
        }
    }

    fun rsi(bars: List<IndicatorCalculator.Bar>, period: Int): List<IndicatorCalculator.IndicatorPoint> {
        val series = bars.toBarSeries()
        val close = ClosePriceIndicator(series)
        val rsi = RSIIndicator(close, period)
        return bars.indices.map { i ->
            val v = BigDecimal(rsi.getValue(i).toString()).setScale(4, RoundingMode.HALF_UP)
            IndicatorCalculator.IndicatorPoint(bars[i].ts, v)
        }
    }

    private fun List<IndicatorCalculator.Bar>.toBarSeries(): BaseBarSeries {
        val series = BaseBarSeriesBuilder().withName("ta4j-cross-validation").build()
        for (bar in this) {
            series.barBuilder()
                .timePeriod(Duration.ofDays(1))
                .endTime(bar.ts)
                .openPrice(bar.open)
                .highPrice(bar.high)
                .lowPrice(bar.low)
                .closePrice(bar.close)
                .volume(bar.volume)
                .add()
        }
        return series
    }
}
