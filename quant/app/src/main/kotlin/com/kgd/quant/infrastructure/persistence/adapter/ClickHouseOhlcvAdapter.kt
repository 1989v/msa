package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.indicator.IndicatorCalculator
import com.kgd.quant.application.port.persistence.OhlcvRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.context.annotation.Primary
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.sql.Timestamp
import java.time.Instant

private val log = KotlinLogging.logger {}

/**
 * ClickHouseOhlcvAdapter — `quant.ohlcv` read-only 정식 구현 (ADR-0033/0035 Phase 1 후반).
 *
 * Python ingest sidecar 가 INSERT 한 시계열을 메인 서비스가 read 한다 (단방향).
 * `JdbcTemplate` 은 `:quant:app` 의 ClickHouse JDBC 빈을 주입 — `@Qualifier("quantClickHouseJdbcTemplate")`.
 * 빈이 등록되어 있지 않은 환경(Phase 1 초기) 에서는 in-memory stub 이 fallback 으로 살아 있도록 본 어댑터는
 * `ConditionalOnBean` 으로 가드.
 */
@Component
@Primary
@org.springframework.boot.autoconfigure.condition.ConditionalOnBean(name = ["quantClickHouseJdbcTemplate"])
class ClickHouseOhlcvAdapter(
    @Qualifier("quantClickHouseJdbcTemplate")
    private val jdbc: JdbcTemplate,
) : OhlcvRepositoryPort {

    override suspend fun query(
        assetCode: AssetCode,
        marketCode: MarketCode,
        interval: String,
        from: Instant,
        to: Instant,
    ): List<IndicatorCalculator.Bar> = withContext(Dispatchers.IO) {
        val sql = """
            SELECT ts, open, high, low, close, volume
            FROM quant.ohlcv
            WHERE asset_code = ?
              AND market_code = ?
              AND interval = ?
              AND ts >= ?
              AND ts < ?
            ORDER BY ts ASC
            FORMAT TabSeparated
        """.trimIndent()
        try {
            jdbc.query(
                sql,
                arrayOf(
                    assetCode.value,
                    marketCode.value,
                    interval,
                    Timestamp.from(from),
                    Timestamp.from(to),
                ),
            ) { rs, _ ->
                IndicatorCalculator.Bar(
                    ts = rs.getTimestamp("ts").toInstant(),
                    open = rs.getBigDecimal("open") ?: BigDecimal.ZERO,
                    high = rs.getBigDecimal("high") ?: BigDecimal.ZERO,
                    low = rs.getBigDecimal("low") ?: BigDecimal.ZERO,
                    close = rs.getBigDecimal("close") ?: BigDecimal.ZERO,
                    volume = rs.getBigDecimal("volume") ?: BigDecimal.ZERO,
                )
            }
        } catch (ex: Exception) {
            log.warn { "ClickHouseOhlcvAdapter query failed: ${ex.message}" }
            emptyList()
        }
    }
}
