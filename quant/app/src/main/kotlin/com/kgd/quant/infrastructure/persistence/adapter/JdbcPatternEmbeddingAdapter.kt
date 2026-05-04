package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.port.persistence.EmbeddingRecord
import com.kgd.quant.application.port.persistence.PatternEmbeddingRepositoryPort
import com.kgd.quant.application.port.persistence.SimilarityHit
import com.kgd.quant.domain.asset.AssetClass
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import java.sql.Timestamp

private val log = KotlinLogging.logger {}

/**
 * JdbcPatternEmbeddingAdapter — `quant_pattern` (pgvector) read/write (ADR-0033/0035).
 *
 * cosine 거리 연산자 `<=>` 는 0(동일) ~ 2(반대). similarity = 1 - cosine_distance.
 *
 * ## 빈 가드
 * `quantPostgresJdbcTemplate` 빈이 등록되어 있을 때만 활성화 — Phase 1 인프라 매니페스트 미완 환경에선
 * 본 어댑터 비활성, 차트 메뉴는 in-memory similarity 만 동작.
 */
@Component
@org.springframework.boot.autoconfigure.condition.ConditionalOnBean(name = ["quantPostgresJdbcTemplate"])
class JdbcPatternEmbeddingAdapter(
    @Qualifier("quantPostgresJdbcTemplate")
    private val jdbc: JdbcTemplate,
) : PatternEmbeddingRepositoryPort {

    override suspend fun save(record: EmbeddingRecord): EmbeddingRecord = withContext(Dispatchers.IO) {
        val sql = """
            INSERT INTO quant_pattern (
                asset_code, market_code, asset_class, ts_window_end, embedding,
                return_5d, return_20d, return_60d
            ) VALUES (?, ?, ?, ?, ?::vector, ?, ?, ?)
        """.trimIndent()
        jdbc.update(
            sql,
            record.assetCode.value,
            record.marketCode.value,
            record.assetClass.name,
            Timestamp.from(record.tsWindowEnd),
            record.embedding.toVectorLiteral(),
            record.return5d,
            record.return20d,
            record.return60d,
        )
        record
    }

    override suspend fun searchTopK(
        query: DoubleArray,
        k: Int,
        assetClass: AssetClass?,
        excludeAsset: AssetCode?,
    ): List<SimilarityHit> = withContext(Dispatchers.IO) {
        val filters = StringBuilder()
        val params = mutableListOf<Any>()
        params += query.toVectorLiteral()                  // for ORDER BY (parameterized as text cast)
        if (assetClass != null) {
            filters.append(" AND asset_class = ?")
            params += assetClass.name
        }
        if (excludeAsset != null) {
            filters.append(" AND asset_code <> ?")
            params += excludeAsset.value
        }
        params += k

        val sql = """
            SELECT asset_code, market_code, asset_class, ts_window_end,
                   1 - (embedding <=> ?::vector) AS similarity,
                   return_5d, return_20d, return_60d
            FROM quant_pattern
            WHERE 1=1$filters
            ORDER BY embedding <=> ?::vector ASC
            LIMIT ?
        """.trimIndent()

        // 위 SQL 은 vector 인자 2회. 첫 번째는 SELECT (similarity), 두 번째는 ORDER BY.
        // params 의 첫 원소를 두 번 사용하기 위해 새 리스트 구성.
        val finalParams = mutableListOf<Any>(query.toVectorLiteral()).apply {
            // SELECT 용
            // filters
            for (i in 1 until params.size - 1) add(params[i])
            // ORDER BY 용 (vector 한 번 더)
            add(query.toVectorLiteral())
            // LIMIT
            add(params.last())
        }

        try {
            jdbc.query(sql, finalParams.toTypedArray()) { rs, _ ->
                SimilarityHit(
                    assetCode = AssetCode(rs.getString("asset_code")),
                    marketCode = MarketCode(rs.getString("market_code")),
                    assetClass = AssetClass.valueOf(rs.getString("asset_class")),
                    tsWindowEnd = rs.getTimestamp("ts_window_end").toInstant(),
                    similarity = rs.getDouble("similarity"),
                    return5d = rs.getBigDecimal("return_5d"),
                    return20d = rs.getBigDecimal("return_20d"),
                    return60d = rs.getBigDecimal("return_60d"),
                )
            }
        } catch (ex: Exception) {
            log.warn { "JdbcPatternEmbeddingAdapter searchTopK failed: ${ex.message}" }
            emptyList()
        }
    }

    private fun DoubleArray.toVectorLiteral(): String =
        joinToString(prefix = "[", postfix = "]") { it.toString() }
}
