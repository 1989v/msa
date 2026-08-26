package com.kgd.quant.application.chart.usecase

import com.kgd.quant.application.embedding.PatternEmbedder
import com.kgd.quant.application.embedding.port.PatternEmbeddingRepositoryPort
import com.kgd.quant.application.embedding.port.SimilarityHit
import com.kgd.quant.application.marketdata.port.OhlcvRepositoryPort
import com.kgd.quant.domain.asset.AssetClass
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import java.time.Instant

/** 패턴 임베딩 유사도 검색. */
interface FindSimilarPatternsUseCase {
    suspend fun searchSimilar(
        assetCode: AssetCode,
        marketCode: MarketCode,
        windowEnd: Instant,
        windowDays: Int = 60,
        k: Int = 20,
        assetClass: AssetClass? = null,
    ): List<SimilarityHit>
    suspend fun embedWindow(
        assetCode: AssetCode,
        marketCode: MarketCode,
        windowEnd: Instant,
        windowDays: Int = 60,
    ): EmbedResult

    data class EmbedResult(
        val asset: String,
        val market: String,
        val length: Int,
        val embedding: List<Double>,
    )
}
