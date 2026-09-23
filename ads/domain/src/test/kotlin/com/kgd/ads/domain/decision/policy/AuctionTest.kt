package com.kgd.ads.domain.decision.policy

import com.kgd.ads.domain.campaign.model.Bid
import com.kgd.ads.domain.campaign.model.BidType
import com.kgd.ads.domain.support.AdsDomainFixtures
import com.kgd.ads.domain.support.AdsDomainFixtures.SQUARE
import com.kgd.ads.domain.support.AdsDomainFixtures.WIDE
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import java.time.Clock
import java.time.LocalDateTime
import java.time.ZoneId
import kotlin.random.Random

class AuctionTest : BehaviorSpec({
    fun candidate(
        campaignId: Long,
        bid: Bid,
        predictedCtr: Double = PredictedCtr.of(clicks = 0, viewableImpressions = 0),
        creativeId: Long = campaignId * 10,
    ) = AuctionCandidate(
        campaignId = campaignId, creativeId = creativeId, advertiserId = campaignId + 100,
        bid = bid, aspectRatio = WIDE, predictedCtr = predictedCtr,
    )

    val blog = AdsDomainFixtures.placement("blog-post-end")
    val place = AdsDomainFixtures.placement("attraction-end")

    given("순위 eCPM") {
        `when`("CPM 2,500,000 과 CPC 300,000 × pCTR 0.01 이 겨루면") {
            then("CPC 의 eCPM 은 3,000,000 이라 CPC 가 이긴다") {
                val cpm = candidate(1, Bid(BidType.CPM, 2_500_000))
                val cpc = candidate(2, Bid(BidType.CPC, 300_000), predictedCtr = 0.01)
                cpc.ecpmMicros shouldBe (3_000_000.0 plusOrMinus 1e-6)
                Auction.run(listOf(blog), mapOf(blog.key to listOf(cpm, cpc))).single().winner shouldBe cpc
            }
        }
        `when`("같은 CPC 입찰이라도 pCTR 이 0.005 로 낮으면") {
            then("eCPM 1,500,000 이라 CPM 이 이긴다") {
                val cpm = candidate(1, Bid(BidType.CPM, 2_500_000))
                val cpc = candidate(2, Bid(BidType.CPC, 300_000), predictedCtr = 0.005)
                Auction.run(listOf(blog), mapOf(blog.key to listOf(cpc, cpm))).single().winner shouldBe cpm
            }
        }
        `when`("eCPM 이 같으면") {
            then("캠페인 id 오름차순으로 정한다") {
                val later = candidate(9, Bid(BidType.CPM, 200_000))
                val earlier = candidate(3, Bid(BidType.CPM, 200_000))
                Auction.run(listOf(blog), mapOf(blog.key to listOf(later, earlier))).single().winner shouldBe earlier
            }
        }
        `when`("한 캠페인이 두 지면 모두에서 1등이면") {
            then("한 응답에서 두 지면을 이기지 않는다 — 둘째 지면은 다음 후보") {
                val strong = candidate(1, Bid(BidType.CPM, 500_000))
                val weak = candidate(2, Bid(BidType.CPM, 200_000))
                val awards = Auction.run(
                    listOf(blog, place),
                    mapOf(blog.key to listOf(strong, weak), place.key to listOf(strong, weak)),
                )
                awards.map { it.winner?.campaignId } shouldBe listOf(1L, 2L)
            }
        }
    }

    given("지면에서 빠지는 후보") {
        `when`("저장 뒤 지면 최저가가 입찰가보다 높아졌으면") {
            then("그 지면에서 제외") {
                val raised = AdsDomainFixtures.placement("blog-post-end", floorMicros = 300_000)
                Auction.run(listOf(raised), mapOf(raised.key to listOf(candidate(1, Bid(BidType.CPM, 200_000)))))
                    .single().winner.shouldBeNull()
            }
        }
        `when`("CPC 의 eCPM 이 지면 최저가보다 낮으면") {
            then("그 지면에서 제외, 최저가 이상이면 남는다") {
                // 최저가 100,000 — CPC 5,000 × pCTR 0.01 × 1000 = 50,000 은 미달, CPC 10,000 이면 딱 100,000
                val below = candidate(1, Bid(BidType.CPC, 5_000), predictedCtr = 0.01)
                val atFloor = candidate(2, Bid(BidType.CPC, 10_000), predictedCtr = 0.01)
                Auction.run(listOf(blog), mapOf(blog.key to listOf(below))).single().winner.shouldBeNull()
                Auction.run(listOf(blog), mapOf(blog.key to listOf(below, atFloor))).single().winner shouldBe atFloor
            }
        }
        `when`("소재 비율이 지면 형식과 다르면") {
            then("그 지면에서 제외") {
                val square = AdsDomainFixtures.placement("blog-post-end", aspectRatios = setOf(SQUARE))
                Auction.run(listOf(square), mapOf(square.key to listOf(candidate(1, Bid(BidType.CPM, 200_000)))))
                    .single().winner.shouldBeNull()
            }
        }
        `when`("지면이 유료를 받지 않으면") {
            then("후보가 있어도 유료 낙찰 없음") {
                val houseOnly = AdsDomainFixtures.placement("game-list-banner", paidAllowed = false)
                Auction.run(listOf(houseOnly), mapOf(houseOnly.key to listOf(candidate(1, Bid(BidType.CPM, 200_000)))))
                    .single().winner.shouldBeNull()
            }
        }
        `when`("후보가 없으면") {
            then("낙찰 없음") { Auction.run(listOf(blog), emptyMap()).single().winner.shouldBeNull() }
        }
    }

    given("pCTR") {
        `when`("노출·클릭이 0 이면") {
            then("(0+1)/(0+100) = 0.01") { PredictedCtr.of(0, 0) shouldBe (0.01 plusOrMinus 1e-12) }
        }
        `when`("가시 노출 900 · 클릭 9 면") {
            then("(9+1)/(900+100) = 0.01") { PredictedCtr.of(9, 900) shouldBe (0.01 plusOrMinus 1e-12) }
        }
    }

    given("페이싱") {
        val kst = ZoneId.of("Asia/Seoul")
        val noon = Clock.fixed(LocalDateTime.of(2026, 9, 23, 12, 0).atZone(kst).toInstant(), kst)
        val pacing = Pacing(noon)

        `when`("하루의 50% 가 지났고 예산도 50% 이하로 썼으면") {
            then("통과 확률 1") {
                pacing.passProbability(spentTodayMicros = 400, dailyBudgetMicros = 1_000) shouldBe 1.0
                pacing.passes(400, 1_000, Random(1)) shouldBe true
            }
        }
        `when`("하루의 50% 가 지났는데 예산을 80% 썼으면") {
            then("앞선 30%p 만큼 통과 확률을 낮춘다") {
                pacing.passProbability(spentTodayMicros = 800, dailyBudgetMicros = 1_000) shouldBe (0.7 plusOrMinus 1e-9)
            }
        }
        `when`("난수가 통과 확률 이상이면") {
            then("걸러진다") {
                val fixed = object : Random() {
                    override fun nextBits(bitCount: Int): Int = 0
                    override fun nextDouble(): Double = 0.75
                }
                pacing.passes(800, 1_000, fixed) shouldBe false
            }
        }
    }
})
