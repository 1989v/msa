package com.kgd.search.bandit

import com.kgd.search.domain.bandit.model.BanditKey
import com.kgd.search.domain.bandit.model.BanditState
import com.kgd.search.domain.bandit.port.BanditStatePort
import com.kgd.search.domain.product.model.ProductDocument
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Instant
import kotlin.math.exp

/**
 * 2-stage rerank: Stage 1 = ES function_score, Stage 2 = Thompson Sampling 기반 hybrid.
 *
 * 입력으로 ES 가 정렬한 후보(scored)를 받아 top-N 만 후처리한다. Beta sampling 결과를
 * `hybridWeight × esNorm + (1 − hybridWeight) × sample` 로 합치고 내림차순 정렬.
 */
@Component
class ThompsonReranker(
    private val properties: BanditProperties,
    private val banditStatePort: BanditStatePort,
    private val clock: Clock = Clock.systemUTC()
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * @param scored ES 가 매긴 (document, esScore) 쌍, esScore 내림차순으로 들어오는 것을 가정.
     * @return rerank 적용 후 (document, finalScore) 쌍, finalScore 내림차순.
     */
    fun rerank(scored: List<Pair<ProductDocument, Double>>): List<Pair<ProductDocument, Double>> {
        if (!properties.enabled || scored.isEmpty()) return scored

        val topN = scored.take(properties.topN)
        val rest = scored.drop(properties.topN)

        val keys = topN.map { BanditKey.of(it.first.categoryId, it.first.id) }
        val states: Map<BanditKey, BanditState> = runCatching { banditStatePort.fetchBatch(keys) }
            .onFailure { log.warn("Bandit state fetch failed, degrading to prior-only: {}", it.message) }
            .getOrDefault(emptyMap())

        val esNorm = minMaxNormalize(topN.map { it.second })
        val now = Instant.now(clock)

        val reranked = topN.mapIndexed { idx, (doc, _) ->
            val key = keys[idx]
            val state = states[key]
            val sample = sampleFor(key, state, now)
            val finalScore = properties.hybridWeight * esNorm[idx] +
                (1.0 - properties.hybridWeight) * sample
            doc to finalScore
        }.sortedByDescending { it.second }

        return reranked + rest
    }

    private fun sampleFor(key: BanditKey, state: BanditState?, now: Instant): Double {
        val (priorA, priorB) = properties.priorFor(key.categoryId)

        if (state == null || state.impressions < properties.impressionThreshold) {
            return BetaSampler.sample(priorA, priorB)
        }

        val decay = if (properties.decayLambdaPerDay > 0.0) {
            exp(-properties.decayLambdaPerDay * state.ageDays(now))
        } else 1.0
        val effClicks = state.clicks * decay
        val effImpressions = state.impressions * decay

        val alpha = effClicks + priorA
        val beta = (effImpressions - effClicks).coerceAtLeast(0.0) + priorB
        return BetaSampler.sample(alpha, beta)
    }

    private fun minMaxNormalize(scores: List<Double>): List<Double> {
        if (scores.isEmpty()) return scores
        val min = scores.min()
        val max = scores.max()
        val range = max - min
        return if (range <= 0.0) List(scores.size) { 0.5 } else scores.map { (it - min) / range }
    }
}
