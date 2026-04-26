package com.kgd.sevensplit.infrastructure.bithumb

/**
 * TG-07.2: 빗썸 캔들을 저장소에 bulk insert 하는 얇은 추상.
 *
 * - 프로덕션 구현체는 [ClickHouseCandleWriter] 로 `seven_split.market_tick_bithumb` 에 insert.
 * - 테스트는 메모리 리스트/NoOp 로 대체하여 ClickHouse 기동 없이 검증한다 (Phase 1 단위 테스트는 MockWebServer + in-memory writer).
 */
interface CandleWriter {
    /**
     * [symbol] (예: BTC_KRW) / [interval] (예: 1m) 조합에 해당하는 [rows] 를 저장.
     * 구현체는 chunked batch insert 등 자체 최적화를 수행한다.
     */
    fun write(symbol: String, interval: String, rows: List<Candle>)
}
