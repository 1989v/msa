package com.kgd.quant.application.chart.usecase

import com.kgd.quant.application.embedding.PatternEmbedder
import com.kgd.quant.application.embedding.port.PatternEmbeddingRepositoryPort
import com.kgd.quant.application.embedding.port.SimilarityHit
import com.kgd.quant.application.marketdata.port.OhlcvRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant

/** 유사 패턴 기반 가격 예측. */
interface PredictPriceUseCase {
    suspend fun predict(
        asset: AssetCode,
        market: MarketCode,
        windowEnd: Instant,
        windowDays: Int = 60,
        k: Int = 50,
    ): Prediction

    data class Prediction(
        val sample: Int,
        val avgReturn5d: BigDecimal?,
        val avgReturn20d: BigDecimal?,
        val avgReturn60d: BigDecimal?,
        val topHits: List<TopHit>,
    )

    data class TopHit(
        val asset: String,
        val market: String,
        val similarity: Double,
        val return5d: BigDecimal?,
        val return20d: BigDecimal?,
        val return60d: BigDecimal?,
    )
}
