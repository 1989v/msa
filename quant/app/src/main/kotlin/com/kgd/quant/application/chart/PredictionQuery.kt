package com.kgd.quant.application.chart

import com.kgd.quant.application.embedding.PatternEmbedder
import com.kgd.quant.application.port.persistence.OhlcvRepositoryPort
import com.kgd.quant.application.port.persistence.PatternEmbeddingRepositoryPort
import com.kgd.quant.application.port.persistence.SimilarityHit
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import org.springframework.beans.factory.ObjectProvider
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant

/**
 * PredictionQuery — 차트 패턴 유사도 기반 미래 수익률 예측 (ADR-0036 P2-T11).
 *
 * 흐름:
 * 1. 입력 자산의 60일 윈도우 → 32차원 임베딩 (PatternEmbedder)
 * 2. pgvector cosine top-K (PatternEmbeddingRepositoryPort)
 * 3. hits 의 future return (5d/20d/60d) 평균
 *
 * 인프라(pgvector) 미가용 시 빈 결과 반환.
 */
@Component
class PredictionQuery(
    private val ohlcvRepo: OhlcvRepositoryPort,
    private val embedder: PatternEmbedder,
    private val embeddingRepoProvider: ObjectProvider<PatternEmbeddingRepositoryPort>,
) {
    suspend fun predict(
        asset: AssetCode,
        market: MarketCode,
        windowEnd: Instant,
        windowDays: Int = 60,
        k: Int = 50,
    ): Prediction {
        val from = windowEnd.minusSeconds(windowDays.toLong() * 86400)
        val bars = ohlcvRepo.query(asset, market, "1d", from, windowEnd)
        if (bars.size < 2) return EMPTY
        val v = embedder.embed(bars.map { it.close.toDouble() })

        val repo = embeddingRepoProvider.ifAvailable ?: return EMPTY
        val hits = repo.searchTopK(v, k = k, excludeAsset = asset)

        return Prediction(
            sample = hits.size,
            avgReturn5d = hits.avgOrNull { it.return5d },
            avgReturn20d = hits.avgOrNull { it.return20d },
            avgReturn60d = hits.avgOrNull { it.return60d },
            topHits = hits.take(5).map {
                TopHit(
                    asset = it.assetCode.value,
                    market = it.marketCode.value,
                    similarity = it.similarity,
                    return5d = it.return5d,
                    return20d = it.return20d,
                    return60d = it.return60d,
                )
            },
        )
    }

    private fun List<SimilarityHit>.avgOrNull(extractor: (SimilarityHit) -> BigDecimal?): BigDecimal? {
        val values = mapNotNull(extractor)
        if (values.isEmpty()) return null
        val sum = values.reduce { a, b -> a.add(b) }
        return sum.divide(BigDecimal(values.size), 6, RoundingMode.HALF_UP)
    }

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

    companion object {
        private val EMPTY = Prediction(sample = 0, avgReturn5d = null, avgReturn20d = null, avgReturn60d = null, topHits = emptyList())
    }
}
