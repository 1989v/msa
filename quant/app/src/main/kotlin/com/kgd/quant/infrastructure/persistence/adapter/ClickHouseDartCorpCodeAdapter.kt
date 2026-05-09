package com.kgd.quant.infrastructure.persistence.adapter

import com.github.benmanes.caffeine.cache.Cache
import com.github.benmanes.caffeine.cache.Caffeine
import com.kgd.quant.application.port.persistence.DartCorpCodePort
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.context.annotation.Primary
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import java.time.Duration
import java.util.Optional

private val log = KotlinLogging.logger {}

/**
 * ClickHouseDartCorpCodeAdapter — `quant.dart_corp_codes` read-only (ADR-0041).
 *
 * Caffeine 캐시 1h (corp_code 매핑 변경 빈도 낮음).
 * Optional 로 negative cache 도 (없는 stock_code 도 캐시).
 */
@Component
@Primary
@ConditionalOnBean(name = ["quantClickHouseJdbcTemplate"])
class ClickHouseDartCorpCodeAdapter(
    @Qualifier("quantClickHouseJdbcTemplate")
    private val jdbc: JdbcTemplate,
) : DartCorpCodePort {

    private val cache: Cache<String, Optional<String>> = Caffeine.newBuilder()
        .expireAfterWrite(Duration.ofHours(1))
        .maximumSize(20_000)
        .build()

    override suspend fun findCorpCode(stockCode: String): String? {
        if (stockCode.isBlank()) return null
        cache.getIfPresent(stockCode)?.let { return it.orElse(null) }
        val resolved = withContext(Dispatchers.IO) {
            runCatching {
                val rows = jdbc.query(
                    """
                    SELECT corp_code FROM quant.dart_corp_codes
                    WHERE stock_code = ?
                    ORDER BY modify_date DESC
                    LIMIT 1
                    """.trimIndent(),
                    arrayOf(stockCode),
                ) { rs, _ -> rs.getString("corp_code") }
                rows.firstOrNull()
            }.onFailure {
                log.warn { "dart corp_code lookup failed stockCode=$stockCode error=${it.message}" }
            }.getOrNull()
        }
        cache.put(stockCode, Optional.ofNullable(resolved))
        return resolved
    }
}
