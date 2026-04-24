package com.kgd.sevensplit.infrastructure.clickhouse

import java.io.InputStream
import java.sql.Connection
import java.time.OffsetDateTime

/**
 * TG-06.7: fixture CSV 를 seven_split.market_tick_bithumb 으로 벌크 insert 하는 테스트/배치 공용 유틸.
 *
 * CSV 포맷(헤더 1행):
 *   ts,open,high,low,close,volume
 *   2024-01-01T00:00:00Z,43000.00,43100.00,42950.00,43080.00,12.34
 *
 * - symbol/interval 은 파일 단위로 한 번 지정 (호출부에서 제공).
 * - batchSize 기본 1000. 주기적으로 executeBatch() 호출하여 JDBC 메모리 사용 억제.
 * - TG-07 REST 배치 수집기에서도 재사용 예정이지만, 현재 test sourceSet 에 배치.
 */
object CsvToClickHouseBulkLoader {

    /** CSV 한 파일을 market_tick_bithumb 에 bulk insert. 헤더 스킵. */
    fun load(conn: Connection, symbol: String, interval: String, csv: InputStream, batchSize: Int = 1000) {
        val sql = """
            INSERT INTO seven_split.market_tick_bithumb
                (symbol, `interval`, ts, open, high, low, close, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """.trimIndent()

        conn.prepareStatement(sql).use { stmt ->
            csv.bufferedReader().useLines { lines ->
                var count = 0
                for (line in lines.drop(1)) {
                    if (line.isBlank()) continue
                    val cols = line.split(",")
                    stmt.setString(1, symbol)
                    stmt.setString(2, interval)
                    stmt.setObject(3, OffsetDateTime.parse(cols[0]))
                    stmt.setBigDecimal(4, cols[1].toBigDecimal())
                    stmt.setBigDecimal(5, cols[2].toBigDecimal())
                    stmt.setBigDecimal(6, cols[3].toBigDecimal())
                    stmt.setBigDecimal(7, cols[4].toBigDecimal())
                    stmt.setBigDecimal(8, cols[5].toBigDecimal())
                    stmt.addBatch()
                    count++
                    if (count % batchSize == 0) stmt.executeBatch()
                }
                stmt.executeBatch()
            }
        }
    }
}
