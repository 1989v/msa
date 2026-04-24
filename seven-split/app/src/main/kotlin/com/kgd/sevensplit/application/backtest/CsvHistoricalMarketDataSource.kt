package com.kgd.sevensplit.application.backtest

import com.kgd.sevensplit.application.port.marketdata.Bar
import com.kgd.sevensplit.application.port.marketdata.BarInterval
import com.kgd.sevensplit.application.port.marketdata.HistoricalMarketDataSource
import com.kgd.sevensplit.application.port.marketdata.Symbol
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import java.math.BigDecimal
import java.time.Instant

/**
 * CsvHistoricalMarketDataSource — classpath 리소스 CSV 를 [Bar] 스트림으로 변환.
 *
 * ## CSV 포맷
 * ```
 * timestamp,open,high,low,close,volume
 * 2026-01-01T00:00:00Z,30000000,30100000,29900000,30050000,12.5
 * ...
 * ```
 * - 헤더 1 줄 필수.
 * - `timestamp` 는 ISO-8601 (`Instant.parse` 가 허용하는 형식).
 * - 숫자는 `BigDecimal` 로 파싱 — 지수/분수 허용.
 *
 * ## 경로 규칙
 * `golden/{exchange}/{symbol}_{interval}.csv` 형태로 classpath 에서 로드.
 * 예: `golden/bithumb/BTC_KRW_MINUTE_1_tight.csv`
 *
 * ## 결정론 보장
 * - 읽은 모든 Bar 를 `timestamp` 기준 오름차순으로 재정렬 (CSV 가 뒤섞여 있어도 안전).
 * - `from..to` 반개구간 필터 적용 — port 계약을 따름.
 *
 * ## 제약
 * - 대용량 파일은 비권장 (전체를 메모리에 로드). Phase 2 에서 ClickHouse 기반으로 교체 예정.
 */
class CsvHistoricalMarketDataSource(
    private val classLoader: ClassLoader,
    private val resourcePrefix: String = "golden/bithumb"
) : HistoricalMarketDataSource {

    override fun stream(
        symbol: Symbol,
        from: Instant,
        to: Instant,
        interval: BarInterval
    ): Flow<Bar> = flow {
        val resourceName = "$resourcePrefix/${symbol.value}_${interval.name}.csv"
        val stream = classLoader.getResourceAsStream(resourceName)
            ?: error("CSV resource not found: $resourceName")

        val bars = stream.bufferedReader(Charsets.UTF_8).useLines { lines ->
            lines
                .drop(1)
                .mapNotNull { parseLine(it, symbol, interval) }
                .filter { it.timestamp >= from && it.timestamp < to }
                .sortedBy { it.timestamp }
                .toList()
        }
        for (bar in bars) {
            emit(bar)
        }
    }

    private fun parseLine(raw: String, symbol: Symbol, interval: BarInterval): Bar? {
        val line = raw.trim()
        if (line.isEmpty()) return null
        val cols = line.split(',').map { it.trim() }
        require(cols.size >= 6) { "Invalid CSV row: $raw" }
        return Bar(
            symbol = symbol,
            interval = interval,
            timestamp = Instant.parse(cols[0]),
            open = BigDecimal(cols[1]),
            high = BigDecimal(cols[2]),
            low = BigDecimal(cols[3]),
            close = BigDecimal(cols[4]),
            volume = BigDecimal(cols[5])
        )
    }
}
