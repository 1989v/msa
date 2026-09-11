package com.kgd.quant.application.chart

import com.kgd.quant.application.chart.usecase.CalculateIndicatorsUseCase
import com.kgd.quant.application.indicator.IndicatorCalculator
import com.kgd.quant.application.marketdata.port.OhlcvRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import java.math.BigDecimal
import java.time.Instant
import org.springframework.stereotype.Component

/**
 * IndicatorQuery — 차트 분석 메뉴의 기술적 지표 계산 query (ADR-0033 Phase 1).
 *
 * OHLCV 를 ClickHouse 에서 read 하여 [IndicatorCalculator] 로 시계열 계산.
 */
@Component
class IndicatorQuery(
    private val ohlcvRepo: OhlcvRepositoryPort,
    private val calculator: IndicatorCalculator,
) : CalculateIndicatorsUseCase {
    override suspend fun rsi(
        assetCode: AssetCode,
        marketCode: MarketCode,
        interval: String,
        from: Instant,
        to: Instant,
        period: Int,
    ): List<IndicatorCalculator.IndicatorPoint> {
        val bars = ohlcvRepo.query(assetCode, marketCode, interval, from, to)
        return calculator.rsi(bars, period)
    }

    override suspend fun sma(
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

    override suspend fun ema(
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

    override suspend fun macd(
        assetCode: AssetCode,
        marketCode: MarketCode,
        interval: String,
        from: Instant,
        to: Instant,
        fastPeriod: Int,
        slowPeriod: Int,
        signalPeriod: Int,
    ): IndicatorCalculator.Macd {
        val bars = ohlcvRepo.query(assetCode, marketCode, interval, from, to)
        return calculator.macd(bars, fastPeriod, slowPeriod, signalPeriod)
    }

    override suspend fun stochastic(
        assetCode: AssetCode,
        marketCode: MarketCode,
        interval: String,
        from: Instant,
        to: Instant,
        kPeriod: Int,
        dPeriod: Int,
    ): IndicatorCalculator.Stochastic {
        val bars = ohlcvRepo.query(assetCode, marketCode, interval, from, to)
        return calculator.stochastic(bars, kPeriod, dPeriod)
    }

    override suspend fun bollinger(
        assetCode: AssetCode,
        marketCode: MarketCode,
        interval: String,
        from: Instant,
        to: Instant,
        period: Int,
        stdDevMultiplier: BigDecimal,
    ): IndicatorCalculator.BollingerBands {
        val bars = ohlcvRepo.query(assetCode, marketCode, interval, from, to)
        return calculator.bollinger(bars, period, stdDevMultiplier)
    }
}
