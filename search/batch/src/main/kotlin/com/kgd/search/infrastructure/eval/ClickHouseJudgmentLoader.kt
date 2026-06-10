package com.kgd.search.infrastructure.eval

import com.kgd.search.domain.eval.JudgmentLoadPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component
import java.sql.DriverManager

@Component
class ClickHouseJudgmentLoader(
    private val properties: EvalProperties
) : JudgmentLoadPort {

    private val log = KotlinLogging.logger {}

    /**
     * 같은 (query, product_id) 가 여러 source 로 있을 수 있어 최대 relevance 채택.
     */
    override fun loadAll(): Map<String, Map<String, Int>> {
        val sql = """
            SELECT query, product_id, max(relevance) AS rel
            FROM analytics.search_judgments
            GROUP BY query, product_id
        """.trimIndent()

        val out = HashMap<String, MutableMap<String, Int>>()
        DriverManager.getConnection(
            properties.clickhouseUrl,
            properties.clickhouseUser,
            properties.clickhousePassword
        ).use { conn ->
            conn.createStatement().use { stmt ->
                stmt.executeQuery(sql).use { rs ->
                    while (rs.next()) {
                        val q = rs.getString("query") ?: continue
                        val pid = rs.getString("product_id") ?: continue
                        val rel = rs.getInt("rel")
                        out.getOrPut(q) { HashMap() }[pid] = rel
                    }
                }
            }
        }
        log.info { "Loaded judgments: queries=${out.size}, total_pairs=${out.values.sumOf { it.size }}" }
        return out
    }
}
