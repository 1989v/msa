package com.kgd.quant.application.chart.usecase

import com.kgd.quant.application.indicator.IndicatorCalculator
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.InvestorFlow
import com.kgd.quant.domain.asset.NewsItem
import com.kgd.quant.domain.asset.OrderbookSnapshot
import com.kgd.quant.domain.asset.TradeFill
import com.kgd.quant.domain.market.MarketCode
import java.time.Instant

/**
 * 차트 화면이 쓰는 원천 데이터 조회 — 캔들·수급·뉴스·호가.
 *
 * 컨트롤러가 저장소/외부 포트를 직접 부르면 조회 한도 같은 규칙이 화면마다 갈린다.
 */
interface GetChartDataUseCase {
    suspend fun candles(asset: AssetCode, market: MarketCode, interval: String, from: Instant, to: Instant): List<IndicatorCalculator.Bar>
    suspend fun investorFlows(asset: AssetCode, market: MarketCode, from: Instant, to: Instant): List<InvestorFlow>
    suspend fun news(asset: AssetCode, market: MarketCode, limit: Int): List<NewsItem>
    fun orderbook(asset: AssetCode, market: MarketCode): OrderbookSnapshot?
    fun recentTrades(asset: AssetCode, market: MarketCode, limit: Int): List<TradeFill>
}
