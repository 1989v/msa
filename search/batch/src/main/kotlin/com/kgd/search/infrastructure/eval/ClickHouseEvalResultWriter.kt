package com.kgd.search.infrastructure.eval

import com.kgd.search.domain.eval.EvalResult
import com.kgd.search.domain.eval.EvalResultPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component
import java.sql.DriverManager
import java.sql.Timestamp

@Component
class ClickHouseEvalResultWriter(
    private val properties: EvalProperties
) : EvalResultPort {

    private val log = KotlinLogging.logger {}

    override fun saveAll(results: List<EvalResult>) {
        if (results.isEmpty()) return
        val sql = """
            INSERT INTO analytics.search_eval_results
                (eval_id, ts, variant, query, ndcg10, mrr, map10,
                 precision_at_5, precision_at_10, result_size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """.trimIndent()

        DriverManager.getConnection(
            properties.clickhouseUrl,
            properties.clickhouseUser,
            properties.clickhousePassword
        ).use { conn ->
            conn.prepareStatement(sql).use { ps ->
                results.forEach { r ->
                    ps.setString(1, r.evalId)
                    ps.setTimestamp(2, Timestamp.from(r.ts))
                    ps.setString(3, r.variant)
                    ps.setString(4, r.query)
                    ps.setDouble(5, r.ndcg10)
                    ps.setDouble(6, r.mrr)
                    ps.setDouble(7, r.map10)
                    ps.setDouble(8, r.precisionAt5)
                    ps.setDouble(9, r.precisionAt10)
                    ps.setInt(10, r.resultSize)
                    ps.addBatch()
                }
                ps.executeBatch()
            }
        }
        log.info { "Persisted eval results: count=${results.size}, variant=${results.first().variant}" }
    }
}
