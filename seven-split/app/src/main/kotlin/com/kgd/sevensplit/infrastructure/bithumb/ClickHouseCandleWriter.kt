package com.kgd.sevensplit.infrastructure.bithumb

import com.kgd.sevensplit.infrastructure.clickhouse.ClickHouseConfig
import java.sql.DriverManager
import java.time.Instant
import java.time.ZoneOffset

/**
 * TG-07.2: `seven_split.market_tick_bithumb` 에 bulk insert 하는 [CandleWriter] 구현체.
 *
 * - PreparedStatement + `addBatch()` + 1,000 rows 단위 chunking 으로 네트워크 왕복 최소화.
 * - DriverManager 를 통한 단기 JDBC 커넥션 사용 (배치 실행 한 번 당 1 커넥션).
 * - ReplacingMergeTree 엔진이 `ORDER BY (symbol, interval, ts)` 키로 중복을 자연 해소하므로
 *   호출자는 중복 insert 를 지나치게 걱정하지 않아도 된다.
 */
class ClickHouseCandleWriter(
    private val clickHouseConfig: ClickHouseConfig,
    private val batchSize: Int = 1000,
) : CandleWriter {

    override fun write(symbol: String, interval: String, rows: List<Candle>) {
        if (rows.isEmpty()) return
        val sql = """
            INSERT INTO seven_split.market_tick_bithumb
                (symbol, `interval`, ts, open, high, low, close, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """.trimIndent()
        DriverManager.getConnection(
            clickHouseConfig.url,
            clickHouseConfig.username,
            clickHouseConfig.password,
        ).use { conn ->
            conn.prepareStatement(sql).use { stmt ->
                rows.chunked(batchSize).forEach { batch ->
                    batch.forEach { c ->
                        stmt.setString(1, symbol)
                        stmt.setString(2, interval)
                        stmt.setObject(3, Instant.ofEpochMilli(c.timestampMs).atOffset(ZoneOffset.UTC))
                        stmt.setBigDecimal(4, c.open)
                        stmt.setBigDecimal(5, c.high)
                        stmt.setBigDecimal(6, c.low)
                        stmt.setBigDecimal(7, c.close)
                        stmt.setBigDecimal(8, c.volume)
                        stmt.addBatch()
                    }
                    stmt.executeBatch()
                    stmt.clearBatch()
                }
            }
        }
    }
}
