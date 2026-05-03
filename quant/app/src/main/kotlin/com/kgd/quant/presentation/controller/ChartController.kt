package com.kgd.quant.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.quant.application.chart.IndicatorQuery
import com.kgd.quant.application.indicator.IndicatorCalculator
import com.kgd.quant.application.port.persistence.OhlcvRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.math.BigDecimal
import java.time.Instant

/**
 * ChartController — /api/v1/charts/... (ADR-0033 Phase 1).
 *
 * - GET /ohlcv       OHLCV 시계열
 * - GET /indicators  기술적 지표 (rsi/sma/ema/bb)
 *
 * 패턴 유사도(/similarity) 와 미래 수익률 예측(/prediction) 은 Phase 1 후반 — charting 흡수 시 wire-up.
 */
@RestController
@RequestMapping("/api/v1/charts")
class ChartController(
    private val ohlcvRepo: OhlcvRepositoryPort,
    private val indicatorQuery: IndicatorQuery,
) {
    @GetMapping("/ohlcv")
    suspend fun ohlcv(
        @RequestParam asset: String,
        @RequestParam market: String,
        @RequestParam(defaultValue = "1d") interval: String,
        @RequestParam from: String,
        @RequestParam to: String,
    ): ApiResponse<List<OhlcvBarResponse>> {
        val bars = ohlcvRepo.query(
            AssetCode(asset),
            MarketCode(market),
            interval,
            Instant.parse(from),
            Instant.parse(to),
        )
        return ApiResponse.success(bars.map { it.toResponse() })
    }

    @GetMapping("/indicators")
    suspend fun indicators(
        @RequestParam asset: String,
        @RequestParam market: String,
        @RequestParam(defaultValue = "1d") interval: String,
        @RequestParam from: String,
        @RequestParam to: String,
        @RequestParam type: String,
        @RequestParam(required = false) period: Int?,
        @RequestParam(required = false) stdDev: BigDecimal?,
    ): ApiResponse<IndicatorSeriesResponse> {
        val assetCode = AssetCode(asset)
        val marketCode = MarketCode(market)
        val fromTs = Instant.parse(from)
        val toTs = Instant.parse(to)

        return when (type.uppercase()) {
            "RSI" -> {
                val series = indicatorQuery.rsi(assetCode, marketCode, interval, fromTs, toTs, period ?: 14)
                ApiResponse.success(IndicatorSeriesResponse.single(type, series))
            }
            "SMA" -> {
                val series = indicatorQuery.sma(assetCode, marketCode, interval, fromTs, toTs, period ?: 20)
                ApiResponse.success(IndicatorSeriesResponse.single(type, series))
            }
            "EMA" -> {
                val series = indicatorQuery.ema(assetCode, marketCode, interval, fromTs, toTs, period ?: 20)
                ApiResponse.success(IndicatorSeriesResponse.single(type, series))
            }
            "BB" -> {
                val bb = indicatorQuery.bollinger(
                    assetCode, marketCode, interval, fromTs, toTs,
                    period ?: 20, stdDev ?: BigDecimal("2.0"),
                )
                ApiResponse.success(IndicatorSeriesResponse.bollinger(bb))
            }
            else -> error("Unknown indicator type: $type (supported: RSI/SMA/EMA/BB)")
        }
    }

    private fun IndicatorCalculator.Bar.toResponse() = OhlcvBarResponse(
        ts = ts.toString(),
        open = open, high = high, low = low, close = close, volume = volume,
    )

    data class OhlcvBarResponse(
        val ts: String,
        val open: BigDecimal,
        val high: BigDecimal,
        val low: BigDecimal,
        val close: BigDecimal,
        val volume: BigDecimal,
    )

    data class IndicatorSeriesResponse(
        val type: String,
        val series: Map<String, List<Point>>,
    ) {
        data class Point(val ts: String, val value: BigDecimal)

        companion object {
            fun single(type: String, points: List<IndicatorCalculator.IndicatorPoint>): IndicatorSeriesResponse =
                IndicatorSeriesResponse(type, mapOf("value" to points.map { Point(it.ts.toString(), it.value) }))

            fun bollinger(bb: IndicatorCalculator.BollingerBands): IndicatorSeriesResponse =
                IndicatorSeriesResponse(
                    type = "BB",
                    series = mapOf(
                        "middle" to bb.middle.map { Point(it.ts.toString(), it.value) },
                        "upper" to bb.upper.map { Point(it.ts.toString(), it.value) },
                        "lower" to bb.lower.map { Point(it.ts.toString(), it.value) },
                    ),
                )
        }
    }
}
