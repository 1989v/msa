package com.kgd.recommendation.service

/**
 * 산업 표준 행동 가중합 공식.
 *
 * 비율 `reservation:click:addwish:pageview = 100:20:10:1` 은 OTA (Online Travel Agency)
 * funnel 변환률의 역수에서 도출. 도메인이 다르면 비율 재설계 필요.
 *
 * 참고: study/docs/20-recommendation-modeling/05-action-weighting-ctr.md
 */
object ActionWeightedScore {
    const val WEIGHT_RESERVATION: Double = 100.0
    const val WEIGHT_CLICK: Double = 20.0
    const val WEIGHT_ADDWISH: Double = 10.0
    const val WEIGHT_PAGEVIEW: Double = 1.0

    /**
     * 단순 가중합. 노출 신뢰도 보정은 [com.kgd.common.statistics.Wilson] 와 결합해서 사용.
     */
    fun compute(
        reservationCount: Long,
        clickCount: Long,
        addwishCount: Long,
        pageviewCount: Long,
    ): Double {
        require(reservationCount >= 0 && clickCount >= 0 && addwishCount >= 0 && pageviewCount >= 0) {
            "all action counts must be >= 0"
        }
        return reservationCount * WEIGHT_RESERVATION +
            clickCount * WEIGHT_CLICK +
            addwishCount * WEIGHT_ADDWISH +
            pageviewCount * WEIGHT_PAGEVIEW
    }
}
