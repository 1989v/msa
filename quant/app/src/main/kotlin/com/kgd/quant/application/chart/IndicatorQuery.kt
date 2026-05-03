package com.kgd.quant.application.chart

import com.kgd.quant.application.indicator.IndicatorCalculator
import com.kgd.quant.application.port.persistence.OhlcvRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.time.Instant

/**
 * IndicatorQuery — 차트 분석 메뉴의 기술적 지표 계산 query (ADR-0033 Phase 1).
 *
 * OHLCV 를 ClickHouse 에서 read 하여 [IndicatorCalculator] 로 시계열 계산.
 */
@Component
class IndicatorQuery(
    private val ohlcvRepo: OhlcvRepositoryPort,
    private val calculator: IndicatorCalculator,
) {
    suspend fun rsi(
        assetCode: AssetCode,
        marketCode: MarketCode,
        interval: String,
        from: Instant,
        to: Instant,
        period: Int = 14,
    ): List<IndicatorCalculator.IndicatorPoint> {
        val bars = ohlcvRepo.query(assetCode, marketCode, interval, from, to)
        return calculator.rsi(bars, period)
    }

    suspend fun sma(
        assetCode: AssetCode,
        marketCode: MarketCode,
        interval: String,
        from: Instant,
        to: Instant,
        period: Int,
    ): List<IndicatorCalculator.IndicatorPoint> {
        val bars = ohlcvRepo.query(assetCode, marketCode, interval, from, to)
        return calculator.sma(bars, period)
    }

    suspend fun ema(
        assetCode: AssetCode,
        marketCode: MarketCode,
        interval: String,
        from: Instant,
        to: Instant,
        period: Int,
    ): List<IndicatorCalculator.IndicatorPoint> {
        val bars = ohlcvRepo.query(assetCode, marketCode, interval, from, to)
        return calculator.ema(bars, period)
    }

    suspend fun bollinger(
        assetCode: AssetCode,
        marketCode: MarketCode,
        interval: String,
        from: Instant,
        to: Instant,
        period: Int = 20,
        stdDevMultiplier: BigDecimal = BigDecimal("2.0"),
    ): IndicatorCalculator.BollingerBands {
        val bars = ohlcvRepo.query(assetCode, marketCode, interval, from, to)
        return calculator.bollinger(bars, period, stdDevMultiplier)
    }
}
