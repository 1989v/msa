package com.kgd.sevensplit.infrastructure.bithumb

import java.math.BigDecimal

/**
 * TG-07: 빗썸 Public Candle Stick API 원형 응답.
 *
 * 실제 응답 예:
 * ```
 * {
 *   "status": "0000",
 *   "data": [
 *     [ 1700000000000, "30000000", "30100000", "30200000", "29900000", "1.5" ],
 *     ...
 *   ]
 * }
 * ```
 * 배열 구조: `[ timestamp_ms, open, close, high, low, volume ]`
 *
 * Jackson 기본 역직렬화를 위해 `List<List<Any>>` 로 수신 후 `rows()` 에서 타입 변환한다.
 * Phase 1 은 페이지네이션 없이 한 번 호출로 가능한 전체 과거 데이터를 내려받는다.
 */
data class BithumbCandleResponse(
    val status: String = "",
    val data: List<List<Any>> = emptyList(),
) {
    /** 응답 배열을 타입 안전한 [Candle] 목록으로 변환. 숫자/문자열 혼재를 방어적으로 파싱한다. */
    fun rows(): List<Candle> = data.map { row ->
        require(row.size >= 6) { "bithumb candle row must have at least 6 elements, got=${row.size}" }
        Candle(
            timestampMs = (row[0] as Number).toLong(),
            open = row[1].toString().toBigDecimal(),
            close = row[2].toString().toBigDecimal(),
            high = row[3].toString().toBigDecimal(),
            low = row[4].toString().toBigDecimal(),
            volume = row[5].toString().toBigDecimal(),
        )
    }
}

/**
 * 빗썸 분봉 1 row 의 타입 안전한 표현.
 *
 * 주의: 빗썸 원형 응답 배열은 `[ts, open, close, high, low, volume]` 순이지만
 * [Candle] 는 관용적인 OHLCV 순으로 필드를 배치한다.
 */
data class Candle(
    val timestampMs: Long,
    val open: BigDecimal,
    val high: BigDecimal,
    val low: BigDecimal,
    val close: BigDecimal,
    val volume: BigDecimal,
)
