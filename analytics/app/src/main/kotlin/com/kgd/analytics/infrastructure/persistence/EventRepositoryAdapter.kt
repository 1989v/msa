package com.kgd.analytics.infrastructure.persistence

import tools.jackson.databind.ObjectMapper
import com.kgd.analytics.application.event.port.EventRepositoryPort
import com.kgd.analytics.application.event.port.ExperimentMetricRow
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
                (event_id, entity_type, entity_id, action,
                 screen_type, screen_ref, section_id, section_index, item_index,
                 view_id, visitor_id, session_id, user_id, timestamp, payload,
                 experiment_ids, experiment_variants)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """.trimIndent()
            ).use { ps ->
                events.forEach { event ->
                    val p = event.placement
                    ps.setString(1, event.eventId)
                    ps.setString(2, event.entityType.name)
                    ps.setString(3, event.entityId)
                    ps.setString(4, event.action.name)
                    // 위치는 계층 그대로 넣는다 — 한 칸으로 누르면 섹션 순서와 항목 순서가 섞인다
                    ps.setString(5, p?.screenType ?: "")
                    ps.setString(6, p?.screenRef ?: "")
                    ps.setString(7, p?.sectionId ?: "")
                    val sectionIndex = p?.sectionIndex
                    if (sectionIndex != null) ps.setInt(8, sectionIndex) else ps.setNull(8, Types.INTEGER)
                    val itemIndex = p?.itemIndex
                    if (itemIndex != null) ps.setInt(9, itemIndex) else ps.setNull(9, Types.INTEGER)
                    ps.setString(10, event.viewId)
                    ps.setString(11, event.visitorId)
                    ps.setString(12, event.sessionId)
                    val userId = event.userId
                    if (userId != null) ps.setLong(13, userId) else ps.setNull(13, Types.BIGINT)
                    ps.setTimestamp(14, Timestamp.from(event.timestamp))
                    ps.setString(15, objectMapper.writeValueAsString(event.payload))
                    val expIds = event.experimentAssignments?.keys?.toList() ?: emptyList()
                    val expVariants = event.experimentAssignments?.values?.toList() ?: emptyList()
                    ps.setObject(16, expIds.toLongArray())
                    ps.setObject(17, expVariants.toTypedArray())
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
