package com.kgd.recommendation.infrastructure.persistence

import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import javax.sql.DataSource

/**
 * analytics ClickHouse 의 `recommendation_score_daily` MV 를 조회.
 *
 * 30일 윈도우 + 최소 노출 필터 (≥ 10) 적용. CbScoreSync 가 호출.
 */
@Component
class ClickHouseScoreReader(
    @Qualifier("clickHouseDataSource") private val dataSource: DataSource,
) {
    /**
     * 도시×카테고리 단위 30일 누적 행동 카운트 조회.
     * 최소 노출 (모든 action 합계 ≥ minActionCount) 미만 아이템은 제외.
     */
    fun read30dActionCounts(minActionCount: Long = 10): List<CbScoreRow> {
        val sql = """
            SELECT
                city_id,
                category_id,
                item_id,
                sum(reservation_count) AS reservation_count,
                sum(click_count) AS click_count,
                sum(addwish_count) AS addwish_count,
                sum(pageview_count) AS pageview_count
            FROM analytics.recommendation_score_daily
            WHERE event_date >= today() - 30
            GROUP BY city_id, category_id, item_id
            HAVING reservation_count + click_count + addwish_count + pageview_count >= ?
        """.trimIndent()

        dataSource.connection.use { conn ->
            conn.prepareStatement(sql).use { ps ->
                ps.setLong(1, minActionCount)
                val rs = ps.executeQuery()
                val rows = mutableListOf<CbScoreRow>()
                while (rs.next()) {
                    rows += CbScoreRow(
                        cityId = rs.getLong("city_id"),
                        categoryId = rs.getLong("category_id"),
                        itemId = rs.getLong("item_id"),
                        reservationCount = rs.getLong("reservation_count"),
                        clickCount = rs.getLong("click_count"),
                        addwishCount = rs.getLong("addwish_count"),
                        pageviewCount = rs.getLong("pageview_count"),
                    )
                }
                return rows
            }
        }
    }
}
