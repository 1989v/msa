package com.kgd.quant.application.chart

import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.OrderbookSnapshot
import com.kgd.quant.domain.asset.TradeFill
import com.kgd.quant.domain.market.MarketCode

/**
 * OrderbookPort — ADR-0039 호가/체결 조회 포트.
 *
 * 구현체: InMemoryOrderbookStore (단일 인스턴스 prototype).
 * 후속: Redis pubsub 또는 ClickHouse persistence.
 *
 * latestSnapshot: 현재 snapshot. 데이터 없으면 null.
 * recentTrades: 최근 N 체결 (시간 역순).
 */
interface OrderbookPort {
    fun latestSnapshot(asset: AssetCode, market: MarketCode): OrderbookSnapshot?
    fun recentTrades(asset: AssetCode, market: MarketCode, limit: Int = 50): List<TradeFill>
    /** Subscriber 가 호출 — snapshot 갱신. */
    fun publish(snapshot: OrderbookSnapshot)
    fun publish(trade: TradeFill)
}
