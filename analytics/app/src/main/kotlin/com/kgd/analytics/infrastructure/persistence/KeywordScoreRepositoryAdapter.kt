package com.kgd.analytics.infrastructure.persistence

import com.kgd.analytics.domain.model.KeywordScore
import com.kgd.analytics.domain.port.KeywordScoreRepositoryPort
import org.springframework.stereotype.Repository
import java.sql.Timestamp
import javax.sql.DataSource

@Repository
class KeywordScoreRepositoryAdapter(
    private val dataSource: DataSource
) : KeywordScoreRepositoryPort {

    override fun save(score: KeywordScore) {
        dataSource.connection.use { conn ->
            conn.prepareStatement(
                """
                INSERT INTO analytics.keyword_scores
                (keyword, search_count, total_clicks, total_orders, ctr, cvr, score, window_start, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """.trimIndent()
            ).use { ps ->
                ps.setString(1, score.keyword)
                ps.setLong(2, score.searchCount)
                ps.setLong(3, score.totalClicks)
                ps.setLong(4, score.totalOrders)
                ps.setDouble(5, score.ctr)
                ps.setDouble(6, score.cvr)
                ps.setDouble(7, score.score)
                ps.setTimestamp(8, Timestamp.from(score.updatedAt))
                ps.setTimestamp(9, Timestamp.from(score.updatedAt))
                ps.executeUpdate()
            }
        }
    }

    override fun findByKeyword(keyword: String): KeywordScore? {
        dataSource.connection.use { conn ->
            conn.prepareStatement(
                """
                SELECT keyword, search_count, total_clicks, total_orders, ctr, cvr, score, updated_at
                FROM analytics.keyword_scores
                WHERE keyword = ?
                ORDER BY updated_at DESC
                LIMIT 1
                """.trimIndent()
            ).use { ps ->
                ps.setString(1, keyword)
                val rs = ps.executeQuery()
                return if (rs.next()) KeywordScore(
                    keyword = rs.getString("keyword"),
                    searchCount = rs.getLong("search_count"),
                    totalClicks = rs.getLong("total_clicks"),
                    totalOrders = rs.getLong("total_orders"),
                    ctr = rs.getDouble("ctr"),
                    cvr = rs.getDouble("cvr"),
                    score = rs.getDouble("score"),
                    updatedAt = rs.getTimestamp("updated_at").toInstant()
                ) else null
            }
        }
    }
}
