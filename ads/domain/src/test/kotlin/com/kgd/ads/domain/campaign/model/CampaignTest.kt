package com.kgd.ads.domain.campaign.model

import com.kgd.ads.domain.campaign.exception.InvalidCampaignException
import com.kgd.ads.domain.support.AdsDomainFixtures
import com.kgd.ads.domain.support.AdsDomainFixtures.START
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe

class CampaignTest : BehaviorSpec({
    given("캠페인 상태 전이") {
        `when`("시작 → 일시정지 → 재개 → 종료") {
            then("DRAFT → ACTIVE ⇄ PAUSED → ENDED") {
                val campaign = AdsDomainFixtures.paidCampaign()
                campaign.status shouldBe CampaignStatus.DRAFT
                campaign.start()
                campaign.status shouldBe CampaignStatus.ACTIVE
                campaign.pause()
                campaign.status shouldBe CampaignStatus.PAUSED
                campaign.resume()
                campaign.status shouldBe CampaignStatus.ACTIVE
                campaign.pause()
                campaign.end()
                campaign.status shouldBe CampaignStatus.ENDED
            }
        }
        `when`("종료된 캠페인을 되살리려 하면") {
            then("거부한다") {
                val campaign = AdsDomainFixtures.paidCampaign().apply { start(); end() }
                shouldThrow<InvalidCampaignException> { campaign.resume() }
                shouldThrow<InvalidCampaignException> { campaign.start() }
                shouldThrow<InvalidCampaignException> { campaign.end() }
            }
        }
        `when`("DRAFT 를 일시정지하려 하면") {
            then("거부한다") { shouldThrow<InvalidCampaignException> { AdsDomainFixtures.paidCampaign().pause() } }
        }
    }

    given("기간 밖·예산 소진") {
        `when`("종료 시각이 지났으면") {
            then("상태는 ACTIVE 그대로이고 게재 자격만 없다") {
                val campaign = AdsDomainFixtures.paidCampaign(endAt = START.plusDays(1)).apply { start() }
                campaign.isRunningAt(START.plusHours(3)) shouldBe true
                campaign.isRunningAt(START.plusDays(1)) shouldBe false
                campaign.isRunningAt(START.minusSeconds(1)) shouldBe false
                campaign.status shouldBe CampaignStatus.ACTIVE
            }
        }
        `when`("청구 누계 + 미정산 지출이 일예산에서 1회 과금액을 더 받을 수 없으면") {
            then("예산 여유 없음, 상태 불변") {
                val campaign = AdsDomainFixtures.paidCampaign(bid = Bid(BidType.CPC, 200_000), dailyBudgetMicros = 1_000_000).apply { start() }
                campaign.hasBudgetFor(spentTodayMicros = 800_000, spentTotalMicros = 800_000) shouldBe true
                campaign.hasBudgetFor(spentTodayMicros = 800_001, spentTotalMicros = 800_001) shouldBe false
                campaign.status shouldBe CampaignStatus.ACTIVE
            }
        }
        `when`("총예산 여유가 1회 과금액보다 작으면") {
            then("예산 여유 없음") {
                val campaign = AdsDomainFixtures.paidCampaign(bid = Bid(BidType.CPC, 200_000), totalBudgetMicros = 5_000_000)
                campaign.hasBudgetFor(spentTodayMicros = 0, spentTotalMicros = 4_800_001) shouldBe false
            }
        }
        `when`("이번 시각 지출이 일예산의 25% 에 닿았으면") {
            then("시간당 상한으로 자격 없음") {
                val campaign = AdsDomainFixtures.paidCampaign(dailyBudgetMicros = 10_000_000)
                campaign.hourlyCapMicros shouldBe 2_500_000
                campaign.isUnderHourlyCap(spentThisHourMicros = 2_499_999) shouldBe true
                campaign.isUnderHourlyCap(spentThisHourMicros = 2_500_000) shouldBe false
            }
        }
        `when`("일예산의 25% 가 1회 과금액보다 작으면") {
            then("시간당 상한은 1회 과금액 — 한 번은 게재된다") {
                // 일예산 300,000 의 25% = 75,000 < CPC 1회 과금액 200,000
                val campaign = AdsDomainFixtures.paidCampaign(bid = Bid(BidType.CPC, 200_000), dailyBudgetMicros = 300_000)
                campaign.hourlyCapMicros shouldBe 200_000
                campaign.isUnderHourlyCap(spentThisHourMicros = 0) shouldBe true
                campaign.isUnderHourlyCap(spentThisHourMicros = 200_000) shouldBe false
            }
        }
        `when`("방문자가 오늘 본 횟수가 빈도 제한 3 에 닿으면") {
            then("2 회까지 자격, 3 회부터 없음") {
                val campaign = AdsDomainFixtures.paidCampaign()
                campaign.isUnderFrequencyCap(viewsToday = 2) shouldBe true
                campaign.isUnderFrequencyCap(viewsToday = 3) shouldBe false
            }
        }
    }

    given("문맥 카테고리") {
        `when`("타기팅 카테고리가 비었으면") {
            then("어느 문맥에도 맞는다") {
                AdsDomainFixtures.paidCampaign().matchesCategory("TECH") shouldBe true
                AdsDomainFixtures.paidCampaign().matchesCategory(null) shouldBe true
            }
        }
        `when`("GAME 만 타기팅했으면") {
            then("GAME 문맥에만 맞고 TECH·모름에는 맞지 않는다") {
                val campaign = AdsDomainFixtures.paidCampaign(categoryCodes = setOf("GAME"))
                campaign.matchesCategory("GAME") shouldBe true
                campaign.matchesCategory("TECH") shouldBe false
                campaign.matchesCategory(null) shouldBe false
            }
        }
    }

    given("저장 불변식") {
        `when`("입찰가가 타기팅한 지면 중 하나의 최저가보다 낮으면") {
            then("저장 거부") {
                shouldThrow<InvalidCampaignException> {
                    AdsDomainFixtures.paidCampaign(
                        bid = Bid(BidType.CPM, 150_000),
                        placements = listOf(
                            AdsDomainFixtures.placement("blog-post-end", floorMicros = 100_000),
                            AdsDomainFixtures.placement("attraction-end", floorMicros = 150_001),
                        ),
                    )
                }
            }
        }
        `when`("CPC 입찰가가 지면 최저가보다 작아도") {
            then("저장된다 — 단위가 달라 결정 때 eCPM 으로 비교한다") {
                val campaign = AdsDomainFixtures.paidCampaign(
                    bid = Bid(BidType.CPC, 50_000),
                    placements = listOf(AdsDomainFixtures.placement("blog-post-end", floorMicros = 100_000)),
                )
                campaign.bid shouldBe Bid(BidType.CPC, 50_000)
            }
        }
        `when`("유료를 받지 않는 지면을 타기팅하면") {
            then("저장 거부") {
                shouldThrow<InvalidCampaignException> {
                    AdsDomainFixtures.paidCampaign(
                        placements = listOf(
                            AdsDomainFixtures.placement("blog-post-end"),
                            AdsDomainFixtures.placement("game-list-banner", paidAllowed = false),
                        ),
                    )
                }
            }
        }
        `when`("일예산이 1회 과금액보다 작으면") {
            then("저장 거부") {
                shouldThrow<InvalidCampaignException> {
                    AdsDomainFixtures.paidCampaign(bid = Bid(BidType.CPC, 200_000), dailyBudgetMicros = 199_999)
                }
            }
        }
        `when`("타기팅 지면이 없으면") {
            then("저장 거부") {
                shouldThrow<InvalidCampaignException> { AdsDomainFixtures.paidCampaign(placements = emptyList()) }
            }
        }
    }

    given("우선순위와 HOUSE") {
        `when`("MEMBER 광고주의 캠페인이면") {
            then("PAID, 방문자당 하루 빈도 기본 3") {
                val campaign = AdsDomainFixtures.paidCampaign()
                campaign.priority shouldBe CampaignPriority.PAID
                campaign.frequencyCapPerDay shouldBe 3
            }
        }
        `when`("SYSTEM 광고주가 HOUSE 팩토리로 만들면") {
            then("HOUSE, 입찰·예산·빈도가 없고 예산 판정에서 면제") {
                val campaign = Campaign.draftHouse(
                    advertiser = AdsDomainFixtures.house(), name = "게임 목록 자체 홍보", startAt = START, endAt = null,
                    placementKeys = setOf("game-list-banner"), categoryCodes = emptySet(),
                )
                campaign.priority shouldBe CampaignPriority.HOUSE
                campaign.bid.shouldBeNull()
                campaign.dailyBudgetMicros.shouldBeNull()
                campaign.totalBudgetMicros.shouldBeNull()
                campaign.frequencyCapPerDay.shouldBeNull()
                campaign.hasBudgetFor(Long.MAX_VALUE / 2, Long.MAX_VALUE / 2) shouldBe true
                campaign.hourlyCapMicros.shouldBeNull()
                campaign.isUnderFrequencyCap(Long.MAX_VALUE) shouldBe true
            }
        }
        `when`("MEMBER 광고주가 HOUSE 를 만들려 하면") {
            then("거부한다") {
                shouldThrow<InvalidCampaignException> {
                    Campaign.draftHouse(AdsDomainFixtures.member(), "몰래 HOUSE", START, null, setOf("game-list-banner"), emptySet())
                }
            }
        }
        `when`("SYSTEM 광고주가 유료 캠페인을 만들려 하면") {
            then("거부한다") {
                shouldThrow<InvalidCampaignException> {
                    Campaign.draftPaid(
                        advertiser = AdsDomainFixtures.house(), name = "x", bid = Bid(BidType.CPM, 200_000),
                        dailyBudgetMicros = 10_000_000, totalBudgetMicros = null, startAt = START, endAt = null,
                        placements = listOf(AdsDomainFixtures.placement()), categoryCodes = emptySet(),
                    )
                }
            }
        }
    }
})
