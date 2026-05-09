package com.kgd.quant.infrastructure.chart

import com.kgd.quant.application.chart.OrderbookPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.OrderbookSnapshot
import com.kgd.quant.domain.asset.TradeFill
import com.kgd.quant.domain.market.MarketCode
import org.springframework.stereotype.Component
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

/**
 * InMemoryOrderbookStore — ADR-0039 prototype 단일 인스턴스 in-memory store.
 *
 * Subscriber (BithumbOrderbookSubscriber 등) 가 publish, REST/SSE 가 read.
 * Multi-instance 환경에서는 Redis pubsub 도입 (별도 PR).
 */
@Component
class InMemoryOrderbookStore : OrderbookPort {
    private val snapshots = ConcurrentHashMap<String, OrderbookSnapshot>()
    private val trades = ConcurrentHashMap<String, CopyOnWriteArrayList<TradeFill>>()

    override fun latestSnapshot(asset: AssetCode, market: MarketCode): OrderbookSnapshot? =
        snapshots[key(asset, market)]

    override fun recentTrades(
        asset: AssetCode,
        market: MarketCode,
        limit: Int,
    ): List<TradeFill> {
        val list = trades[key(asset, market)] ?: return emptyList()
        return list.takeLast(limit).reversed()
    }

    override fun publish(snapshot: OrderbookSnapshot) {
        snapshots[key(snapshot.asset, snapshot.market)] = snapshot
    }

    override fun publish(trade: TradeFill) {
        val k = key(trade.asset, trade.market)
        val list = trades.computeIfAbsent(k) { CopyOnWriteArrayList() }
        list.add(trade)
        // ring buffer cap — 200 trades / asset
        while (list.size > 200) list.removeAt(0)
    }

    private fun key(asset: AssetCode, market: MarketCode): String =
        "${asset.value}:${market.value}"
}
