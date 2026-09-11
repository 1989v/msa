package com.kgd.quant.application.embedding

import org.springframework.stereotype.Component
import java.math.BigDecimal
import kotlin.math.ln
import kotlin.math.sqrt

/**
 * PatternEmbedder — 60일 가격 윈도우를 32차원 임베딩 벡터로 변환 (ADR-0033/0035 Phase 1 후반).
 *
 * ## 알고리즘
 * 1. 입력: 60일 종가 [Double] (윈도우 길이는 ANY > 0 — 보간으로 32 차원 맞춤)
 * 2. 로그 수익률 시퀀스 r_i = ln(c_{i+1} / c_i) — N-1 길이
 * 3. 32 등분 chunk 평균 (linear bucket) → 32차원 raw vector
 * 4. L2 정규화 → cosine 검색 호환
 *
 * 본 구현은 Kotlin 자체 — numpy 등가 결과를 의도. 향후 Python charting 측과 골든 테스트로
 * 동등성 검증 (T32 / spec.md §11).
 */
@Component
class PatternEmbedder {

    fun embed(closes: List<Double>): DoubleArray {
        require(closes.size >= 2) { "closes must have at least 2 points" }
        val rs = DoubleArray(closes.size - 1) { i ->
            val a = closes[i]
            val b = closes[i + 1]
            require(a > 0.0 && b > 0.0) { "close must be > 0 (got $a, $b at $i)" }
            ln(b / a)
        }
        val raw = bucketAverages(rs, EMBED_DIM)
        return l2Normalize(raw)
    }

    fun embed(closes: DoubleArray): DoubleArray = embed(closes.toList())

    /** convenience: BigDecimal 입력 (BE 도메인). */
    fun embedBigDecimal(closes: List<BigDecimal>): DoubleArray =
        embed(closes.map { it.toDouble() })

    private fun bucketAverages(values: DoubleArray, buckets: Int): DoubleArray {
        if (values.isEmpty()) return DoubleArray(buckets) { 0.0 }
        val out = DoubleArray(buckets)
        val step = values.size.toDouble() / buckets
        for (i in 0 until buckets) {
            val from = (i * step).toInt()
            val to = ((i + 1) * step).toInt().coerceAtMost(values.size)
            val len = (to - from).coerceAtLeast(1)
            var sum = 0.0
            for (j in from until from + len) sum += values[j.coerceAtMost(values.size - 1)]
            out[i] = sum / len
        }
        return out
    }

    private fun l2Normalize(v: DoubleArray): DoubleArray {
        var norm = 0.0
        for (x in v) norm += x * x
        norm = sqrt(norm)
        if (norm == 0.0) return v
        return DoubleArray(v.size) { v[it] / norm }
    }

    companion object {
        const val EMBED_DIM = 32
    }
}
