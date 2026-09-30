package com.kgd.search.infrastructure.clicksignal

import org.springframework.stereotype.Component
import java.sql.DriverManager
import java.time.LocalDate

/**
 * analytics 의 관광지 일 집계 표에서 날짜 범위의 고유 클릭 방문자 수를 읽는다 (ADR-0095 §6).
 *
 * 날짜를 `uniqMerge` 로 합친다 — 일별 수를 더하면 여러 날 누른 한 사람이 여러 번 세어진다.
 * 0 인 관광지는 싣지 않는다(맵 크기를 클릭이 있는 곳으로 줄인다). 실패는 호출부가 처리한다.
 */
@Component
class ClickHouseClickSignalReader(
    private val properties: ClickSignalProperties,
) {

    /** @return attraction_id → 고유 클릭 방문자 수 (1 이상만) */
    fun loadUniqueClickers(window: ClosedRange<LocalDate>): Map<String, Int> =
        DriverManager.getConnection(
            properties.clickhouseUrl,
            properties.clickhouseUser,
            properties.clickhousePassword,
        ).use { conn ->
            conn.prepareStatement(QUERY).use { ps ->
                ps.setString(1, window.start.toString())
                ps.setString(2, window.endInclusive.toString())
                ps.executeQuery().use { rs ->
                    buildMap {
                        while (rs.next()) put(rs.getString(1), rs.getLong(2).toInt())
                    }
                }
            }
        }

    private companion object {
        const val QUERY = """
            SELECT attraction_id, toUInt64(uniqMerge(unique_clickers)) AS clickers
            FROM analytics.attraction_popularity_daily
            WHERE day BETWEEN toDate(?) AND toDate(?)
            GROUP BY attraction_id
            HAVING clickers > 0
        """
    }
}
