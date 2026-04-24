package com.kgd.sevensplit.application.port.marketdata

import java.math.BigDecimal
import java.time.Instant

/**
 * Tick — 단일 시세 스냅샷.
 *
 * `MarketDataSubscriber.subscribe` 가 스트림 타입으로 사용한다.
 */
data class Tick(
    val symbol: Symbol,
    val price: BigDecimal,
    val volume: BigDecimal,
    val timestamp: Instant
)
