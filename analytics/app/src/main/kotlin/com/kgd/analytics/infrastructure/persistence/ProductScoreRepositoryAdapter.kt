package com.kgd.analytics.infrastructure.persistence

import com.kgd.analytics.domain.model.ProductScore
import com.kgd.analytics.domain.port.ProductScoreRepositoryPort
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.sql.Timestamp
import java.time.Duration
import java.time.Instant
import javax.sql.DataSource

@Repository
class ProductScoreRepositoryAdapter(
    private val dataSource: DataSource
) : ProductScoreRepositoryPort {

    override fun save(score: ProductScore) {
        dataSource.connection.use { conn ->
            conn.prepareStatement(
                """
                INSERT INTO analytics.product_scores
                (product_id, impressions, clicks, orders, ctr, cvr, ctr_raw, cvr_raw,
                 popularity_score, gmv_1h, window_start, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """.trimIndent()
            ).use { ps ->
                ps.setLong(1, score.productId)
                ps.setLong(2, score.impressions)
                ps.setLong(3, score.clicks)
                ps.setLong(4, score.orders)
                ps.setDouble(5, score.ctr)
                ps.setDouble(6, score.cvr)
                ps.setDouble(7, score.ctrRaw)
                ps.setDouble(8, score.cvrRaw)
                ps.setDouble(9, score.popularityScore)
                ps.setDouble(10, score.gmv1h)
                ps.setTimestamp(11, Timestamp.from(score.updatedAt))
                ps.setTimestamp(12, Timestamp.from(score.updatedAt))
                ps.executeUpdate()
            }
        }
    }

    override fun findByProductId(productId: Long): ProductScore? {
        dataSource.connection.use { conn ->
            conn.prepareStatement(
                """
                SELECT product_id, impressions, clicks, orders, ctr, cvr, ctr_raw, cvr_raw,
                       popularity_score, gmv_1h, updated_at
                FROM analytics.product_scores
                WHERE product_id = ?
                ORDER BY updated_at DESC
                LIMIT 1
                """.trimIndent()
            ).use { ps ->
                ps.setLong(1, productId)
                val rs = ps.executeQuery()
                return if (rs.next()) mapProductScore(rs) else null
            }
        }
    }

    override fun findByProductIds(productIds: List<Long>): List<ProductScore> {
        if (productIds.isEmpty()) return emptyList()
        val placeholders = productIds.joinToString(",") { "?" }
        dataSource.connection.use { conn ->
            conn.prepareStatement(
                """
                SELECT product_id, impressions, clicks, orders, ctr, cvr, ctr_raw, cvr_raw,
                       popularity_score, gmv_1h, updated_at
                FROM analytics.product_scores
                WHERE product_id IN ($placeholders)
                ORDER BY product_id, updated_at DESC
                """.trimIndent()
            ).use { ps ->
                productIds.forEachIndexed { i, id -> ps.setLong(i + 1, id) }
                val rs = ps.executeQuery()
                val results = mutableMapOf<Long, ProductScore>()
                while (rs.next()) {
                    val score = mapProductScore(rs)
                    results.putIfAbsent(score.productId, score)
                }
                return results.values.toList()
            }
        }
    }

    override fun findGmvSince(productId: Long, duration: Duration): Double {
        val since = Instant.now().minus(duration)
        dataSource.connection.use { conn ->
            conn.prepareStatement(
                """
                SELECT sum(gmv_1h) AS gmv_sum
                FROM analytics.product_scores
                WHERE product_id = ? AND window_start >= ?
                """.trimIndent()
            ).use { ps ->
                ps.setLong(1, productId)
                ps.setTimestamp(2, Timestamp.from(since))
                val rs = ps.executeQuery()
                return if (rs.next()) rs.getDouble("gmv_sum") else 0.0
            }
        }
    }

    private fun mapProductScore(rs: ResultSet): ProductScore = ProductScore(
        productId = rs.getLong("product_id"),
        impressions = rs.getLong("impressions"),
        clicks = rs.getLong("clicks"),
        orders = rs.getLong("orders"),
        ctr = rs.getDouble("ctr"),
        cvr = rs.getDouble("cvr"),
        ctrRaw = rs.getDouble("ctr_raw"),
        cvrRaw = rs.getDouble("cvr_raw"),
        popularityScore = rs.getDouble("popularity_score"),
        gmv1h = rs.getDouble("gmv_1h"),
        updatedAt = rs.getTimestamp("updated_at").toInstant()
    )
}
