package com.kgd.ads.domain.support

import com.kgd.ads.domain.advertiser.model.Advertiser
import com.kgd.ads.domain.advertiser.model.AdvertiserKind
import com.kgd.ads.domain.advertiser.model.AdvertiserStatus
import com.kgd.ads.domain.campaign.model.Bid
import com.kgd.ads.domain.campaign.model.BidType
import com.kgd.ads.domain.campaign.model.Campaign
import com.kgd.ads.domain.placement.model.AdPlacement
import com.kgd.ads.domain.placement.model.AspectRatio
import com.kgd.ads.domain.placement.model.FormatSpec
import com.kgd.ads.domain.placement.model.PlacementFormat
import java.time.LocalDateTime

object AdsDomainFixtures {
    val WIDE = AspectRatio.of("1.91:1")
    val SQUARE = AspectRatio.of("1:1")
    val STRIP = AspectRatio.of("6.4:1")
    val START: LocalDateTime = LocalDateTime.of(2026, 9, 23, 0, 0)

    fun member(id: Long = 1) = Advertiser.restore(id, AdvertiserKind.MEMBER, 100 + id, "광고주$id", AdvertiserStatus.ACTIVE)

    fun house() = Advertiser.restore(99, AdvertiserKind.SYSTEM, null, "1989v 하우스", AdvertiserStatus.ACTIVE)

    fun card(floorMicros: Long = 100_000, aspectRatios: Set<AspectRatio> = setOf(WIDE)) =
        FormatSpec(PlacementFormat.CARD, aspectRatios, floorMicros)

    fun banner(floorMicros: Long = 50_000) = FormatSpec(PlacementFormat.BANNER, setOf(STRIP), floorMicros)

    /** 형태 규격 기본값은 카드 1.91:1 0.10 하나 — [floorMicros]·[aspectRatios] 는 그 카드 규격의 값이다. */
    fun placement(
        key: String = "blog-post-end",
        floorMicros: Long = 100_000,
        paidAllowed: Boolean = true,
        aspectRatios: Set<AspectRatio> = setOf(WIDE),
        formats: List<FormatSpec> = listOf(card(floorMicros, aspectRatios)),
    ) = AdPlacement.of(
        key = key, host = "blog.1989v.com", formats = formats,
        active = true, paidAllowed = paidAllowed, description = "테스트 지면",
    )

    /** 카드 0.10 + 띠배너 0.05 — 두 형태를 받는 지면(블로그 글 끝·관광지 상세 끝과 같은 모양). */
    fun dualPlacement(key: String = "blog-post-end") = placement(key, formats = listOf(card(), banner()))

    /** 띠배너 전용 지면(게임 목록 위와 같은 모양). */
    fun bannerOnlyPlacement(key: String = "game-list-banner", paidAllowed: Boolean = true) =
        placement(key, paidAllowed = paidAllowed, formats = listOf(banner()))

    fun paidCampaign(
        bid: Bid = Bid(BidType.CPM, 200_000),
        dailyBudgetMicros: Long = 10_000_000,
        totalBudgetMicros: Long? = null,
        placements: List<AdPlacement> = listOf(placement()),
        endAt: LocalDateTime? = null,
        categoryCodes: Set<String> = emptySet(),
        creativeFormat: PlacementFormat = PlacementFormat.CARD,
    ) = Campaign.draftPaid(
        advertiser = member(), name = "가을 캠페인", creativeFormat = creativeFormat, bid = bid, dailyBudgetMicros = dailyBudgetMicros,
        totalBudgetMicros = totalBudgetMicros, startAt = START, endAt = endAt,
        placements = placements, categoryCodes = categoryCodes,
    )

    fun houseCampaign(placementKeys: Set<String> = setOf("game-list-banner")) = Campaign.draftHouse(
        advertiser = house(), name = "게임 목록 자체 홍보", startAt = START, endAt = null,
        placementKeys = placementKeys, categoryCodes = emptySet(),
    )
}
