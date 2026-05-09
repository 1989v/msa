package com.kgd.quant.presentation.controller

import com.kgd.quant.application.chart.PriceStreamPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter

/**
 * ChartsStreamController — 실시간 가격 SSE (TG-13 prototype).
 *
 * GET /api/v1/charts/stream/{asset}/{market}
 *   Accept: text/event-stream
 *
 * Events:
 *   event: hello       — 연결 확인 (asset/market echo)
 *   event: tick        — 가격 변경 (asset/market/price/volume/ts)
 *   :heartbeat         — 15s 주기 keep-alive (SSE comment)
 *
 * Authn: Phase 1 차트 API 와 동일 정책 — anonymous OK.
 * Phase: prototype (in-memory). Multi-instance fan-out (Redis pubsub) 은 후속.
 */
@RestController
@RequestMapping("/api/v1/charts/stream")
class ChartsStreamController(
    private val priceStream: PriceStreamPort,
) {
    @GetMapping(
        "/{asset}/{market}",
        produces = [MediaType.TEXT_EVENT_STREAM_VALUE],
    )
    fun stream(
        @PathVariable asset: String,
        @PathVariable market: String,
    ): SseEmitter {
        return priceStream.subscribe(AssetCode(asset), MarketCode(market))
    }
}
