package com.kgd.quant.domain.asset

import com.kgd.quant.domain.market.MarketCode
import java.math.BigDecimal
import java.time.Instant

/** ADR-0039 — 호가 한 단위 (price + quantity). */
data class OrderbookLevel(
    val price: BigDecimal,
    val quantity: BigDecimal,
)

/**
 * ADR-0039 — 호가 snapshot. asks (매도, 오름차순) + bids (매수, 내림차순).
 *
 * Phase A: CRYPTO (빗썸 ws orderbookdepth) 우선. 주식은 별도 phase.
 */
data class OrderbookSnapshot(
    val asset: AssetCode,
    val market: MarketCode,
    val asks: List<OrderbookLevel>,
    val bids: List<OrderbookLevel>,
    val ts: Instant,
)

/** ADR-0039 — 체결 (transaction stream). */
data class TradeFill(
    val asset: AssetCode,
    val market: MarketCode,
    val price: BigDecimal,
    val quantity: BigDecimal,
    val side: TradeSide,
    val ts: Instant,
)

enum class TradeSide { BUY, SELL }
