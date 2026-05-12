package com.kgd.recommendation.infrastructure.persistence

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import javax.sql.DataSource

/**
 * ADR-0044 Phase 2 — Item-Item CF (PPMI) 계산.
 *
 * Spark 도입 없이 ClickHouse 의 array + aggregate 함수만으로 분산 계산.
 * 데이터 규모 (~수억 events / ~수백만 items) 까지는 ClickHouse 단독으로 충분.
 * 더 큰 규모는 Phase 2.5 에서 Spark Operator 검토.
 *
 * 알고리즘 (study/docs/20-recommendation-modeling/02-cf-similarity-metrics.md §5):
 *   PPMI(i,j) = max(0, log( P(i,j) / (P(i) × P(j)) ))
 *     P(i,j) = (i,j 둘 다 보유한 사용자 수) / 전체 사용자 수
 *     P(i)   = (i 보유한 사용자 수) / 전체 사용자 수
 *
 * 시그널: click + addwish + reservation (강한 행동). pageview 는 noise 비율 높아 제외.
 * 윈도우: 30일. 최소 공출현: 5번 이상.
 */
@Component
class ClickHouseItemSimilarityComputer(
    @Qualifier("clickHouseDataSource") private val dataSource: DataSource,
) {
    private val logger = KotlinLogging.logger {}

    /**
     * 전체 item-item PPMI 계산 후 analytics.item_similarity 에 INSERT.
     *
     * @param windowDays 학습 윈도우 (일)
     * @param minCoCount 최소 공출현 (sparse 함정 회피)
     * @param topPerItem item 당 보관할 Top-K
     * @return INSERT 된 row 수
     */
    fun computeAndStore(
        windowDays: Int = 30,
        // mock seed (5 사용자) 환경에서는 2 가 합리적. production 에서는 5+ 권장 (sparse 함정).
        minCoCount: Long = 2,
        topPerItem: Int = 50,
    ): Long {
        // 1) ReplacingMergeTree 이지만 동일 (item_a, item_b) 가 누적되면 OPTIMIZE 비용.
        //    매 배치 시 새 데이터 전 일괄 삭제 → 새 row 만 보관.
        truncateAndInsert(windowDays, minCoCount, topPerItem)

        val count = countRows()
        logger.info { "Item-Item PPMI computed: $count rows" }
        return count
    }

    private fun truncateAndInsert(windowDays: Int, minCoCount: Long, topPerItem: Int) {
        // ClickHouse JDBC 0.6.0 PreparedStatement 가 multi-CTE 의 ? parameter 와
        // 호환 안 됨 (silent 0-row). 단순 숫자라 SQL injection 위험 없이 string interpolation.
        val deleteSql = "TRUNCATE TABLE IF EXISTS analytics.item_similarity"
        val insertSql = """
            INSERT INTO analytics.item_similarity (item_a, item_b, similarity, co_count, metric, computed_at)
            WITH
                user_actions AS (
                    SELECT user_id, item_id
                    FROM analytics.recommendation_events
                    WHERE timestamp >= now() - INTERVAL $windowDays DAY
                      AND action_type IN ('click', 'addwish', 'reservation')
                      AND user_id > 0
                    GROUP BY user_id, item_id
                ),
                co_occur AS (
                    -- self-join 으로 cartesian pair 생성. ClickHouse 의 ARRAY JOIN 두 개는
                    -- zip (element-wise) 이라 cartesian 안 됨 — self-join 으로 우회.
                    SELECT a.item_id AS item_a, b.item_id AS item_b, count() AS co_count
                    FROM user_actions AS a
                    INNER JOIN user_actions AS b USING (user_id)
                    WHERE a.item_id != b.item_id
                    GROUP BY a.item_id, b.item_id
                    HAVING co_count >= $minCoCount
                ),
                item_counts AS (
                    SELECT
                        item_id,
                        uniqExact(user_id) AS user_count
                    FROM analytics.recommendation_events
                    WHERE timestamp >= now() - INTERVAL $windowDays DAY
                      AND action_type IN ('click', 'addwish', 'reservation')
                      AND user_id > 0
                    GROUP BY item_id
                ),
                total AS (
                    SELECT uniqExact(user_id) AS total_users
                    FROM analytics.recommendation_events
                    WHERE timestamp >= now() - INTERVAL $windowDays DAY
                      AND action_type IN ('click', 'addwish', 'reservation')
                      AND user_id > 0
                ),
                ppmi AS (
                    SELECT
                        co.item_a,
                        co.item_b,
                        co.co_count,
                        greatest(0,
                            log(
                                (co.co_count / total.total_users) /
                                ((ca.user_count / total.total_users) * (cb.user_count / total.total_users))
                            )
                        ) AS similarity
                    FROM co_occur AS co
                    CROSS JOIN total
                    INNER JOIN item_counts AS ca ON ca.item_id = co.item_a
                    INNER JOIN item_counts AS cb ON cb.item_id = co.item_b
                    WHERE ca.user_count > 0 AND cb.user_count > 0
                ),
                ranked AS (
                    SELECT
                        item_a, item_b, similarity, co_count,
                        row_number() OVER (PARTITION BY item_a ORDER BY similarity DESC, item_b) AS rn
                    FROM ppmi
                    WHERE similarity > 0
                )
            SELECT
                item_a,
                item_b,
                toFloat32(similarity) AS similarity,
                co_count,
                'ppmi' AS metric,
                now() AS computed_at
            FROM ranked
            WHERE rn <= $topPerItem
        """.trimIndent()

        dataSource.connection.use { conn ->
            conn.createStatement().use { stmt ->
                stmt.execute(deleteSql)
                stmt.execute(insertSql)
            }
        }
    }

    private fun countRows(): Long {
        dataSource.connection.use { conn ->
            conn.prepareStatement("SELECT count() FROM analytics.item_similarity").use { ps ->
                val rs = ps.executeQuery()
                return if (rs.next()) rs.getLong(1) else 0L
            }
        }
    }

    /**
     * 특정 item 의 유사 item Top-K 조회 (Redis miss 시 fallback 용).
     */
    fun findSimilarTopK(itemId: Long, limit: Int): List<SimilarItemRow> {
        val sql = """
            SELECT item_b, similarity, co_count
            FROM analytics.item_similarity
            FINAL
            WHERE item_a = ?
            ORDER BY similarity DESC
            LIMIT ?
        """.trimIndent()

        dataSource.connection.use { conn ->
            conn.prepareStatement(sql).use { ps ->
                ps.setLong(1, itemId)
                ps.setInt(2, limit)
                val rs = ps.executeQuery()
                val out = mutableListOf<SimilarItemRow>()
                while (rs.next()) {
                    out += SimilarItemRow(
                        itemId = rs.getLong(1),
                        similarity = rs.getFloat(2).toDouble(),
                        coCount = rs.getLong(3),
                    )
                }
                return out
            }
        }
    }
}

data class SimilarItemRow(val itemId: Long, val similarity: Double, val coCount: Long)
