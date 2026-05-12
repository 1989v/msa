package com.kgd.recommendation.infrastructure.persistence

import com.kgd.recommendation.port.ItemMetadata
import com.kgd.recommendation.port.ItemMetadataPort
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import javax.sql.DataSource

/**
 * Item 의 cityId/categoryId 를 ClickHouse 의 recommendation_events 에서 inferred.
 *
 * Phase 2 PoC 단계의 단순 구현 — 같은 item 의 가장 흔한 (city, category) 페어를 사용.
 * Phase 4+ 에서 product 서비스 직접 호출하거나 별도 캐시 도입.
 */
@Component
class ClickHouseItemMetadataAdapter(
    @Qualifier("clickHouseDataSource") private val dataSource: DataSource,
) : ItemMetadataPort {

    override fun getCityAndCategory(itemId: Long): ItemMetadata? {
        val sql = """
            SELECT city_id, category_id, count() AS c
            FROM analytics.recommendation_events
            WHERE item_id = ?
              AND timestamp >= now() - INTERVAL 30 DAY
            GROUP BY city_id, category_id
            ORDER BY c DESC
            LIMIT 1
        """.trimIndent()

        dataSource.connection.use { conn ->
            conn.prepareStatement(sql).use { ps ->
                ps.setLong(1, itemId)
                val rs = ps.executeQuery()
                if (!rs.next()) return null
                return ItemMetadata(
                    itemId = itemId,
                    cityId = rs.getLong(1),
                    categoryId = rs.getLong(2),
                )
            }
        }
    }
}
