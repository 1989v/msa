package com.kgd.quant.application.discover.usecase

import com.kgd.quant.application.asset.catalog.port.AssetCatalogRepositoryPort
import com.kgd.quant.application.discover.MarketRanking
import com.kgd.quant.application.discover.RankingMode
import com.kgd.quant.application.discover.port.RankingPort
import com.kgd.quant.application.marketdata.port.OhlcvRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.AssetClass as CatalogAssetClass
import com.kgd.quant.domain.asset.catalog.AssetSource
import com.kgd.quant.domain.market.MarketCode
import io.github.oshai.kotlinlogging.KotlinLogging
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import java.time.Instant
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

/** 시장 랭킹 조회. */
interface GetMarketRankingUseCase {
    suspend fun rank(
        mode: RankingMode,
        marketFilter: String? = null,
        limit: Int = 20,
    ): List<MarketRanking>
}
