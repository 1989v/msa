package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.kimchi.KimchiPremium
import com.kgd.quant.application.port.persistence.KimchiPremiumTickRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.context.annotation.Primary
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.sql.Timestamp
import java.time.Instant

private val log = KotlinLogging.logger {}

/**
 * ClickHouseKimchiPremiumTickAdapter — `quant.kimchi_premium_tick` read-only 정식 구현 (ADR-0036 + H3).
 *
 * 적재는 별도 ingest path (Phase 2 후속) — 본 어댑터는 read 만 담당.
 * `quantClickHouseJdbcTemplate` 빈이 없는 환경에서는 등록되지 않는다 (NoOp port 부재 시 Spring 이
 * 의존성 주입 실패). 백테스트 호출자(RunSignalBacktestUseCase) 가 ObjectProvider 로 옵션 주입.
 */
@Component
@Primary
@ConditionalOnBean(name = ["quantClickHouseJdbcTemplate"])
class ClickHouseKimchiPremiumTickAdapter(
    @Qualifier("quantClickHouseJdbcTemplate")
    private val jdbc: JdbcTemplate,
) : KimchiPremiumTickRepositoryPort {

    override suspend fun query(
        assetCode: AssetCode,
        krMarketCode: MarketCode,
        foreignMarketCode: MarketCode,
        from: Instant,
        to: Instant,
    ): List<KimchiPremium> = withContext(Dispatchers.IO) {
        val sql = """
            SELECT asset_code, kr_market, foreign_market,
                   ts, krw_price, foreign_usd_price, krw_per_usd, premium_percent
            FROM quant.kimchi_premium_tick
            WHERE asset_code = ?
              AND kr_market = ?
              AND foreign_market = ?
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
                    krMarketCode.value,
                    foreignMarketCode.value,
                    Timestamp.from(from),
                    Timestamp.from(to),
                ),
            ) { rs, _ ->
                KimchiPremium(
                    asset = AssetCode(rs.getString("asset_code")),
                    krMarket = MarketCode(rs.getString("kr_market")),
                    foreignMarket = MarketCode(rs.getString("foreign_market")),
                    krwPrice = rs.getBigDecimal("krw_price") ?: BigDecimal.ZERO,
                    foreignUsdPrice = rs.getBigDecimal("foreign_usd_price") ?: BigDecimal.ZERO,
                    krwPerUsd = rs.getBigDecimal("krw_per_usd") ?: BigDecimal.ZERO,
                    premiumPercent = rs.getBigDecimal("premium_percent") ?: BigDecimal.ZERO,
                    ts = rs.getTimestamp("ts").toInstant(),
                )
            }
        } catch (ex: Exception) {
            log.warn { "ClickHouseKimchiPremiumTickAdapter query failed: ${ex.message}" }
            emptyList()
        }
    }
}
