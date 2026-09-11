package com.kgd.quant.application.chart.service

import com.kgd.quant.application.chart.port.OrderbookPort
import com.kgd.quant.application.chart.usecase.GetChartDataUseCase
import com.kgd.quant.application.external.port.InvestorFlowsPort
import com.kgd.quant.application.external.port.NewsPort
import com.kgd.quant.application.indicator.IndicatorCalculator
import com.kgd.quant.application.marketdata.port.OhlcvRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.InvestorFlow
import com.kgd.quant.domain.asset.NewsItem
import com.kgd.quant.domain.asset.OrderbookSnapshot
import com.kgd.quant.domain.asset.TradeFill
import com.kgd.quant.domain.market.MarketCode
import java.time.Instant
import org.springframework.stereotype.Service

/** 조회 한도는 여기서 접는다 — 컨트롤러가 넘긴 값으로 외부·저장소를 통째로 훑지 않도록. */
@Service
class ChartDataService(
    private val ohlcvRepository: OhlcvRepositoryPort,
    private val investorFlowsPort: InvestorFlowsPort,
    private val newsPort: NewsPort,
    private val orderbookPort: OrderbookPort,
) : GetChartDataUseCase {

    override suspend fun candles(
        asset: AssetCode,
        market: MarketCode,
        interval: String,
        from: Instant,
        to: Instant,
    ): List<IndicatorCalculator.Bar> = ohlcvRepository.query(asset, market, interval, from, to)

    override suspend fun investorFlows(
        asset: AssetCode,
        market: MarketCode,
        from: Instant,
        to: Instant,
    ): List<InvestorFlow> = investorFlowsPort.query(asset, market, from, to)

    override suspend fun news(asset: AssetCode, market: MarketCode, limit: Int): List<NewsItem> =
        newsPort.fetch(asset, market, limit.coerceIn(1, MAX_NEWS))

    override fun orderbook(asset: AssetCode, market: MarketCode): OrderbookSnapshot? =
        orderbookPort.latestSnapshot(asset, market)

    override fun recentTrades(asset: AssetCode, market: MarketCode, limit: Int): List<TradeFill> =
        orderbookPort.recentTrades(asset, market, limit.coerceIn(1, MAX_TRADES))

    private companion object {
        const val MAX_NEWS = 50
        const val MAX_TRADES = 200
    }
}
