package com.kgd.ads.domain.decision.policy

/**
 * 예상 클릭률 = (클릭 + 1) / (가시 노출 + 100). 소재×지면 시간별 집계에서 센다.
 * 노출이 없는 새 소재는 1% 에서 시작하고, 노출이 쌓일수록 실제 비율로 다가간다.
 */
object PredictedCtr {
    private const val PRIOR_CLICKS = 1.0
    private const val PRIOR_IMPRESSIONS = 100.0

    fun of(clicks: Long, viewableImpressions: Long): Double =
        (clicks + PRIOR_CLICKS) / (viewableImpressions + PRIOR_IMPRESSIONS)
}
