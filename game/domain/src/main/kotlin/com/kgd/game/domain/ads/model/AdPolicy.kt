package com.kgd.game.domain.ads.model

/** 광고 유형별 frequency cap 의 SSOT — 판정 자체는 Redis TTL 카운터가 수행 (설계 §4.3) */
class AdPolicy private constructor(
    val id: Long? = null,
    val adType: AdType,
    var minIntervalSec: Int,
    var maxPerSession: Int
) {
    companion object {
        fun create(adType: AdType, minIntervalSec: Int, maxPerSession: Int): AdPolicy {
            require(minIntervalSec >= 0) { "minIntervalSec은 음수일 수 없습니다" }
            require(maxPerSession > 0) { "maxPerSession은 1 이상이어야 합니다" }
            return AdPolicy(adType = adType, minIntervalSec = minIntervalSec, maxPerSession = maxPerSession)
        }

        fun restore(id: Long?, adType: AdType, minIntervalSec: Int, maxPerSession: Int): AdPolicy =
            AdPolicy(id, adType, minIntervalSec, maxPerSession)
    }
}
