package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.port.persistence.InvestorFlowsPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.InvestorFlow
import com.kgd.quant.domain.market.MarketCode
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.context.annotation.Primary
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import java.sql.Timestamp
import java.time.Instant

private val log = KotlinLogging.logger {}

/**
 * ClickHouseInvestorFlowsAdapter — `quant.investor_flows` read-only (ADR-0040).
 */
@Component
@Primary
@ConditionalOnBean(name = ["quantClickHouseJdbcTemplate"])
class ClickHouseInvestorFlowsAdapter(
    @Qualifier("quantClickHouseJdbcTemplate")
    private val jdbc: JdbcTemplate,
) : InvestorFlowsPort {

    override suspend fun query(
        asset: AssetCode,
        market: MarketCode,
        from: Instant,
        to: Instant,
    ): List<InvestorFlow> = withContext(Dispatchers.IO) {
        // ClickHouse JDBC 0.7.1 PreparedStatement bad SQL grammar 회피 (OhlcvAdapter 동일).
        val safeAsset = asset.value.takeIf { SAFE_IDENT.matches(it) }
            ?: return@withContext emptyList()
        val safeMarket = market.value.takeIf { SAFE_IDENT.matches(it) }
            ?: return@withContext emptyList()
        val fromDate = Timestamp.from(from).toString().substring(0, 10)
        val toDate = Timestamp.from(to).toString().substring(0, 10)
        val sql = """
            SELECT trade_date, individual_net, foreign_net, institution_net
            FROM quant.investor_flows
            WHERE asset_code = '$safeAsset'
              AND market_code = '$safeMarket'
              AND trade_date >= toDate('$fromDate')
              AND trade_date <= toDate('$toDate')
            ORDER BY trade_date ASC
        """.trimIndent()
        try {
            jdbc.query(sql) { rs, _ ->
                InvestorFlow(
                    asset = asset,
                    market = market,
                    tradeDate = rs.getDate("trade_date").toLocalDate(),
                    individualNet = rs.getLong("individual_net"),
                    foreignNet = rs.getLong("foreign_net"),
                    institutionNet = rs.getLong("institution_net"),
                )
            }
        } catch (ex: Exception) {
            log.warn { "ClickHouseInvestorFlowsAdapter query failed: ${ex.message}" }
            emptyList()
        }
    }

    private companion object {
        private val SAFE_IDENT = Regex("^[A-Za-z0-9._\\-]{1,64}$")
    }
}
