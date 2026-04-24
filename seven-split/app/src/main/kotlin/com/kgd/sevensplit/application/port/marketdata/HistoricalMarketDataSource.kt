package com.kgd.sevensplit.application.port.marketdata

import kotlinx.coroutines.flow.Flow
import java.math.BigDecimal
import java.time.Instant

/**
 * HistoricalMarketDataSource — 과거 시세 조회 port.
 *
 * ## 배치 위치
 * Application 레이어. 백테스트 엔진의 주 입력 (TG-05).
 *
 * ## 계약
 * - `stream` 반환 Flow 는 **timestamp 오름차순** 을 보장해야 한다 (결정론).
 * - from <= bar.timestamp < to (반개구간) 을 따른다.
 * - 구현체는 CSV / ClickHouse / 파일 기반 어느 것이든 가능하나 정렬 보장 필수.
 */
interface HistoricalMarketDataSource {
    /**
     * 지정 기간·간격의 Bar 스트림을 반환.
     * @param symbol 조회 심볼
     * @param from 시작 시각 (포함)
     * @param to 종료 시각 (제외)
     * @param interval Bar 집계 단위
     */
    fun stream(symbol: Symbol, from: Instant, to: Instant, interval: BarInterval): Flow<Bar>
}

/** Bar 집계 단위. 거래소/데이터 소스가 지원하는 간격에 맞춘다. */
enum class BarInterval {
    MINUTE_1,
    MINUTE_5,
    MINUTE_15,
    HOUR_1,
    HOUR_4,
    DAY_1
}

/**
 * Bar — OHLCV 집계 봉.
 *
 * `timestamp` 는 해당 bar 의 시작 시각 (left-closed).
 */
data class Bar(
    val symbol: Symbol,
    val interval: BarInterval,
    val timestamp: Instant,
    val open: BigDecimal,
    val high: BigDecimal,
    val low: BigDecimal,
    val close: BigDecimal,
    val volume: BigDecimal
)
