package com.kgd.ads.domain.creative.policy

import com.kgd.ads.domain.campaign.model.Bid
import com.kgd.ads.domain.campaign.model.BidType
import com.kgd.ads.domain.creative.exception.InvalidCreativeException
import com.kgd.ads.domain.placement.model.PlacementFormat
import com.kgd.ads.domain.support.AdsDomainFixtures
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import java.nio.ByteBuffer

class CreativeImageRulesTest : BehaviorSpec({
    /** 헤더만 있는 PNG — 검사는 픽셀을 풀지 않으므로 서명 + IHDR 만으로 판정된다. */
    fun pngHeader(width: Int, height: Int): ByteArray =
        byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A) +
            ByteBuffer.allocate(4 + 4 + 13 + 4).putInt(13).put("IHDR".toByteArray()).putInt(width).putInt(height)
                .put(byteArrayOf(8, 2, 0, 0, 0)).putInt(0).array()

    val dual = AdsDomainFixtures.dualPlacement()
    val bannerCampaign = AdsDomainFixtures.paidCampaign(
        bid = Bid(BidType.CPM, 100_000), placements = listOf(dual), creativeFormat = PlacementFormat.BANNER,
    )
    val cardCampaign = AdsDomainFixtures.paidCampaign(placements = listOf(dual))
    val houseCampaign = AdsDomainFixtures.houseCampaign(setOf(dual.key))

    given("두 형태를 받는 지면의 유료 캠페인") {
        `when`("띠배너 캠페인이 6.4:1(1280×200)을 올리면") {
            then("통과한다") {
                CreativeImageRules.inspect(pngHeader(1280, 200), bannerCampaign, listOf(dual)).width shouldBe 1280
            }
        }
        `when`("띠배너 캠페인이 1.91:1(1200×628)을 올리면") {
            then("거절한다 — 지면의 다른 형태 규격(카드)에 맞아도 캠페인 형태 규격으로만 판정한다") {
                val error = shouldThrow<InvalidCreativeException> {
                    CreativeImageRules.inspect(pngHeader(1200, 628), bannerCampaign, listOf(dual))
                }
                error.message shouldContain "띠배너"
            }
        }
        `when`("카드 캠페인이 6.4:1 을 올리면") {
            then("거절한다") {
                shouldThrow<InvalidCreativeException> { CreativeImageRules.inspect(pngHeader(1280, 200), cardCampaign, listOf(dual)) }
            }
        }
        `when`("6.4:1 에 맞는 20000×3125 헤더 폭탄이면") {
            then("비율은 맞지만 가로·세로 검사가 거절한다") {
                val error = shouldThrow<InvalidCreativeException> {
                    CreativeImageRules.inspect(pngHeader(20_000, 3_125), bannerCampaign, listOf(dual))
                }
                error.message shouldContain "2000px"
            }
        }
    }

    given("HOUSE 캠페인") {
        `when`("지면의 어느 규격에든 맞는 이미지면") {
            then("형태와 무관하게 통과한다") {
                CreativeImageRules.inspect(pngHeader(1200, 628), houseCampaign, listOf(dual)).height shouldBe 628
                CreativeImageRules.inspect(pngHeader(1280, 200), houseCampaign, listOf(dual)).height shouldBe 200
            }
        }
        `when`("어느 규격에도 맞지 않으면") {
            then("거절한다") {
                shouldThrow<InvalidCreativeException> { CreativeImageRules.inspect(pngHeader(1000, 1000), houseCampaign, listOf(dual)) }
            }
        }
    }
})
