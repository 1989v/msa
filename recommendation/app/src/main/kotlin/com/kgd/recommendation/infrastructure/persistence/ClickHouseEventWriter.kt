package com.kgd.recommendation.infrastructure.persistence

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import java.sql.Timestamp
import java.time.Instant
import javax.sql.DataSource

/**
 * analytics.recommendation_events 에 행동 이벤트 적재.
 *
 * Kafka consumer 가 batch 로 호출. 단건 호출도 가능하지만 효율 위해 batch 권장.
 */
@Component
class ClickHouseEventWriter(
    @Qualifier("clickHouseDataSource") private val dataSource: DataSource,
) {
    private val logger = KotlinLogging.logger {}

    fun insertBatch(events: List<RecommendationEventRow>) {
        if (events.isEmpty()) return

        val sql = """
            INSERT INTO analytics.recommendation_events
            (user_id, item_id, action_type, city_id, category_id, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        """.trimIndent()

        dataSource.connection.use { conn ->
            conn.prepareStatement(sql).use { ps ->
                events.forEach { event ->
                    ps.setLong(1, event.userId)
                    ps.setLong(2, event.itemId)
                    ps.setString(3, event.actionType)
                    ps.setLong(4, event.cityId)
                    ps.setLong(5, event.categoryId)
                    ps.setTimestamp(6, Timestamp.from(event.timestamp))
                    ps.addBatch()
                }
                ps.executeBatch()
            }
        }
        logger.debug { "ClickHouseEventWriter: inserted ${events.size} events" }
    }
}

data class RecommendationEventRow(
    val userId: Long,
    val itemId: Long,
    /** 'pageview' | 'click' | 'addwish' | 'reservation' */
    val actionType: String,
    val cityId: Long,
    val categoryId: Long,
    val timestamp: Instant,
)
