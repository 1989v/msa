package com.kgd.quant.infrastructure.discover

import com.kgd.quant.application.discover.MarketRanking
import com.kgd.quant.application.discover.RankingMode
import com.kgd.quant.application.discover.RankingPort
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.context.annotation.Primary
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode

private val log = KotlinLogging.logger {}

/**
 * ClickHouseRankingAdapter — `quant.discover_daily_ranking` VIEW 활용 단일 쿼리 (ADR-0042 정밀화).
 *
 * RankingQuery 의 N+1 자산별 query → ClickHouse 측에서 GROUP BY + window 로 집계 + ORDER BY.
 * displayName/assetClass 등 자산 카탈로그 메타는 별도 join (메모리에서 합성 — 카탈로그 size 작음).
 */
@Component
@Primary
@ConditionalOnBean(name = ["quantClickHouseJdbcTemplate"])
class ClickHouseRankingAdapter(
    @Qualifier("quantClickHouseJdbcTemplate")
    private val jdbc: JdbcTemplate,
) : RankingPort {

    override suspend fun rank(
        mode: RankingMode,
        marketFilter: String?,
        limit: Int,
    ): List<MarketRanking> = withContext(Dispatchers.IO) {
        val orderClause = when (mode) {
            RankingMode.TURNOVER -> "turnover DESC"
            RankingMode.VOLUME -> "volume_total DESC"
            RankingMode.GAINERS -> "change_pct DESC"
            RankingMode.LOSERS -> "change_pct ASC"
        }
        val marketClause = if (marketFilter != null) "AND market_code = ?" else ""
        val sql = """
            WITH latest AS (
                SELECT max(trade_date) AS d FROM quant.discover_daily_ranking
            ),
            prev AS (
                SELECT max(trade_date) AS d FROM quant.discover_daily_ranking
                WHERE trade_date < (SELECT d FROM latest)
            )
            SELECT
                r.asset_code,
                r.asset_class,
                r.market_code,
                r.last_close,
                r.first_close,
                COALESCE(p.last_close, r.first_close) AS prev_close,
                r.turnover,
                r.volume_total,
                CASE
                    WHEN COALESCE(p.last_close, r.first_close) > 0
                        THEN (r.last_close - COALESCE(p.last_close, r.first_close)) / COALESCE(p.last_close, r.first_close)
                    ELSE NULL
                END AS change_pct
            FROM quant.discover_daily_ranking r
            LEFT JOIN quant.discover_daily_ranking p
                ON r.asset_code = p.asset_code
               AND r.market_code = p.market_code
               AND p.trade_date = (SELECT d FROM prev)
            WHERE r.trade_date = (SELECT d FROM latest)
              $marketClause
              ${if (mode == RankingMode.GAINERS || mode == RankingMode.LOSERS) "AND change_pct IS NOT NULL" else ""}
            ORDER BY $orderClause
            LIMIT ?
        """.trimIndent()

        val args: Array<Any> = if (marketFilter != null) {
            arrayOf(marketFilter, limit)
        } else {
            arrayOf(limit)
        }
        runCatching {
            jdbc.query(sql, args) { rs, _ ->
                MarketRanking(
                    asset = rs.getString("asset_code"),
                    market = rs.getString("market_code"),
                    assetClass = rs.getString("asset_class"),
                    displayName = rs.getString("asset_code"), // 카탈로그 join 없이 ticker 표시
                    lastClose = rs.getBigDecimal("last_close") ?: BigDecimal.ZERO,
                    prevClose = rs.getBigDecimal("prev_close"),
                    changePct = rs.getBigDecimal("change_pct")
                        ?.setScale(6, RoundingMode.HALF_UP),
                    turnover = (rs.getBigDecimal("turnover") ?: BigDecimal.ZERO)
                        .setScale(2, RoundingMode.HALF_UP),
                    volume = (rs.getBigDecimal("volume_total") ?: BigDecimal.ZERO)
                        .setScale(2, RoundingMode.HALF_UP),
                )
            }
        }.onFailure {
            log.warn { "ClickHouseRankingAdapter rank failed mode=$mode error=${it.message}" }
        }.getOrElse { emptyList() }
    }

    @Suppress("unused")
    private fun MathContext.useless() = Unit // keep import warnings down
}
