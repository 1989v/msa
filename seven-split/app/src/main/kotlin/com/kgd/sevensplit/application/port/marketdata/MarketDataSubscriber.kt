package com.kgd.sevensplit.application.port.marketdata

import kotlinx.coroutines.flow.Flow

/**
 * MarketDataSubscriber — 실시간 시세 구독 port.
 *
 * ## 배치 위치
 * Application 레이어. Phase 2+ 에서 빗썸/업비트 WebSocket 어댑터로 구현.
 * Phase 1 백테스트 파이프라인은 [HistoricalMarketDataSource] 를 사용하므로
 * 이 port 는 **선언만** 해 둔다 (TG-04.3).
 *
 * ## 계약
 * - `subscribe` 는 WebSocket 연결을 유지하는 hot flow. 구독 취소 시 커넥션 해제.
 * - `fallbackPoll` 은 WebSocket 장애 시 REST polling 으로 대체하는 경로 (ADR-0015).
 * - 구현체는 재연결/백프레셔/중복 tick 제거를 내부적으로 처리.
 */
interface MarketDataSubscriber {
    /** 실시간 tick 스트림 — WebSocket 기반. */
    fun subscribe(symbol: Symbol): Flow<Tick>

    /** 폴백 경로 — WebSocket 단절 시 REST polling. */
    fun fallbackPoll(symbol: Symbol): Flow<Tick>
}
