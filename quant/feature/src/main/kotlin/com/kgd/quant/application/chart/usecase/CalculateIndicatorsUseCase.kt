package com.kgd.quant.application.chart.usecase

import com.kgd.quant.application.indicator.IndicatorCalculator
import com.kgd.quant.application.marketdata.port.OhlcvRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import java.math.BigDecimal
import java.time.Instant

/** 캔들 기반 보조지표 계산 (ta4j). */
interface CalculateIndicatorsUseCase {
    suspend fun rsi(
        assetCode: AssetCode,
        marketCode: MarketCode,
        interval: String,
        from: Instant,
        to: Instant,
        period: Int = 14,
    ): List<IndicatorCalculator.IndicatorPoint>
    suspend fun sma(
        assetCode: AssetCode,
        marketCode: MarketCode,
        interval: String,
        from: Instant,
        to: Instant,
        period: Int,
    ): List<IndicatorCalculator.IndicatorPoint>
    suspend fun ema(
        assetCode: AssetCode,
        marketCode: MarketCode,
        interval: String,
        from: Instant,
        to: Instant,
        period: Int,
    ): List<IndicatorCalculator.IndicatorPoint>
    suspend fun macd(
        assetCode: AssetCode,
        marketCode: MarketCode,
        interval: String,
        from: Instant,
        to: Instant,
        fastPeriod: Int = 12,
        slowPeriod: Int = 26,
        signalPeriod: Int = 9,
    ): IndicatorCalculator.Macd
    suspend fun stochastic(
        assetCode: AssetCode,
        marketCode: MarketCode,
        interval: String,
        from: Instant,
        to: Instant,
        kPeriod: Int = 14,
        dPeriod: Int = 3,
    ): IndicatorCalculator.Stochastic
    suspend fun bollinger(
        assetCode: AssetCode,
        marketCode: MarketCode,
        interval: String,
        from: Instant,
        to: Instant,
        period: Int = 20,
        stdDevMultiplier: BigDecimal = BigDecimal("2.0"),
    ): IndicatorCalculator.BollingerBands
}
