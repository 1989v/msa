package com.kgd.quant.application.discover

import com.kgd.quant.application.port.persistence.AssetCatalogRepositoryPort
import com.kgd.quant.application.port.persistence.OhlcvRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.catalog.AssetClass as CatalogAssetClass
import com.kgd.quant.domain.asset.catalog.AssetSource
import com.kgd.quant.domain.market.MarketCode
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import java.time.Instant

/**
 * RankingQuery — 자산 catalog 의 active 자산을 OHLCV 시계열에서 집계해 ranking.
 *
 * Phase A prototype — N+1 자산별 ohlcv query (작은 카탈로그 가정).
 * 후속: ClickHouse materialized view (`quant.discover_daily_ranking`) 도입.
 */
@Service
class RankingQuery(
    private val catalog: AssetCatalogRepositoryPort,
    private val ohlcvRepo: OhlcvRepositoryPort,
) {
    private val log = KotlinLogging.logger {}

    suspend fun rank(
        mode: RankingMode,
        marketFilter: String? = null,
        limit: Int = 20,
    ): List<MarketRanking> = coroutineScope {
        val assets = catalog.findAll(activeOnly = true)
        val to = Instant.now()
        val from = to.minusSeconds(7L * 24 * 3600) // 최근 1주 (last 2 일 포함되도록)

        val rankings = assets
            .filter { marketFilter == null || marketCodeOf(it.source) == marketFilter }
            .map { item ->
                async {
                    runCatching {
                        val market = marketCodeOf(item.source)
                        val bars = ohlcvRepo.query(
                            AssetCode(item.assetCode),
                            MarketCode(market),
                            "1d",
                            from,
                            to,
                        )
                        if (bars.isEmpty()) return@runCatching null
                        val last = bars.last()
                        val prev = bars.dropLast(1).lastOrNull()
                        val changePct = if (prev != null && prev.close.signum() > 0) {
                            (last.close - prev.close).divide(prev.close, MathContext.DECIMAL64)
                        } else {
                            null
                        }
                        val turnover = bars.fold(BigDecimal.ZERO) { acc, b ->
                            acc + b.volume.multiply(b.close)
                        }
                        val volume = bars.fold(BigDecimal.ZERO) { acc, b -> acc + b.volume }
                        MarketRanking(
                            asset = item.assetCode,
                            market = market,
                            assetClass = item.assetClass.name,
                            displayName = item.displayName,
                            lastClose = last.close,
                            prevClose = prev?.close,
                            changePct = changePct?.setScale(6, RoundingMode.HALF_UP),
                            turnover = turnover.setScale(2, RoundingMode.HALF_UP),
                            volume = volume.setScale(2, RoundingMode.HALF_UP),
                        )
                    }.onFailure {
                        log.debug { "ranking fail asset=${item.assetCode} error=${it.message}" }
                    }.getOrNull()
                }
            }
            .awaitAll()
            .filterNotNull()

        val sorted = when (mode) {
            RankingMode.TURNOVER -> rankings.sortedByDescending { it.turnover }
            RankingMode.VOLUME -> rankings.sortedByDescending { it.volume }
            RankingMode.GAINERS -> rankings
                .filter { it.changePct != null }
                .sortedByDescending { it.changePct!! }
            RankingMode.LOSERS -> rankings
                .filter { it.changePct != null }
                .sortedBy { it.changePct!! }
        }
        return@coroutineScope sorted.take(limit)
    }

    /** AssetSource → quant ohlcv 의 market_code 매핑. */
    private fun marketCodeOf(source: AssetSource): String = when (source) {
        AssetSource.YFINANCE -> "YAHOO"
        AssetSource.FDR -> "FDR_KR"
    }

    @Suppress("unused")
    private fun toAssetClass(c: CatalogAssetClass) = c.name
}
