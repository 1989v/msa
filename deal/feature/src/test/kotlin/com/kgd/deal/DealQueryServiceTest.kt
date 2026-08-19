package com.kgd.deal

import com.kgd.deal.application.service.DealQueryService
import com.kgd.deal.domain.model.DisplayStatus
import com.kgd.deal.domain.model.RevenueType
import com.kgd.deal.infrastructure.persistence.entity.DealCategoryJpaEntity
import com.kgd.deal.infrastructure.persistence.entity.DealOfferJpaEntity
import com.kgd.deal.infrastructure.persistence.repository.DealCategoryJpaRepository
import com.kgd.deal.infrastructure.persistence.repository.DealOfferJpaRepository
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.time.LocalDateTime

class DealQueryServiceTest : BehaviorSpec({

    val now = LocalDateTime.of(2026, 8, 19, 12, 0)

    fun category(id: Long, code: String, order: Int) = DealCategoryJpaEntity(
        id = id, code = code, label = code, tagline = null,
        status = DisplayStatus.OPEN, orderNo = order,
    )

    fun offer(categoryId: Long, slug: String, revenueType: RevenueType, network: String?) =
        DealOfferJpaEntity(
            id = null, slug = slug, categoryId = categoryId, merchant = "머천트",
            title = "제목", benefit = "혜택", summary = null,
            targetUrl = "https://example.com/$slug",
            revenueType = revenueType, network = network,
            status = DisplayStatus.OPEN, validFrom = null, validUntil = null, orderNo = 0,
        )

    given("허브 한 화면을 그릴 때") {
        val categoryRepository = mockk<DealCategoryJpaRepository>()
        val offerRepository = mockk<DealOfferJpaRepository>()
        val service = DealQueryService(categoryRepository, offerRepository)

        every { categoryRepository.findAllByStatusOrderByOrderNoAsc(DisplayStatus.OPEN) } returns listOf(
            category(1, "travel", 10),
            category(2, "commerce", 20),
            category(3, "education", 30),
        )
        every { offerRepository.findAllVisible(now) } returns listOf(
            offer(1, "trip-com", RevenueType.AFFILIATE, "TRIP_COM"),
            offer(1, "airport-coupon", RevenueType.PLAIN, null),
            offer(2, "coupang-rocket", RevenueType.AFFILIATE, "COUPANG_PARTNERS"),
        )

        val sections = service.sections(now)

        then("카테고리 순서대로 나온다") {
            sections.map { it.category.code } shouldBe listOf("travel", "commerce", "education")
        }

        then("오퍼가 없는 카테고리도 빈 채로 남는다 — 화면에서 자리를 잡아야 레이아웃이 안 흔들린다") {
            sections[2].offers shouldBe emptyList()
        }

        then("카테고리별 왕복이 아니라 한 번에 읽는다") {
            verify(exactly = 1) { offerRepository.findAllVisible(now) }
        }

        then("제휴 링크에만 고지 플래그가 선다") {
            sections[0].offers.single { it.slug == "trip-com" }.disclosureRequired shouldBe true
            sections[0].offers.single { it.slug == "airport-coupon" }.disclosureRequired shouldBe false
        }
    }

    given("카테고리가 내려가 있으면") {
        val categoryRepository = mockk<DealCategoryJpaRepository>()
        val offerRepository = mockk<DealOfferJpaRepository>()
        val service = DealQueryService(categoryRepository, offerRepository)

        every { categoryRepository.findByCode("travel") } returns DealCategoryJpaEntity(
            id = 1, code = "travel", label = "여행", tagline = null,
            status = DisplayStatus.HOLD, orderNo = 10,
        )

        then("오퍼를 조회조차 하지 않는다") {
            service.offers("travel", now) shouldBe emptyList()
            verify(exactly = 0) { offerRepository.findVisibleByCategory(any(), any()) }
        }
    }
})
