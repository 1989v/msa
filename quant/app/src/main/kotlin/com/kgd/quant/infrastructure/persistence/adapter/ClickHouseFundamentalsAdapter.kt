package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.port.external.FundamentalsPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.Fundamentals
import com.kgd.quant.domain.market.MarketCode
import com.kgd.quant.infrastructure.external.YahooFundamentalsAdapter
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.context.annotation.Primary
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.sql.ResultSet
import java.time.Instant

private val log = KotlinLogging.logger {}

/**
 * ClickHouseFundamentalsAdapter — V011 `quant.fundamentals` read-only (@Primary).
 *
 * yfinance Ticker.info 일별 ingest 결과를 read. 빈 row 면 null → 호출자
 * (FundamentalsQuery) 가 YahooFundamentalsAdapter (v8 chart meta fallback) 로 위임.
 */
@Component
@Primary
@ConditionalOnBean(name = ["quantClickHouseJdbcTemplate"])
class ClickHouseFundamentalsAdapter(
    @Qualifier("quantClickHouseJdbcTemplate")
    private val jdbc: JdbcTemplate,
    private val yahooFallback: YahooFundamentalsAdapter,
) : FundamentalsPort {

    override suspend fun fetch(asset: AssetCode, market: MarketCode): Fundamentals? {
        val fromClickhouse = withContext(Dispatchers.IO) {
            val safeAsset = asset.value.takeIf { SAFE_IDENT.matches(it) }
                ?: return@withContext null
            val safeMarket = market.value.takeIf { SAFE_IDENT.matches(it) }
                ?: return@withContext null
            val sql = """
                SELECT asset_code, market_code, market_cap, pe_ratio, eps,
                       dividend_yield, beta, weeks52_high, weeks52_low,
                       avg_daily_volume, held_pct_institutions, held_pct_insiders,
                       short_ratio, float_shares, as_of
                FROM quant.fundamentals FINAL
                WHERE asset_code = '$safeAsset'
                  AND market_code = '$safeMarket'
                ORDER BY as_of DESC
                LIMIT 1
            """.trimIndent()
            try {
                jdbc.query(sql) { rs, _ -> mapRow(asset, market, rs) }.firstOrNull()
            } catch (ex: Exception) {
                log.warn { "ClickHouseFundamentalsAdapter fetch failed: ${ex.message}" }
                null
            }
        }
        // ClickHouse miss (ingest 미실행 또는 자산 누락) → Yahoo v8 chart meta fallback.
        return fromClickhouse ?: yahooFallback.fetch(asset, market)
    }

    private fun mapRow(asset: AssetCode, market: MarketCode, rs: ResultSet): Fundamentals {
        return Fundamentals(
            asset = asset,
            market = market,
            marketCap = rs.getNullableBigDecimal("market_cap"),
            peRatio = rs.getNullableBigDecimal("pe_ratio"),
            eps = rs.getNullableBigDecimal("eps"),
            dividendYield = rs.getNullableBigDecimal("dividend_yield"),
            beta = rs.getNullableBigDecimal("beta"),
            weeks52High = rs.getNullableBigDecimal("weeks52_high"),
            weeks52Low = rs.getNullableBigDecimal("weeks52_low"),
            avgDailyVolume = rs.getNullableBigDecimal("avg_daily_volume"),
            heldPctInstitutions = rs.getNullableBigDecimal("held_pct_institutions"),
            heldPctInsiders = rs.getNullableBigDecimal("held_pct_insiders"),
            shortRatio = rs.getNullableBigDecimal("short_ratio"),
            floatShares = rs.getNullableBigDecimal("float_shares"),
            asOf = Instant.now(),
        )
    }

    private fun ResultSet.getNullableBigDecimal(col: String): BigDecimal? {
        val v = this.getObject(col) ?: return null
        return when (v) {
            is BigDecimal -> v
            is Double -> if (v.isFinite()) BigDecimal.valueOf(v) else null
            is Float -> BigDecimal.valueOf(v.toDouble())
            is Number -> BigDecimal(v.toString())
            else -> null
        }
    }

    private companion object {
        private val SAFE_IDENT = Regex("^[A-Za-z0-9._\\-]{1,64}$")
    }
}
