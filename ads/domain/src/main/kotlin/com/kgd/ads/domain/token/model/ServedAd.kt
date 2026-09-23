package com.kgd.ads.domain.token.model

import com.kgd.ads.domain.campaign.model.BidType

/**
 * 결정이 내보낸 광고 한 건 — 토큰이 서명하는 내용. 과금 여부는 결정 시점에 정한다
 * (광고주 본인이 보는 광고는 false — 이벤트 단계는 신원을 보지 않고 토큰만 믿는다).
 */
data class ServedAd(
    val decisionId: String,
    val campaignId: Long,
    val creativeId: Long,
    val advertiserId: Long,
    val placementKey: String,
    val bidType: BidType,
    val chargeMicros: Long,
    val billable: Boolean,
    val visitorHash: String,
)
