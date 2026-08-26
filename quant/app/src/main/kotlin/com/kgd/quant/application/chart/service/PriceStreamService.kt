package com.kgd.quant.application.chart.service

import com.kgd.quant.application.chart.port.PriceStreamPort
import com.kgd.quant.application.chart.usecase.SubscribePriceStreamUseCase
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import org.springframework.stereotype.Service
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter

@Service
class PriceStreamService(
    private val priceStreamPort: PriceStreamPort,
) : SubscribePriceStreamUseCase {

    override fun subscribe(asset: AssetCode, market: MarketCode, lastEventId: String?): SseEmitter =
        priceStreamPort.subscribe(asset, market, lastEventId)
}
