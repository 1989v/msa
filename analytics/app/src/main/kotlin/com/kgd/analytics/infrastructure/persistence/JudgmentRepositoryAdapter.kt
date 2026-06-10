package com.kgd.analytics.infrastructure.persistence

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Repository
import java.sql.Timestamp
import java.time.Instant
import javax.sql.DataSource

/**
 * ADR-0050 Phase 4 — search_judgments 의 CRUD.
 *
 * source 컬럼:
 *  - 'weak'   : WeakJudgmentGenerator 가 일괄 INSERT
 *  - 'manual' : admin UI 가 단건 upsert
 *  - 'hybrid' : 약지도 부트스트랩 후 수동 보정
 *
 * ReplacingMergeTree(created_at) 이라 같은 (query, product_id, source) 의
 * 최신 created_at row 만 머지 시 유지된다.
 */
@Repository
class JudgmentRepositoryAdapter(
    private val dataSource: DataSource
) {
    private val log = KotlinLogging.logger {}

    fun upsertManual(query: String, productId: String, relevance: Int, weight: Double = 1.0) {
        require(relevance in 0..3) { "relevance must be in 0..3: $relevance" }
        require(weight > 0.0) { "weight must be > 0: $weight" }
        require(query.isNotBlank() && productId.isNotBlank()) { "query / productId must not be blank" }

        dataSource.connection.use { conn ->
            conn.prepareStatement(
                """
                INSERT INTO analytics.search_judgments
                    (query, product_id, relevance, source, weight, created_at)
                VALUES (?, ?, ?, 'manual', ?, ?)
                """.trimIndent()
            ).use { ps ->
                ps.setString(1, query)
                ps.setString(2, productId)
                ps.setInt(3, relevance)
                ps.setDouble(4, weight)
                ps.setTimestamp(5, Timestamp.from(Instant.now()))
                ps.executeUpdate()
            }
        }
        log.info { "Manual judgment upserted: query='$query', productId=$productId, relevance=$relevance" }
    }

    fun list(queryFilter: String?, limit: Int = 100, offset: Int = 0): List<JudgmentRow> {
        val sql = buildString {
            append(
                """
                SELECT query, product_id, max(relevance) AS rel, any(source) AS src,
                       any(weight) AS w, max(created_at) AS ts
                FROM analytics.search_judgments
                """.trimIndent()
            )
            if (!queryFilter.isNullOrBlank()) append("\nWHERE query LIKE ?")
            append("\nGROUP BY query, product_id\nORDER BY ts DESC\nLIMIT ? OFFSET ?")
        }
        val out = mutableListOf<JudgmentRow>()
        dataSource.connection.use { conn ->
            conn.prepareStatement(sql).use { ps ->
                var idx = 1
                if (!queryFilter.isNullOrBlank()) {
                    ps.setString(idx++, "%${queryFilter.trim()}%")
                }
                ps.setInt(idx++, limit)
                ps.setInt(idx, offset)
                ps.executeQuery().use { rs ->
                    while (rs.next()) {
                        out.add(
                            JudgmentRow(
                                query = rs.getString("query"),
                                productId = rs.getString("product_id"),
                                relevance = rs.getInt("rel"),
                                source = rs.getString("src") ?: "weak",
                                weight = rs.getDouble("w").takeIf { !rs.wasNull() } ?: 1.0,
                                createdAt = rs.getTimestamp("ts").toInstant()
                            )
                        )
                    }
                }
            }
        }
        return out
    }

    fun distinctQueries(prefix: String?, limit: Int = 50): List<String> {
        val sql = buildString {
            append("SELECT DISTINCT query FROM analytics.search_judgments")
            if (!prefix.isNullOrBlank()) append(" WHERE query LIKE ?")
            append(" ORDER BY query LIMIT ?")
        }
        val out = mutableListOf<String>()
        dataSource.connection.use { conn ->
            conn.prepareStatement(sql).use { ps ->
                var idx = 1
                if (!prefix.isNullOrBlank()) ps.setString(idx++, "${prefix.trim()}%")
                ps.setInt(idx, limit)
                ps.executeQuery().use { rs ->
                    while (rs.next()) out.add(rs.getString("query"))
                }
            }
        }
        return out
    }
}

data class JudgmentRow(
    val query: String,
    val productId: String,
    val relevance: Int,
    val source: String,
    val weight: Double,
    val createdAt: Instant
)
