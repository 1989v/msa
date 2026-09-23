package com.kgd.ads.domain.ledger.policy

/**
 * 청구액 배분. 퍼블리셔 몫 = floor(청구액 × 배분율), 수수료 = 나머지 — 둘의 합은 항상 청구액이다.
 * 배분율은 만분율 정수로 계산해 부동소수 오차가 끼지 않게 한다.
 */
data class RevenueSplit(val chargeMicros: Long, val publisherShareMicros: Long, val networkFeeMicros: Long) {
    init {
        require(chargeMicros >= 0 && publisherShareMicros >= 0 && networkFeeMicros >= 0) { "배분 금액은 음수가 될 수 없습니다" }
        require(publisherShareMicros + networkFeeMicros == chargeMicros) { "배분 합이 청구액과 다릅니다" }
    }

    companion object {
        const val DEFAULT_PUBLISHER_RATE_BASIS_POINTS = 6_800
        private const val BASIS_POINTS = 10_000L

        fun of(chargeMicros: Long, publisherRateBasisPoints: Int = DEFAULT_PUBLISHER_RATE_BASIS_POINTS): RevenueSplit {
            require(publisherRateBasisPoints in 0..BASIS_POINTS) { "배분율은 0~100% 여야 합니다" }
            val share = Math.multiplyExact(chargeMicros, publisherRateBasisPoints.toLong()) / BASIS_POINTS
            return RevenueSplit(chargeMicros, share, chargeMicros - share)
        }
    }
}
