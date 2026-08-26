package com.kgd.quant.application.chart

import com.kgd.quant.application.chart.usecase.FindSimilarPatternsUseCase
import com.kgd.quant.application.embedding.PatternEmbedder
import com.kgd.quant.application.embedding.port.PatternEmbeddingRepositoryPort
import com.kgd.quant.application.embedding.port.SimilarityHit
import com.kgd.quant.application.marketdata.port.OhlcvRepositoryPort
import com.kgd.quant.domain.asset.AssetClass
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import java.time.Instant
import org.springframework.beans.factory.ObjectProvider
import org.springframework.stereotype.Component

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
) : FindSimilarPatternsUseCase {

    override suspend fun searchSimilar(
        assetCode: AssetCode,
        marketCode: MarketCode,
        windowEnd: Instant,
        windowDays: Int,
        k: Int,
        assetClass: AssetClass?,
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
    override suspend fun embedWindow(
        assetCode: AssetCode,
        marketCode: MarketCode,
        windowEnd: Instant,
        windowDays: Int,
    ): FindSimilarPatternsUseCase.EmbedResult {
        val from = windowEnd.minusSeconds(windowDays.toLong() * 86400)
        val bars = ohlcvRepo.query(assetCode, marketCode, "1d", from, windowEnd)
        if (bars.size < 2) return FindSimilarPatternsUseCase.EmbedResult(asset = assetCode.value, market = marketCode.value, length = bars.size, embedding = emptyList())
        val closes = bars.map { it.close.toDouble() }
        val v = embedder.embed(closes)
        return FindSimilarPatternsUseCase.EmbedResult(
            asset = assetCode.value,
            market = marketCode.value,
            length = bars.size,
            embedding = v.toList(),
        )
    }

}
