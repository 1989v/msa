package com.kgd.quant.infrastructure.ingest

import com.kgd.quant.application.kimchi.KimchiPremium
import com.kgd.quant.application.kimchi.KimchiPremiumCalculator
import com.kgd.quant.domain.asset.Asset
import com.kgd.quant.domain.asset.AssetClass
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.runBlocking
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.sql.Timestamp
import java.time.OffsetDateTime
import java.time.ZoneOffset

private val log = KotlinLogging.logger {}

/**
 * KimchiPremiumTickIngestScheduler — `quant.kimchi_premium_tick` 적재 스케줄러 (I2).
 *
 * KimchiPremiumCalculator 가 산출한 (asset_code, kr_market, foreign_market, ts, premium) 을
 * 5 분 간격으로 ClickHouse 에 INSERT. ReplacingMergeTree 가 동일 키 중복을 자연 해소.
 *
 * 활성 조건:
 * - `quant.kimchi-ingest.enabled=true`
 * - `quantClickHouseJdbcTemplate` 빈 등록됨
 * - 빗썸/바이낸스 MarketAdapter 양쪽 활성 (Calculator 생성자 주입 보장)
 *
 * 대상 자산은 `quant.kimchi-ingest.assets` (기본 BTC/ETH/XRP) 에 대해 BITHUMB↔BINANCE 비교.
 */
@Component
@ConditionalOnProperty(name = ["quant.kimchi-ingest.enabled"], havingValue = "true", matchIfMissing = false)
@ConditionalOnBean(name = ["quantClickHouseJdbcTemplate"])
class KimchiPremiumTickIngestScheduler(
    private val calculator: KimchiPremiumCalculator,
    @Qualifier("quantClickHouseJdbcTemplate")
    private val jdbc: JdbcTemplate,
    @Value("\${quant.kimchi-ingest.assets:BTC,ETH,XRP}")
    private val assetCsv: String,
    @Value("\${quant.kimchi-ingest.kr-market:BITHUMB}")
    private val krMarket: String,
    @Value("\${quant.kimchi-ingest.foreign-market:BINANCE}")
    private val foreignMarket: String,
) {
    private val sql = """
        INSERT INTO quant.kimchi_premium_tick
            (asset_code, kr_market, foreign_market, ts,
             krw_price, foreign_usd_price, krw_per_usd, premium_percent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """.trimIndent()

    /** 5 분 fixedDelay — ReplacingMergeTree 중복 자연 해소 → 빗나간 타이밍 무방. */
    @Scheduled(fixedDelay = INGEST_INTERVAL_MS, initialDelay = 30_000L)
    fun runOnce() {
        val assets = assetCsv.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        if (assets.isEmpty()) return
        val krCode = MarketCode(krMarket)
        val fxCode = MarketCode(foreignMarket)
        var ok = 0
        var fail = 0
        assets.forEach { code ->
            try {
                val premium = runBlocking {
                    calculator.compute(
                        asset = Asset(
                            code = AssetCode(code),
                            assetClass = AssetClass.CRYPTO,
                            displayName = code,
                        ),
                        krMarketCode = krCode,
                        foreignMarketCode = fxCode,
                    )
                }
                insert(premium)
                ok++
            } catch (ex: Exception) {
                fail++
                log.warn { "kimchi-ingest 실패 asset=$code: ${ex.message}" }
            }
        }
        log.info { "kimchi-ingest tick 적재: ok=$ok, fail=$fail (assets=${assets.size})" }
    }

    private fun insert(p: KimchiPremium) {
        jdbc.update(
            sql,
            p.asset.value,
            p.krMarket.value,
            p.foreignMarket.value,
            Timestamp.from(p.ts).let { OffsetDateTime.ofInstant(it.toInstant(), ZoneOffset.UTC) },
            p.krwPrice,
            p.foreignUsdPrice,
            p.krwPerUsd,
            p.premiumPercent,
        )
    }

    companion object {
        private const val INGEST_INTERVAL_MS = 5L * 60L * 1000L  // 5 분
    }
}
