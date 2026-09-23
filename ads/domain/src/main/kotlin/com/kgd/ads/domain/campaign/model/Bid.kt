package com.kgd.ads.domain.campaign.model

/**
 * 입찰. CPM 은 가시 노출 1,000회당 금액, CPC 는 클릭 1회당 금액(마이크로 크레딧).
 */
data class Bid(val type: BidType, val micros: Long) {
    init {
        require(micros > 0) { "입찰가는 0 보다 커야 합니다" }
    }

    /**
     * 1회 과금액. CPM 은 가시 노출 1회당 `floor(입찰 / 1000)`, CPC 는 클릭 1회당 입찰가.
     * CPM 이 0 이 되지 않는 것은 지면 최저가 하한(1,000)이 보장한다.
     */
    val chargeMicros: Long
        get() = when (type) {
            BidType.CPM -> micros / CPM_UNIT
            BidType.CPC -> micros
        }

    /** 순위용 eCPM(마이크로). CPC 는 예상 클릭률로 1,000회 노출 가치로 바꾼다. */
    fun ecpmMicros(predictedCtr: Double): Double = when (type) {
        BidType.CPM -> micros.toDouble()
        BidType.CPC -> micros * predictedCtr * CPM_UNIT
    }

    companion object {
        const val CPM_UNIT = 1_000L
    }
}
