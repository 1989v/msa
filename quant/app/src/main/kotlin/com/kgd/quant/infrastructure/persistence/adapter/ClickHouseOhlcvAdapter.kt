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
        // ClickHouse JDBC 0.7.1 의 PreparedStatement 가 일부 SQL form 에서
        // bad SQL grammar 를 일으킨다 (RankingAdapter 와 동일 회피 — 파라미터를
        // whitelist 검증 후 직접 삽입, FORMAT 절도 제거). 모든 입력은 whitelist 또는
        // ClickHouse literal escape.
        val safeAsset = assetCode.value.takeIf { SAFE_IDENT.matches(it) }
            ?: return@withContext emptyList()
        val safeMarket = marketCode.value.takeIf { SAFE_IDENT.matches(it) }
            ?: return@withContext emptyList()
        val safeInterval = interval.takeIf { SAFE_INTERVAL.matches(it) }
            ?: return@withContext emptyList()
        val fromTs = Timestamp.from(from).toString()
        val toTs = Timestamp.from(to).toString()
        val sql = """
            SELECT ts, open, high, low, close, volume
            FROM quant.ohlcv
            WHERE asset_code = '$safeAsset'
              AND market_code = '$safeMarket'
              AND interval = '$safeInterval'
              AND ts >= toDateTime64('$fromTs', 3)
              AND ts < toDateTime64('$toTs', 3)
            ORDER BY ts ASC
        """.trimIndent()
        try {
            jdbc.query(sql) { rs, _ ->
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

    private companion object {
        private val SAFE_IDENT = Regex("^[A-Za-z0-9._\\-]{1,64}$")
        private val SAFE_INTERVAL = Regex("^[0-9]{1,3}[smhdwMy]$|^1d$|^1h$|^1m$")
    }
}
