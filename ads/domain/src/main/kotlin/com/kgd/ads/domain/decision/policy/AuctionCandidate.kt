package com.kgd.ads.domain.decision.policy

import com.kgd.ads.domain.campaign.model.Bid
import com.kgd.ads.domain.placement.model.AspectRatio

/** 메모리 자격(상태·기간·예산·빈도·지갑·페이싱)을 통과한 뒤 경매에 오르는 (캠페인, 소재) 하나. */
data class AuctionCandidate(
    val campaignId: Long,
    val creativeId: Long,
    val advertiserId: Long,
    val bid: Bid,
    val aspectRatio: AspectRatio,
    val predictedCtr: Double,
) {
    val ecpmMicros: Double get() = bid.ecpmMicros(predictedCtr)
}

/** 지면 하나의 경매 결과. 유료 낙찰이 없으면 [winner] 가 null. */
data class AuctionAward(val placementKey: String, val winner: AuctionCandidate?)
