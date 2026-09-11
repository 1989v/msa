package com.kgd.quant.application.chart.usecase

import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter

/** 실시간 시세 SSE 구독. `lastEventId` 로 재연결 시 이어받는다. */
interface SubscribePriceStreamUseCase {
    fun subscribe(asset: AssetCode, market: MarketCode, lastEventId: String?): SseEmitter
}
