package com.kgd.quant.application.port.persistence

import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.AssetClass
import com.kgd.quant.domain.market.MarketCode
import java.math.BigDecimal
import java.time.Instant

/**
 * PatternEmbeddingRepositoryPort — pgvector `quant_pattern` 어댑터 추상화 (ADR-0033/0035).
 *
 * - [save]      신규 임베딩 적재 (ingest 또는 백테스트 결과 저장).
 * - [searchTopK] 입력 벡터에 대해 cosine 유사도 top-K — 자산 클래스/시장 필터 옵션.
 *
 * 메인 서비스의 차트 분석 메뉴 + 자동매매 시그널이 공통으로 사용.
 */
interface PatternEmbeddingRepositoryPort {

    suspend fun save(record: EmbeddingRecord): EmbeddingRecord

    suspend fun searchTopK(
        query: DoubleArray,
        k: Int = 20,
        assetClass: AssetClass? = null,
        excludeAsset: AssetCode? = null,
    ): List<SimilarityHit>
}

data class EmbeddingRecord(
    val assetCode: AssetCode,
    val marketCode: MarketCode,
    val assetClass: AssetClass,
    val tsWindowEnd: Instant,
    val embedding: DoubleArray,
    val return5d: BigDecimal? = null,
    val return20d: BigDecimal? = null,
    val return60d: BigDecimal? = null,
)

data class SimilarityHit(
    val assetCode: AssetCode,
    val marketCode: MarketCode,
    val assetClass: AssetClass,
    val tsWindowEnd: Instant,
    /** cosine similarity 0..1 (높을수록 유사). */
    val similarity: Double,
    val return5d: BigDecimal?,
    val return20d: BigDecimal?,
    val return60d: BigDecimal?,
)
