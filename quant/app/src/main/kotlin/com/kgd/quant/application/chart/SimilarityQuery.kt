package com.kgd.quant.application.chart

import com.kgd.quant.application.embedding.PatternEmbedder
import com.kgd.quant.application.port.persistence.OhlcvRepositoryPort
import com.kgd.quant.application.port.persistence.PatternEmbeddingRepositoryPort
import com.kgd.quant.application.port.persistence.SimilarityHit
import com.kgd.quant.domain.asset.AssetClass
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import org.springframework.beans.factory.ObjectProvider
import org.springframework.stereotype.Component
import java.time.Instant

/**
 * SimilarityQuery — 차트 패턴 유사도 검색 (ADR-0033 Phase 1 후반).
 *
 * Phase 1 단순화:
 * - OHLCV 60일 윈도우 → embedding (32차원)
 * - 결과: 임베딩 벡터 자체 (실제 검색은 pgvector 통합 후 추가)
 *
 * Phase 2:
 * - quant_pattern 테이블에서 cosine similarity top-K
 * - charting 흡수 후 historical 라이브러리 검색
 */
@Component
class SimilarityQuery(
    private val ohlcvRepo: OhlcvRepositoryPort,
    private val embedder: PatternEmbedder,
    /**
     * pgvector adapter — Phase 1 인프라 미완 환경에선 빈 부재 가능 (ObjectProvider 로 옵셔널 주입).
     */
    private val embeddingRepoProvider: ObjectProvider<PatternEmbeddingRepositoryPort>,
) {

    suspend fun searchSimilar(
        assetCode: AssetCode,
        marketCode: MarketCode,
        windowEnd: Instant,
        windowDays: Int = 60,
        k: Int = 20,
        assetClass: AssetClass? = null,
    ): List<SimilarityHit> {
        val embedded = embedWindow(assetCode, marketCode, windowEnd, windowDays)
        if (embedded.embedding.isEmpty()) return emptyList()
        val repo = embeddingRepoProvider.ifAvailable ?: return emptyList()
        return repo.searchTopK(
            query = embedded.embedding.toDoubleArray(),
            k = k,
            assetClass = assetClass,
            excludeAsset = assetCode,
        )
    }
    suspend fun embedWindow(
        assetCode: AssetCode,
        marketCode: MarketCode,
        windowEnd: Instant,
        windowDays: Int = 60,
    ): EmbedResult {
        val from = windowEnd.minusSeconds(windowDays.toLong() * 86400)
        val bars = ohlcvRepo.query(assetCode, marketCode, "1d", from, windowEnd)
        if (bars.size < 2) return EmbedResult(asset = assetCode.value, market = marketCode.value, length = bars.size, embedding = emptyList())
        val closes = bars.map { it.close.toDouble() }
        val v = embedder.embed(closes)
        return EmbedResult(
            asset = assetCode.value,
            market = marketCode.value,
            length = bars.size,
            embedding = v.toList(),
        )
    }

    data class EmbedResult(
        val asset: String,
        val market: String,
        val length: Int,
        val embedding: List<Double>,
    )
}
