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
        val sql = """
            SELECT trade_date, individual_net, foreign_net, institution_net
            FROM quant.investor_flows
            WHERE asset_code = ?
              AND market_code = ?
              AND trade_date >= toDate(?)
              AND trade_date <= toDate(?)
            ORDER BY trade_date ASC
        """.trimIndent()
        try {
            jdbc.query(
                sql,
                arrayOf(
                    asset.value,
                    market.value,
                    Timestamp.from(from),
                    Timestamp.from(to),
                ),
            ) { rs, _ ->
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
}
