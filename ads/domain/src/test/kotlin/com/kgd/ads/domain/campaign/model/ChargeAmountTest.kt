package com.kgd.ads.domain.campaign.model

import com.kgd.ads.domain.campaign.exception.InvalidCampaignException
import com.kgd.ads.domain.placement.exception.InvalidPlacementException
import com.kgd.ads.domain.support.AdsDomainFixtures
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.data.forAll
import io.kotest.data.row
import io.kotest.matchers.shouldBe

class ChargeAmountTest : BehaviorSpec({
    given("CPM 입찰의 1회 과금액") {
        `when`("입찰이 999 · 1,000 · 1,001 · 2,999 마이크로면") {
            then("가시 노출 1회당 floor(입찰 / 1000)") {
                forAll(row(999L, 0L), row(1_000L, 1L), row(1_001L, 1L), row(2_999L, 2L)) { bid, charge ->
                    Bid(BidType.CPM, bid).chargeMicros shouldBe charge
                }
            }
        }
    }

    given("CPC 입찰의 1회 과금액") {
        `when`("입찰이 1,234 마이크로면") {
            then("클릭 1회당 입찰가 그대로") { Bid(BidType.CPC, 1_234).chargeMicros shouldBe 1_234 }
        }
    }

    given("지면 최저가 하한") {
        `when`("최저가가 1,000 마이크로 미만이면") {
            then("지면을 저장할 수 없다 — CPM 1회 과금액이 0 이 될 수 있기 때문") {
                shouldThrow<InvalidPlacementException> { AdsDomainFixtures.placement(floorMicros = 999) }
            }
        }
        `when`("최저가가 정확히 1,000 이면") {
            then("저장되고, 그 지면을 노린 CPM 캠페인의 1회 과금액은 1 이상이다") {
                val placement = AdsDomainFixtures.placement(floorMicros = 1_000)
                val campaign = AdsDomainFixtures.paidCampaign(bid = Bid(BidType.CPM, 1_000), placements = listOf(placement))
                requireNotNull(campaign.bid).chargeMicros shouldBe 1
            }
        }
        `when`("CPM 999 로 최저가 1,000 지면을 노리면") {
            then("캠페인을 저장할 수 없다") {
                shouldThrow<InvalidCampaignException> {
                    AdsDomainFixtures.paidCampaign(
                        bid = Bid(BidType.CPM, 999),
                        placements = listOf(AdsDomainFixtures.placement(floorMicros = 1_000)),
                    )
                }
            }
        }
    }
})
