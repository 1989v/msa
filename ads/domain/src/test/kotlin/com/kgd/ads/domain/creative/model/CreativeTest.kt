package com.kgd.ads.domain.creative.model

import com.kgd.ads.domain.campaign.model.Bid
import com.kgd.ads.domain.campaign.model.BidType
import com.kgd.ads.domain.campaign.model.Campaign
import com.kgd.ads.domain.campaign.model.CampaignStatus
import com.kgd.ads.domain.creative.exception.InvalidCreativeException
import com.kgd.ads.domain.placement.model.PlacementFormat
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
    fun banner(altText: String = "가을 여행 특가 — 지금 보기") =
        BannerCreativeContent(altText = altText, landingUrl = LandingUrl.of("https://shop.example/autumn"), imageHash = hash)
    fun campaign(format: PlacementFormat = PlacementFormat.CARD) = Campaign.restore(
        id = 5, advertiserId = 1, advertiserKind = AdsDomainFixtures.member().kind, name = "c",
        creativeFormat = format, status = CampaignStatus.ACTIVE,
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
    given("형태별 유료 내용") {
        `when`("띠배너 대체 텍스트가 1~40자면") {
            then("받고, 제목 칸에 대체 텍스트·설명은 빈 문자열로 읽힌다") {
                val content = banner("가".repeat(40))
                content.title shouldBe "가".repeat(40)
                content.body shouldBe ""
                content.format shouldBe PlacementFormat.BANNER
            }
        }
        `when`("대체 텍스트가 비었거나 41자면") {
            then("거부한다") {
                listOf("", "   ", "가".repeat(41)).forEach { shouldThrow<InvalidCreativeException> { banner(it) } }
            }
        }
        `when`("카드 내용의 설명이 비었으면") {
            then("카드 규칙 그대로 거부한다") {
                shouldThrow<InvalidCreativeException> {
                    PaidCreativeContent("제목", "", LandingUrl.of("https://shop.example/a"), hash)
                }
            }
        }
        `when`("캠페인 형태와 다른 종류의 내용을 올리면") {
            then("거부한다 — 띠배너 캠페인에 카드, 카드 캠페인에 띠배너") {
                shouldThrow<InvalidCreativeException> { Creative.submit(campaign(PlacementFormat.BANNER), content()) }
                shouldThrow<InvalidCreativeException> { Creative.submit(campaign(PlacementFormat.CARD), banner()) }
                Creative.submit(campaign(PlacementFormat.BANNER), banner()).content shouldBe banner()
            }
        }
        `when`("카드 소재를 띠배너 내용으로(또는 반대로) 고치면") {
            then("거부한다") {
                val card = Creative.submit(campaign(PlacementFormat.CARD), content())
                shouldThrow<InvalidCreativeException> { card.revise(banner()) }
                val strip = Creative.submit(campaign(PlacementFormat.BANNER), banner())
                shouldThrow<InvalidCreativeException> { strip.revise(content()) }
                strip.revise(banner("고친 대체 텍스트"))
                strip.content.title shouldBe "고친 대체 텍스트"
            }
        }
        `when`("형태 기본값(카드)의 HOUSE 캠페인에 HOUSE 내용을 올리고 고치면") {
            then("형태와 무관하게 된다") {
                val houseCampaign = Campaign.restore(
                    id = 6, advertiserId = 99, advertiserKind = AdsDomainFixtures.house().kind, name = "h",
                    creativeFormat = PlacementFormat.CARD, status = CampaignStatus.ACTIVE, bid = null,
                    dailyBudgetMicros = null, totalBudgetMicros = null, startAt = AdsDomainFixtures.START, endAt = null,
                    frequencyCapPerDay = null, placementKeys = setOf("game-list-banner"), categoryCodes = emptySet(),
                )
                val house = HouseCreativeContent("새 게임", "지금 해 보기", "🎮", HouseLink.of("/games"), null)
                val creative = Creative.createHouse(houseCampaign, house, actorMemberId = 9, at = at)
                creative.revise(house.copy(title = "새 게임 둘"))
                creative.content.title shouldBe "새 게임 둘"
            }
        }
    }
})
