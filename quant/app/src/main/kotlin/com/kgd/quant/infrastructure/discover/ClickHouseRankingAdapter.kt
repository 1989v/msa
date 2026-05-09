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
        krwPerUsd: Double?,
    ): List<MarketRanking> = withContext(Dispatchers.IO) {
        // currency-normalize: KR turnover 를 USD 환산하여 모든 자산 클래스 비교 가능하게.
        // krwPerUsd 미지정/0 이면 raw 단위 그대로 (legacy 동작).
        val safeRate = krwPerUsd?.takeIf { it.isFinite() && it > 0 }
        val turnoverExpr = if (safeRate != null) {
            "if(r.asset_class = 'STOCK_KR', toFloat64(r.turnover) / $safeRate, toFloat64(r.turnover))"
        } else {
            "toFloat64(r.turnover)"
        }
        val volumeExpr = "toFloat64(r.volume_total)"
        val orderClause = when (mode) {
            RankingMode.TURNOVER -> "$turnoverExpr DESC"
            RankingMode.VOLUME -> "$volumeExpr DESC"
            RankingMode.GAINERS -> "change_pct DESC"
            RankingMode.LOSERS -> "change_pct ASC"
        }
        // marketFilter 는 enum 으로 들어와도 신뢰할 수 없는 외부 입력일 수 있으므로 whitelist.
        val safeMarket = marketFilter?.takeIf { ALLOWED_MARKETS.matches(it) }
        val marketClause = if (safeMarket != null) "AND r.market_code = '$safeMarket'" else ""
        val safeLimit = limit.coerceIn(1, 200)
        // ClickHouse JDBC 0.7.1 PreparedStatement 가 CTE 내부 FROM 을 multi-statement 로
        // 잘못 split 하는 버그 회피 — placeholder 미사용, 모든 값을 whitelist 후 직접 삽입.
        // market 별 max(trade_date) 로 KR/US/CRYPTO 시차 보정 (전체 max 로 잠그면 늦은 마감 시장만 노출).
        val sql = """
            WITH latest_per_market AS (
                SELECT market_code, max(trade_date) AS d
                FROM quant.discover_daily_ranking
                GROUP BY market_code
            ),
            prev_per_market AS (
                SELECT r.market_code, max(r.trade_date) AS d
                FROM quant.discover_daily_ranking r
                INNER JOIN latest_per_market l ON l.market_code = r.market_code
                WHERE r.trade_date < l.d
                GROUP BY r.market_code
            )
            SELECT
                r.asset_code AS asset_code,
                r.asset_class AS asset_class,
                r.market_code AS market_code,
                r.last_close AS last_close,
                r.first_close AS first_close,
                COALESCE(p.last_close, r.first_close) AS prev_close,
                r.turnover AS turnover,
                r.volume_total AS volume_total,
                CASE
                    WHEN COALESCE(p.last_close, r.first_close) > 0
                        THEN (r.last_close - COALESCE(p.last_close, r.first_close)) / COALESCE(p.last_close, r.first_close)
                    ELSE NULL
                END AS change_pct
            FROM quant.discover_daily_ranking r
            INNER JOIN latest_per_market l
                ON l.market_code = r.market_code
               AND r.trade_date = l.d
            LEFT JOIN (
                SELECT pr.asset_code, pr.market_code, pr.last_close
                FROM quant.discover_daily_ranking pr
                INNER JOIN prev_per_market pp
                    ON pp.market_code = pr.market_code
                   AND pp.d = pr.trade_date
            ) AS p
                ON p.asset_code = r.asset_code
               AND p.market_code = r.market_code
            WHERE 1 = 1
              $marketClause
              ${if (mode == RankingMode.GAINERS || mode == RankingMode.LOSERS) "AND change_pct IS NOT NULL" else ""}
            ORDER BY $orderClause
            LIMIT $safeLimit
        """.trimIndent()

        runCatching {
            jdbc.query(sql) { rs, _ ->
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

    private companion object {
        private val ALLOWED_MARKETS = Regex("^[A-Z][A-Z0-9_]{0,31}$")
    }
}
