package com.kgd.ads.domain.creative.model

import com.kgd.ads.domain.campaign.model.Bid
import com.kgd.ads.domain.campaign.model.BidType
import com.kgd.ads.domain.campaign.model.Campaign
import com.kgd.ads.domain.campaign.model.CampaignStatus
import com.kgd.ads.domain.creative.exception.InvalidCreativeException
import com.kgd.ads.domain.support.AdsDomainFixtures
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import java.time.LocalDateTime

class CreativeTest : BehaviorSpec({
    val at = LocalDateTime.of(2026, 9, 23, 12, 0)
    val hash = "a".repeat(64)
    fun content(title: String = "가을 여행 특가") =
        PaidCreativeContent(title = title, body = "지금 떠나기 좋은 곳", landingUrl = LandingUrl.of("https://shop.example/autumn"), imageHash = hash)
    fun campaign() = Campaign.restore(
        id = 5, advertiserId = 1, advertiserKind = AdsDomainFixtures.member().kind, name = "c",
        status = CampaignStatus.ACTIVE,
        bid = Bid(BidType.CPM, 200_000),
        dailyBudgetMicros = 10_000_000, totalBudgetMicros = null, startAt = AdsDomainFixtures.START, endAt = null,
        frequencyCapPerDay = 3, placementKeys = setOf("blog-post-end"), categoryCodes = emptySet(),
    )

    given("소재 심사") {
        `when`("제출하면") {
            then("PENDING 이고 게재 자격이 없다") {
                val creative = Creative.submit(campaign(), content())
                creative.status shouldBe CreativeStatus.PENDING
                creative.isServable shouldBe false
            }
        }
        `when`("반려하면") {
            then("사유 코드·행위자·시각이 남는다") {
                val creative = Creative.submit(campaign(), content()).apply { reject(CreativeRejectReason.GAMBLING, actorMemberId = 9, at = at) }
                creative.status shouldBe CreativeStatus.REJECTED
                creative.rejectReason shouldBe CreativeRejectReason.GAMBLING
                creative.reviewedBy shouldBe 9
                creative.reviewedAt shouldBe at
            }
        }
        `when`("승인된 소재를 다시 승인하려 하면") {
            then("거부한다 — 심사는 PENDING 에서만") {
                val creative = Creative.submit(campaign(), content()).apply { approve(9, at) }
                shouldThrow<InvalidCreativeException> { creative.approve(9, at) }
            }
        }
    }

    given("revise()") {
        `when`("승인된 소재의 내용을 바꾸면") {
            then("내용 교체와 PENDING 복귀가 함께 일어나 게재 자격을 잃는다") {
                val creative = Creative.submit(campaign(), content()).apply { approve(9, at) }
                creative.isServable shouldBe true
                creative.revise(content(title = "겨울 여행 특가"))
                creative.content.title shouldBe "겨울 여행 특가"
                creative.status shouldBe CreativeStatus.PENDING
                creative.isServable shouldBe false
                creative.reviewedBy.shouldBeNull()
            }
        }
        `when`("보관된 소재를 고치려 하면") {
            then("거부한다") {
                val creative = Creative.submit(campaign(), content()).apply { archive() }
                shouldThrow<InvalidCreativeException> { creative.revise(content()) }
            }
        }
    }

    given("랜딩 URL") {
        `when`("https 이고 userinfo 가 없으면") { then("받는다") { LandingUrl.of("https://shop.example/a?b=1").value shouldBe "https://shop.example/a?b=1" } }
        `when`("http · userinfo · 2049자 · 공백이면") {
            then("거부한다") {
                listOf(
                    "http://shop.example",
                    "https://user@shop.example",
                    "https://user:pw@shop.example/",
                    "https://shop.example/" + "a".repeat(2049 - 21),
                    "https://shop.example/a b",
                    "javascript:alert(1)",
                    "/relative",
                ).forEach { shouldThrow<InvalidCreativeException> { LandingUrl.of(it) } }
            }
        }
    }

    given("HOUSE 링크") {
        `when`("앱 안 경로거나 https 면") {
            then("받는다") {
                HouseLink.of("/games").value shouldBe "/games"
                HouseLink.of("/").value shouldBe "/"
                HouseLink.of("https://blog.1989v.com/posts/a").value shouldBe "https://blog.1989v.com/posts/a"
            }
        }
        `when`("프로토콜 상대 경로·역슬래시·제어 문자·공백·userinfo 면") {
            then("거부한다") {
                listOf(
                    "//evil.example",
                    "/\\evil.example",
                    "/\t/evil.example",
                    "/\n/evil.example",
                    " /games",
                    "https://u@evil.example",
                    "http://evil.example",
                    "games",
                ).forEach { shouldThrow<InvalidCreativeException> { HouseLink.of(it) } }
            }
        }
    }
})
