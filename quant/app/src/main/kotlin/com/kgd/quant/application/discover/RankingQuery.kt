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
 * RankingQuery — ranking use case + displayName 합성.
 *
 * RankingPort 의 단일 쿼리 결과 (asset/changePct/turnover/...) 에 자산 카탈로그의 displayName 을 join.
 * RankingPort 미가용 (ClickHouse JdbcTemplate 미설정) 시 자체 N+1 fallback.
 */
@Service
class RankingQuery(
    private val catalog: AssetCatalogRepositoryPort,
    private val ohlcvRepo: OhlcvRepositoryPort,
    private val rankingPort: RankingPort? = null,
    private val globalIndices: GlobalIndicesQuery? = null,
) {
    private val log = KotlinLogging.logger {}

    suspend fun rank(
        mode: RankingMode,
        marketFilter: String? = null,
        limit: Int = 20,
    ): List<MarketRanking> {
        // 환율 fetch — KR turnover (KRW) 와 US/CRYPTO turnover (USD) 비교 가능하게 USD 환산.
        // marketFilter 가 단일 시장이면 환산 불필요. fetch 실패 시 null → raw 비교 fallback.
        val krwPerUsd: Double? = if (marketFilter == null && globalIndices != null) {
            runCatching { globalIndices!!.usdKrwRate()?.toDouble() }.getOrNull()
        } else {
            null
        }
        val raw = rankingPort?.let {
            runCatching { it.rank(mode, marketFilter, limit, krwPerUsd) }.getOrElse {
                log.warn { "RankingPort failed, fallback to N+1: ${it.message}" }
                null
            }
        } ?: rankByCatalogScan(mode, marketFilter, limit)
        // displayName 합성 — 카탈로그에서 (asset_code, market) 매핑.
        val nameMap = runCatching {
            catalog.findAll(activeOnly = true).associateBy(
                keySelector = { it.assetCode to marketCodeOf(it.source) },
                valueTransform = { it.displayName },
            )
        }.getOrElse { emptyMap() }
        return raw.map { r ->
            val name = nameMap[r.asset to r.market] ?: r.displayName
            r.copy(displayName = name)
        }
    }

    /** Fallback: 자산 카탈로그 + ohlcv N+1 (ClickHouse 미가용). */
    private suspend fun rankByCatalogScan(
        mode: RankingMode,
        marketFilter: String?,
        limit: Int,
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
    internal fun marketCodeOf(source: AssetSource): String = when (source) {
        AssetSource.YFINANCE -> "YAHOO"
        AssetSource.FDR -> "FDR_KR"
    }

    @Suppress("unused")
    private fun toAssetClass(c: CatalogAssetClass) = c.name
}
