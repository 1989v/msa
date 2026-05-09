package com.kgd.quant.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.quant.application.chart.FundamentalsQuery
import com.kgd.quant.application.chart.IndicatorQuery
import com.kgd.quant.application.chart.PredictionQuery
import com.kgd.quant.application.chart.SimilarityQuery
import com.kgd.quant.application.indicator.IndicatorCalculator
import com.kgd.quant.application.port.external.NewsPort
import com.kgd.quant.application.port.persistence.InvestorFlowsPort
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
    private val similarityQuery: SimilarityQuery,
    private val predictionQuery: PredictionQuery,
    private val fundamentalsQuery: FundamentalsQuery,
    private val investorFlowsPort: InvestorFlowsPort,
    private val newsPort: NewsPort,
) {
    @GetMapping("/prediction")
    suspend fun prediction(
        @RequestParam asset: String,
        @RequestParam market: String,
        @RequestParam(defaultValue = "60") windowDays: Int,
        @RequestParam(defaultValue = "50") k: Int,
    ): ApiResponse<PredictionQuery.Prediction> {
        val result = predictionQuery.predict(
            AssetCode(asset),
            MarketCode(market),
            Instant.now(),
            windowDays,
            k,
        )
        return ApiResponse.success(result)
    }

    @GetMapping("/similarity")
    suspend fun similarity(
        @RequestParam asset: String,
        @RequestParam market: String,
        @RequestParam windowEnd: String,
        @RequestParam(defaultValue = "60") windowDays: Int,
    ): ApiResponse<SimilarityQuery.EmbedResult> {
        val result = similarityQuery.embedWindow(
            AssetCode(asset),
            MarketCode(market),
            Instant.parse(windowEnd),
            windowDays,
        )
        return ApiResponse.success(result)
    }

    @GetMapping("/similarity/search")
    suspend fun similaritySearch(
        @RequestParam asset: String,
        @RequestParam market: String,
        @RequestParam windowEnd: String,
        @RequestParam(defaultValue = "60") windowDays: Int,
        @RequestParam(defaultValue = "20") k: Int,
    ): ApiResponse<List<com.kgd.quant.application.port.persistence.SimilarityHit>> {
        val hits = similarityQuery.searchSimilar(
            AssetCode(asset),
            MarketCode(market),
            Instant.parse(windowEnd),
            windowDays,
            k,
        )
        return ApiResponse.success(hits)
    }
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
            "MACD" -> {
                val m = indicatorQuery.macd(assetCode, marketCode, interval, fromTs, toTs)
                ApiResponse.success(
                    IndicatorSeriesResponse(
                        type = "MACD",
                        series = mapOf(
                            "macd" to m.macd.map { IndicatorSeriesResponse.Point(it.ts.toString(), it.value) },
                            "signal" to m.signal.map { IndicatorSeriesResponse.Point(it.ts.toString(), it.value) },
                            "histogram" to m.histogram.map { IndicatorSeriesResponse.Point(it.ts.toString(), it.value) },
                        ),
                    )
                )
            }
            "STOCH" -> {
                val s = indicatorQuery.stochastic(assetCode, marketCode, interval, fromTs, toTs)
                ApiResponse.success(
                    IndicatorSeriesResponse(
                        type = "STOCH",
                        series = mapOf(
                            "k" to s.k.map { IndicatorSeriesResponse.Point(it.ts.toString(), it.value) },
                            "d" to s.d.map { IndicatorSeriesResponse.Point(it.ts.toString(), it.value) },
                        ),
                    )
                )
            }
            else -> error("Unknown indicator type: $type (supported: RSI/SMA/EMA/BB/MACD/STOCH)")
        }
    }

    /**
     * Fundamentals — Yahoo Finance v10 quoteSummary (캐시 TTL 1h).
     *
     * - asset: 표시 ticker (예: AAPL, 005930, BTC-USD).
     *   STOCK_KR 은 raw 종목코드 (예: 005930) — 어댑터가 .KS / .KQ 변환.
     * - market: FDR_KR / YAHOO. CRYPTO 는 보통 fundamentals 없음 (null 반환).
     */
    @GetMapping("/fundamentals")
    suspend fun fundamentals(
        @RequestParam asset: String,
        @RequestParam market: String,
    ): ApiResponse<FundamentalsResponse?> {
        val data = fundamentalsQuery.fundamentals(AssetCode(asset), MarketCode(market))
        return ApiResponse.success(data?.let(::toResponse))
    }

    private fun toResponse(f: com.kgd.quant.domain.asset.Fundamentals): FundamentalsResponse =
        FundamentalsResponse(
            asset = f.asset.value,
            market = f.market.value,
            marketCap = f.marketCap,
            peRatio = f.peRatio,
            eps = f.eps,
            dividendYield = f.dividendYield,
            beta = f.beta,
            weeks52High = f.weeks52High,
            weeks52Low = f.weeks52Low,
            avgDailyVolume = f.avgDailyVolume,
            asOf = f.asOf.toString(),
        )

    /**
     * ADR-0040 — 매매주체 동향 (KR 주식 전용).
     */
    @GetMapping("/investor-flows")
    suspend fun investorFlows(
        @RequestParam asset: String,
        @RequestParam market: String,
        @RequestParam from: String,
        @RequestParam to: String,
    ): ApiResponse<List<InvestorFlowResponse>> {
        val flows = investorFlowsPort.query(
            AssetCode(asset),
            MarketCode(market),
            Instant.parse(from),
            Instant.parse(to),
        )
        return ApiResponse.success(
            flows.map {
                InvestorFlowResponse(
                    tradeDate = it.tradeDate.toString(),
                    individualNet = it.individualNet,
                    foreignNet = it.foreignNet,
                    institutionNet = it.institutionNet,
                )
            },
        )
    }

    /**
     * ADR-0041 — 종목 뉴스/공시 (Yahoo v8 search news, 10분 Caffeine 캐시).
     */
    @GetMapping("/news")
    suspend fun news(
        @RequestParam asset: String,
        @RequestParam market: String,
        @RequestParam(defaultValue = "20") limit: Int,
    ): ApiResponse<List<NewsResponse>> {
        val items = newsPort.fetch(AssetCode(asset), MarketCode(market), limit)
        return ApiResponse.success(
            items.map {
                NewsResponse(
                    title = it.title,
                    source = it.source,
                    url = it.url,
                    publishedAt = it.publishedAt.toString(),
                    summary = it.summary,
                    kind = it.kind.name,
                )
            },
        )
    }

    data class NewsResponse(
        val title: String,
        val source: String,
        val url: String,
        val publishedAt: String,
        val summary: String?,
        val kind: String,
    )

    data class InvestorFlowResponse(
        val tradeDate: String,
        val individualNet: Long,
        val foreignNet: Long,
        val institutionNet: Long,
    )

    data class FundamentalsResponse(
        val asset: String,
        val market: String,
        val marketCap: BigDecimal?,
        val peRatio: BigDecimal?,
        val eps: BigDecimal?,
        val dividendYield: BigDecimal?,
        val beta: BigDecimal?,
        val weeks52High: BigDecimal?,
        val weeks52Low: BigDecimal?,
        val avgDailyVolume: BigDecimal?,
        val asOf: String,
    )

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
