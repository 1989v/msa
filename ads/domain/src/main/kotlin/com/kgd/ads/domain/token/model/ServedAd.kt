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
) {
    /**
     * 이 종류의 이벤트 한 건이 청구하는 금액. CPM 은 가시 노출에서, CPC 는 클릭에서만 과금한다 —
     * 반대쪽 이벤트는 수만 센다(0).
     */
    fun chargeFor(kind: TokenKind): Long = when {
        kind == TokenKind.IMP && bidType == BidType.CPM -> chargeMicros
        kind == TokenKind.CLK && bidType == BidType.CPC -> chargeMicros
        else -> 0
    }
}
