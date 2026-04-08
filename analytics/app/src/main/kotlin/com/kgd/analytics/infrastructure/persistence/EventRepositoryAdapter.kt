package com.kgd.analytics.infrastructure.persistence

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.analytics.domain.port.EventRepositoryPort
import com.kgd.analytics.domain.port.ExperimentMetricRow
import com.kgd.common.analytics.AnalyticsEvent
import org.springframework.stereotype.Repository
import java.sql.Timestamp
import java.sql.Types
import java.time.Instant
import javax.sql.DataSource

@Repository
class EventRepositoryAdapter(
    private val dataSource: DataSource,
    private val objectMapper: ObjectMapper
) : EventRepositoryPort {

    override fun saveEvents(events: List<AnalyticsEvent>) {
        if (events.isEmpty()) return
        dataSource.connection.use { conn ->
            conn.prepareStatement(
                """
                INSERT INTO analytics.events
                (event_id, event_type, user_id, visitor_id, session_id, timestamp, payload,
                 product_id, keyword, source, position, experiment_ids, experiment_variants)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """.trimIndent()
            ).use { ps ->
                events.forEach { event ->
                    ps.setString(1, event.eventId)
                    ps.setString(2, event.eventType.name)
                    val userId = event.userId
                    if (userId != null) ps.setLong(3, userId) else ps.setNull(3, Types.BIGINT)
                    ps.setString(4, event.visitorId)
                    ps.setString(5, event.sessionId)
                    ps.setTimestamp(6, Timestamp.from(event.timestamp))
                    ps.setString(7, objectMapper.writeValueAsString(event.payload))
                    // Extract common fields from payload
                    val productId = event.payload["productId"]?.let { (it as? Number)?.toLong() }
                    val keyword = event.payload["keyword"]?.toString()
                    val source = event.payload["source"]?.toString()
                    val position = event.payload["position"]?.let { (it as? Number)?.toInt() }
                    if (productId != null) ps.setLong(8, productId) else ps.setNull(8, Types.BIGINT)
                    if (keyword != null) ps.setString(9, keyword) else ps.setNull(9, Types.VARCHAR)
                    if (source != null) ps.setString(10, source) else ps.setNull(10, Types.VARCHAR)
                    if (position != null) ps.setInt(11, position) else ps.setNull(11, Types.INTEGER)
                    // Experiment assignments
                    val expIds = event.experimentAssignments?.keys?.toList() ?: emptyList()
                    val expVariants = event.experimentAssignments?.values?.toList() ?: emptyList()
                    ps.setObject(12, expIds.toLongArray())
                    ps.setObject(13, expVariants.toTypedArray())
                    ps.addBatch()
                }
                ps.executeBatch()
            }
        }
    }

    override fun queryExperimentMetrics(
        experimentId: Long,
        startTime: Instant,
        endTime: Instant
    ): List<ExperimentMetricRow> {
        dataSource.connection.use { conn ->
            conn.prepareStatement(
                """
                SELECT
                    experiment_variants[indexOf(experiment_ids, ?)] as variant_name,
                    event_type,
                    count(*) as event_count
                FROM analytics.events
                WHERE has(experiment_ids, ?)
                  AND timestamp BETWEEN ? AND ?
                GROUP BY variant_name, event_type
                HAVING variant_name != ''
                """.trimIndent()
            ).use { ps ->
                ps.setLong(1, experimentId)
                ps.setLong(2, experimentId)
                ps.setTimestamp(3, Timestamp.from(startTime))
                ps.setTimestamp(4, Timestamp.from(endTime))
                val rs = ps.executeQuery()
                val results = mutableListOf<ExperimentMetricRow>()
                while (rs.next()) {
                    results.add(
                        ExperimentMetricRow(
                            variantName = rs.getString("variant_name"),
                            eventType = rs.getString("event_type"),
                            eventCount = rs.getLong("event_count")
                        )
                    )
                }
                return results
            }
        }
    }
}
