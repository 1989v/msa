package com.kgd.quant.infrastructure.chart

import com.kgd.quant.application.chart.OrderbookPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.OrderbookLevel
import com.kgd.quant.domain.asset.OrderbookSnapshot
import com.kgd.quant.domain.market.MarketCode
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentSkipListMap

/**
 * OrderbookSnapshotMaintainer — ADR-0039 정밀화.
 *
 * 빗썸 orderbookdepth 의 incremental update (변경 가격대만 보냄) 를 자산별 누적 snapshot 으로 maintain.
 *
 * - asks: ConcurrentSkipListMap<price ASC>
 * - bids: ConcurrentSkipListMap<price DESC>
 * - delta.quantity == 0: 가격대 제거
 * - delta.quantity > 0: 가격대 추가/갱신
 * - 매 delta 후 상위 15단 snapshot 만들어 store.publish
 *
 * Concurrency: 동일 자산에 대해 multiple ws message 가 동시 도달할 수 있으므로 자산별 mutex (computeIfAbsent + ConcurrentSkipListMap).
 */
@Component
class OrderbookSnapshotMaintainer(
    private val store: OrderbookPort,
) {
    enum class Side { ASK, BID }

    data class Delta(val side: Side, val price: BigDecimal, val quantity: BigDecimal)

    private data class BookState(
        val asks: ConcurrentSkipListMap<BigDecimal, BigDecimal> = ConcurrentSkipListMap(),
        val bids: ConcurrentSkipListMap<BigDecimal, BigDecimal> = ConcurrentSkipListMap(Comparator.reverseOrder()),
    )

    private val books = ConcurrentHashMap<String, BookState>()

    fun applyDeltas(asset: AssetCode, market: MarketCode, deltas: List<Delta>) {
        if (deltas.isEmpty()) return
        val key = "${asset.value}:${market.value}"
        val state = books.computeIfAbsent(key) { BookState() }
        synchronized(state) {
            deltas.forEach { d ->
                val target = if (d.side == Side.ASK) state.asks else state.bids
                if (d.quantity.signum() <= 0) {
                    target.remove(d.price)
                } else {
                    target[d.price] = d.quantity
                }
            }
            val asks = state.asks.entries.take(15).map { OrderbookLevel(it.key, it.value) }
            val bids = state.bids.entries.take(15).map { OrderbookLevel(it.key, it.value) }
            store.publish(
                OrderbookSnapshot(
                    asset = asset,
                    market = market,
                    asks = asks,
                    bids = bids,
                    ts = Instant.now(),
                ),
            )
        }
    }
}
