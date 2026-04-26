package com.kgd.quant.application.port.marketdata

import java.math.BigDecimal
import java.time.Instant

/**
 * Tick — 단일 시세 스냅샷.
 *
 * `MarketDataSubscriber.subscribe` 가 스트림 타입으로 사용한다.
 *
 * ## TG-P2-06 / INV-P2-08
 * `source` 필드는 시세 출처를 명시한다 (`WS` 실시간 WebSocket / `REST` REST 폴백 / `BACKTEST` 백테스트 리플레이).
 * Phase 1 호환을 위해 default = `BACKTEST` 로 두며, Phase 2 라이브 경로(`BithumbWebSocketSubscriber`,
 * `BithumbRestFallbackPoller`)는 항상 명시적으로 `WS` 또는 `REST` 를 지정한다.
 */
data class Tick(
    val symbol: Symbol,
    val price: BigDecimal,
    val volume: BigDecimal,
    val timestamp: Instant,
    val source: TickSource = TickSource.BACKTEST,
)

/**
 * Tick 의 출처. INV-P2-08 강제 — 라이브 경로는 반드시 WS / REST 중 하나.
 */
enum class TickSource {
    /** 빗썸/업비트 Public WebSocket 실시간 스트림. */
    WS,

    /** WebSocket 단절 시 REST 폴링으로 대체된 폴백 경로. */
    REST,

    /** Phase 1 백테스트 엔진의 historical bar 리플레이 경로. */
    BACKTEST,
}
