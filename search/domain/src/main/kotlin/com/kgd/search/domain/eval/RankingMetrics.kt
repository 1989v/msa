package com.kgd.search.domain.eval

import kotlin.math.ln
import kotlin.math.pow

/**
 * ADR-0050 Phase 4 — 랭킹 평가 metric.
 *
 * 모두 pure 함수. judgment map 의 value 는 0..relevanceMax 정수 (0 = irrelevant).
 *
 * 참고:
 * - NDCG: Järvelin & Kekäläinen (2002)
 * - MRR : Voorhees (1999), TREC-8
 * - MAP : Manning et al. IR book §8.4
 */
object RankingMetrics {

    /**
     * DCG@k: sum_{i=1..k} (2^rel_i - 1) / log2(i+1)
     * (relevance 가 0 이면 기여 0; 상위에 있을수록 분모가 작아 더 큰 점수)
     */
    fun dcgAtK(results: List<String>, judgments: Map<String, Int>, k: Int): Double {
        require(k > 0) { "k must be > 0" }
        return results.take(k).withIndex().sumOf { (i, id) ->
            val rel = judgments[id] ?: 0
            (2.0.pow(rel) - 1.0) / log2(i + 2.0)  // i 는 0-based, log2(rank+1) where rank=i+1
        }
    }

    /**
     * NDCG@k = DCG@k / IDCG@k. IDCG 는 judgment 의 모든 항목을 최대 정렬했을 때의 DCG.
     * judgment 가 모두 0 이거나 비어있으면 0.
     */
    fun ndcgAtK(results: List<String>, judgments: Map<String, Int>, k: Int): Double {
        if (judgments.isEmpty()) return 0.0
        val dcg = dcgAtK(results, judgments, k)
        val idealOrder = judgments.values.sortedDescending().take(k)
        val idcg = idealOrder.withIndex().sumOf { (i, rel) ->
            (2.0.pow(rel) - 1.0) / log2(i + 2.0)
        }
        return if (idcg <= 0.0) 0.0 else dcg / idcg
    }

    /**
     * MRR = 1 / (rank of first relevant). relevant 는 judgment >= [threshold].
     * 발견 못 하면 0.
     */
    fun mrr(results: List<String>, judgments: Map<String, Int>, threshold: Int = 1): Double {
        require(threshold >= 1) { "threshold must be >= 1" }
        results.forEachIndexed { i, id ->
            if ((judgments[id] ?: 0) >= threshold) return 1.0 / (i + 1)
        }
        return 0.0
    }

    /**
     * Precision@k = (top-k 중 relevant 수) / k. relevant 는 judgment >= [threshold].
     */
    fun precisionAtK(results: List<String>, judgments: Map<String, Int>, k: Int, threshold: Int = 1): Double {
        require(k > 0) { "k must be > 0" }
        val taken = results.take(k)
        if (taken.isEmpty()) return 0.0
        val hits = taken.count { (judgments[it] ?: 0) >= threshold }
        return hits.toDouble() / k
    }

    /**
     * Recall@k = (top-k 중 relevant 수) / (전체 relevant 수). 전체 relevant=0 이면 0.
     */
    fun recallAtK(results: List<String>, judgments: Map<String, Int>, k: Int, threshold: Int = 1): Double {
        require(k > 0) { "k must be > 0" }
        val totalRelevant = judgments.values.count { it >= threshold }
        if (totalRelevant == 0) return 0.0
        val hits = results.take(k).count { (judgments[it] ?: 0) >= threshold }
        return hits.toDouble() / totalRelevant
    }

    /**
     * Average Precision@k:
     *   AP@k = (1/R) × sum_{i=1..k} P@i × rel_i      (R = total relevant)
     * relevant 는 judgment >= [threshold].
     */
    fun apAtK(results: List<String>, judgments: Map<String, Int>, k: Int, threshold: Int = 1): Double {
        require(k > 0) { "k must be > 0" }
        val totalRelevant = judgments.values.count { it >= threshold }
        if (totalRelevant == 0) return 0.0
        var sum = 0.0
        var hits = 0
        results.take(k).forEachIndexed { i, id ->
            val isRel = (judgments[id] ?: 0) >= threshold
            if (isRel) {
                hits += 1
                sum += hits.toDouble() / (i + 1)
            }
        }
        return sum / totalRelevant
    }

    /**
     * MAP@k = 여러 query 의 AP@k 평균.
     */
    fun mapAtK(
        queryResults: List<Pair<List<String>, Map<String, Int>>>,
        k: Int,
        threshold: Int = 1
    ): Double {
        if (queryResults.isEmpty()) return 0.0
        return queryResults.sumOf { (results, judgments) -> apAtK(results, judgments, k, threshold) } /
            queryResults.size
    }

    private fun log2(x: Double): Double = ln(x) / LN_2

    private val LN_2 = ln(2.0)
}
