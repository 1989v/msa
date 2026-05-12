package com.kgd.common.statistics

import kotlin.math.max
import kotlin.math.sqrt

/**
 * Wilson score confidence interval for binomial proportion.
 *
 * 적은 관측 수의 비율(예: CTR, 별점 평균)을 ranking 에 그대로 쓰면
 * "노출 1번에 click 1번 = 100% CTR" 같은 거짓 점수가 상위로 올라온다.
 * Wilson lower confidence bound 는 관측 수가 적을수록 보수적으로 점수를 하향시킨다.
 *
 * 자세한 배경/수식 유도는 study/docs/20-recommendation-modeling/06-wilson-bayesian-smoothing.md 참고.
 */
object Wilson {

    /**
     * Wilson score lower confidence bound.
     *
     * @param positives 성공 관측 수 (clicks, likes, …)
     * @param total     전체 관측 수 (impressions, votes, …)
     * @param z         정규분포 critical value. 1.96 = 95% 신뢰 (기본),
     *                  2.576 = 99% (더 보수적), 1.645 = 90% (덜 보수적).
     * @return [0.0, 1.0] 범위. total 이 0 이면 0.0.
     */
    fun lowerConfidenceBound(positives: Long, total: Long, z: Double = 1.96): Double {
        if (total <= 0L) return 0.0
        require(positives in 0..total) { "positives($positives) must be within [0, total=$total]" }

        val p = positives.toDouble() / total
        val n = total.toDouble()
        val z2 = z * z

        val numerator = p + z2 / (2 * n) -
            z * sqrt(p * (1 - p) / n + z2 / (4 * n * n))
        val denominator = 1 + z2 / n
        return max(0.0, numerator / denominator)
    }
}
