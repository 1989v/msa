package com.kgd.quant.infrastructure.chart

import com.kgd.quant.application.chart.PriceStreamPort
import com.kgd.quant.application.port.persistence.AssetCatalogRepositoryPort
import com.kgd.quant.application.port.persistence.OhlcvRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.PriceTick
import com.kgd.quant.domain.asset.catalog.AssetSource
import com.kgd.quant.domain.market.MarketCode
import com.kgd.quant.infrastructure.external.YahooLatestPriceAdapter
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.runBlocking
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant
import kotlin.random.Random

/**
 * PricePollingScheduler — TG-13/14.
 *
 * 모드 (config `quant.charts.stream.mode`):
 * - "yahoo" (default): Yahoo v8 chart API 의 regularMarketPrice 폴링 (~15분 지연, 무료 tier)
 * - "stub": ClickHouse 마지막 close ± 0.3% 무작위 흔들기 (offline 검증용)
 * - "off": 폴링 비활성 (테스트용)
 *
 * 30초 주기 — Yahoo 호출 부담 + 무료 tier rate limit 고려.
 * 활성 구독자 있는 자산만 호출.
 */
@Component
class StubPricePollingScheduler(
    private val priceStream: PriceStreamPort,
    private val ohlcvRepo: OhlcvRepositoryPort,
    private val assetCatalog: AssetCatalogRepositoryPort,
    private val yahooLatest: YahooLatestPriceAdapter,
    @Value("\${quant.charts.stream.mode:yahoo}")
    private val mode: String,
) {
    private val log = KotlinLogging.logger {}

    @Scheduled(fixedDelay = 30_000L)
    fun pollAndPublish() {
        if (mode == "off") return
        if (priceStream.totalSubscriberCount() == 0) return

        val now = Instant.now()
        // 자동화: 자산 카탈로그 active 자산만 폴링 (하드코딩 watchlist 제거)
        val targets = runBlocking {
            runCatching {
                assetCatalog.findAll(activeOnly = true).map { item ->
                    item.assetCode to marketCodeOf(item.source)
                }
            }.getOrElse {
                log.debug { "asset catalog fetch failed: ${it.message}" }
                emptyList()
            }
        }
        targets.forEach { (asset, market) ->
            val a = AssetCode(asset)
            val m = MarketCode(market)
            if (priceStream.subscriberCount(a, m) == 0) return@forEach

            runCatching {
                val price = when (mode) {
                    "stub" -> stubPrice(a, m)
                    else -> yahooPrice(a, m) ?: stubPrice(a, m)
                } ?: return@runCatching
                priceStream.publish(
                    PriceTick(
                        asset = a,
                        market = m,
                        price = price,
                        ts = now,
                    ),
                )
            }.onFailure {
                log.debug { "publish fail asset=$asset market=$market mode=$mode error=${it.message}" }
            }
        }
    }

    private fun yahooPrice(asset: AssetCode, market: MarketCode): BigDecimal? = runBlocking {
        runCatching { yahooLatest.latest(asset, market) }.getOrNull()
    }

    private fun stubPrice(asset: AssetCode, market: MarketCode): BigDecimal? {
        val basePrice = lastClose(asset, market) ?: return null
        val noise = Random.nextDouble(-0.003, 0.003)
        val price = basePrice.toDouble() * (1.0 + noise)
        return BigDecimal.valueOf(price).setScale(8, RoundingMode.HALF_UP)
    }

    private fun marketCodeOf(source: AssetSource): String = when (source) {
        AssetSource.YFINANCE -> "YAHOO"
        AssetSource.FDR -> "FDR_KR"
    }

    private fun lastClose(asset: AssetCode, market: MarketCode): BigDecimal? = runBlocking {
        runCatching {
            val to = Instant.now()
            val from = to.minusSeconds(7L * 24 * 3600)
            val bars = ohlcvRepo.query(asset, market, "1d", from, to)
            bars.lastOrNull()?.close
        }.getOrNull()
    }
}
