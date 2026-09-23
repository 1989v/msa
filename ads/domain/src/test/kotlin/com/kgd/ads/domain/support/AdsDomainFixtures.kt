package com.kgd.ads.domain.support

import com.kgd.ads.domain.advertiser.model.Advertiser
import com.kgd.ads.domain.advertiser.model.AdvertiserKind
import com.kgd.ads.domain.advertiser.model.AdvertiserStatus
import com.kgd.ads.domain.campaign.model.Bid
import com.kgd.ads.domain.campaign.model.BidType
import com.kgd.ads.domain.campaign.model.Campaign
import com.kgd.ads.domain.placement.model.AdPlacement
import com.kgd.ads.domain.placement.model.AspectRatio
import com.kgd.ads.domain.placement.model.PlacementFormat
import java.time.LocalDateTime

object AdsDomainFixtures {
    val WIDE = AspectRatio.of("1.91:1")
    val SQUARE = AspectRatio.of("1:1")
    val START: LocalDateTime = LocalDateTime.of(2026, 9, 23, 0, 0)

    fun member(id: Long = 1) = Advertiser.restore(id, AdvertiserKind.MEMBER, 100 + id, "광고주$id", AdvertiserStatus.ACTIVE)

    fun house() = Advertiser.restore(99, AdvertiserKind.SYSTEM, null, "1989v 하우스", AdvertiserStatus.ACTIVE)

    fun placement(
        key: String = "blog-post-end",
        floorMicros: Long = 100_000,
        paidAllowed: Boolean = true,
        aspectRatios: Set<AspectRatio> = setOf(WIDE),
    ) = AdPlacement.of(
        key = key, host = "blog.1989v.com", format = PlacementFormat.CARD, aspectRatios = aspectRatios,
        floorMicros = floorMicros, active = true, paidAllowed = paidAllowed, description = "테스트 지면",
    )

    fun paidCampaign(
        bid: Bid = Bid(BidType.CPM, 200_000),
        dailyBudgetMicros: Long = 10_000_000,
        totalBudgetMicros: Long? = null,
        placements: List<AdPlacement> = listOf(placement()),
        endAt: LocalDateTime? = null,
        categoryCodes: Set<String> = emptySet(),
    ) = Campaign.draftPaid(
        advertiser = member(), name = "가을 캠페인", bid = bid, dailyBudgetMicros = dailyBudgetMicros,
        totalBudgetMicros = totalBudgetMicros, startAt = START, endAt = endAt,
        placements = placements, categoryCodes = categoryCodes,
    )
}
