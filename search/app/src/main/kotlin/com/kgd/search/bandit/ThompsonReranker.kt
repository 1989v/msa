package com.kgd.search.bandit

import com.kgd.search.domain.product.model.ProductDocument
import org.springframework.stereotype.Component

/**
 * 2-stage rerank: Stage 1 = ES function_score, Stage 2 = Thompson Sampling 기반 hybrid.
 *
 * ADR-0050 Phase 3 변경:
 *  - 다중 scope blend 는 [MultiScopeBanditBlender] 에 위임. 본 클래스는 그 결과를
 *    `hybridWeight × esNorm + (1 − hybridWeight) × banditSample` 로 합치는 thin orchestrator.
 *  - default scope 가 category 단일이라 기존 ThompsonReranker 와 행동 동일.
 */
@Component
class ThompsonReranker(
    private val properties: BanditProperties,
    private val blender: MultiScopeBanditBlender
) {
    /**
     * @param scored ES 가 매긴 (document, esScore) 쌍, esScore 내림차순으로 들어오는 것을 가정.
     * @return rerank 적용 후 (document, finalScore) 쌍, finalScore 내림차순.
     */
    fun rerank(scored: List<Pair<ProductDocument, Double>>): List<Pair<ProductDocument, Double>> {
        if (!properties.enabled || scored.isEmpty()) return scored

        val topN = scored.take(properties.topN)
        val rest = scored.drop(properties.topN)

        val docs = topN.map { it.first }
        val banditScores = blender.blend(docs)
        val esNorm = minMaxNormalize(topN.map { it.second })

        val reranked = topN.mapIndexed { idx, (doc, _) ->
            val sample = banditScores[doc.id] ?: 0.5
            val finalScore = properties.hybridWeight * esNorm[idx] +
                (1.0 - properties.hybridWeight) * sample
            doc to finalScore
        }.sortedByDescending { it.second }

        return reranked + rest
    }

    private fun minMaxNormalize(scores: List<Double>): List<Double> {
        if (scores.isEmpty()) return scores
        val min = scores.min()
        val max = scores.max()
        val range = max - min
        return if (range <= 0.0) List(scores.size) { 0.5 } else scores.map { (it - min) / range }
    }
}
