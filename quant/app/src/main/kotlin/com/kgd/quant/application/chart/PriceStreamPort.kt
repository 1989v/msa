package com.kgd.quant.application.chart

import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.PriceTick
import com.kgd.quant.domain.market.MarketCode
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter

/**
 * PriceStreamPort — 실시간 가격 stream 발행 (SSE) 포트.
 *
 * - subscribe: 자산별 SseEmitter 등록 (multi-subscriber fan-out)
 * - publish: 모든 구독자에게 tick 발행
 *
 * 구현체: InMemorySsePriceStreamAdapter (Phase 3 prototype).
 * 후속: Redis pubsub 으로 multi-instance fan-out.
 */
interface PriceStreamPort {
    fun subscribe(asset: AssetCode, market: MarketCode): SseEmitter
    fun publish(tick: PriceTick)
    /** Active 구독자 수 — Prometheus 메트릭/디버깅용. */
    fun subscriberCount(asset: AssetCode, market: MarketCode): Int
    fun totalSubscriberCount(): Int
}
