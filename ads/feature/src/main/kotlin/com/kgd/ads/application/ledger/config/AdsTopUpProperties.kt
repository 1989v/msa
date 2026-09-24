package com.kgd.ads.application.ledger.config

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * 셀프 충전 한도(마이크로). 가상 크레딧이라 돈은 아니지만, 한도가 없으면 광고주 하나가 무한 잔액으로
 * 예산 상한까지 모든 지면을 가져간다.
 *
 * @param maxPerCallMicros 1회 충전 상한
 * @param dailyLimitMicros 광고주 지갑당 KST 하루 충전 합계 한도
 */
@ConfigurationProperties(prefix = "ads.top-up")
class AdsTopUpProperties(
    val maxPerCallMicros: Long = 100_000_000,
    val dailyLimitMicros: Long = 500_000_000,
) {
    init {
        require(maxPerCallMicros > 0 && dailyLimitMicros >= maxPerCallMicros) {
            "충전 한도가 올바르지 않습니다: maxPerCall=$maxPerCallMicros daily=$dailyLimitMicros"
        }
    }
}
