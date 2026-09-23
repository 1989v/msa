package com.kgd.ads.domain.decision.policy

import com.kgd.ads.domain.placement.model.AdPlacement

/**
 * 한 페이지의 지면들을 요청 순서대로 경매한다.
 *
 * - 순위는 eCPM 내림차순, 동점은 캠페인 id 오름차순(같은 캠페인 안에서는 소재 id 오름차순) — 결과가 입력 순서에 흔들리지 않는다
 * - 한 응답에서 같은 캠페인은 한 지면만 이긴다. 앞 지면에서 이긴 캠페인은 뒤 지면 후보에서 빠진다
 * - 유료를 받지 않는 지면, eCPM 이 지금 최저가보다 낮은 후보(저장 뒤 최저가가 오른 CPM · 예상 클릭률이 낮은 CPC),
 *   비율이 맞지 않는 소재는 그 지면에서 빠진다
 * - 과금은 낙찰 후보 자신의 1회 과금액이다(2등 가격이 아니다)
 */
object Auction {
    private val RANKING = compareByDescending<AuctionCandidate> { it.ecpmMicros }
        .thenBy { it.campaignId }
        .thenBy { it.creativeId }

    fun run(placements: List<AdPlacement>, candidatesByPlacement: Map<String, List<AuctionCandidate>>): List<AuctionAward> {
        val wonCampaigns = mutableSetOf<Long>()
        return placements.map { placement ->
            val winner = if (placement.paidAllowed) {
                candidatesByPlacement[placement.key].orEmpty()
                    .filter { it.campaignId !in wonCampaigns && it.ecpmMicros >= placement.floorMicros && placement.accepts(it.aspectRatio) }
                    .minWithOrNull(RANKING)
            } else {
                null
            }
            winner?.let { wonCampaigns += it.campaignId }
            AuctionAward(placement.key, winner)
        }
    }
}
