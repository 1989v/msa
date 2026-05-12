package com.kgd.recommendation.infrastructure.persistence

import com.kgd.recommendation.port.UserMetadataPort
import com.kgd.recommendation.port.UserPreferredContext
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import javax.sql.DataSource

@Component
class ClickHouseUserMetadataAdapter(
    @Qualifier("clickHouseDataSource") private val dataSource: DataSource,
) : UserMetadataPort {

    override fun inferPreferredContext(userId: Long): UserPreferredContext? {
        val sql = """
            SELECT city_id, category_id, count() AS c
            FROM analytics.recommendation_events
            WHERE user_id = ?
              AND timestamp >= now() - INTERVAL 90 DAY
              AND action_type IN ('click', 'addwish', 'reservation')
            GROUP BY city_id, category_id
            ORDER BY c DESC
            LIMIT 1
        """.trimIndent()

        dataSource.connection.use { conn ->
            conn.prepareStatement(sql).use { ps ->
                ps.setLong(1, userId)
                val rs = ps.executeQuery()
                if (!rs.next()) return null
                return UserPreferredContext(
                    userId = userId,
                    cityId = rs.getLong(1),
                    categoryId = rs.getLong(2),
                )
            }
        }
    }

    override fun getActionCount(userId: Long): Long {
        val sql = """
            SELECT count()
            FROM analytics.recommendation_events
            WHERE user_id = ?
              AND timestamp >= now() - INTERVAL 30 DAY
        """.trimIndent()

        dataSource.connection.use { conn ->
            conn.prepareStatement(sql).use { ps ->
                ps.setLong(1, userId)
                val rs = ps.executeQuery()
                return if (rs.next()) rs.getLong(1) else 0L
            }
        }
    }
}
