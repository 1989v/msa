package com.kgd.place.application.market.service

import com.kgd.place.application.market.port.*
import com.kgd.place.application.market.usecase.*
import com.kgd.place.domain.market.model.*
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.*

class MarketTourMenuServiceTest : BehaviorSpec({
    val origin = MarketCoordinate(37.0, 127.0)
    fun restaurant(id: Long, metres: Double, title: String = "순희네 빈대떡") =
        MarketTourMenuUseCase.Restaurant(SearchMarketsUseCase.AttractionRef(id, "ko"), title,
            "빈대떡", "육회", origin.latitude + metres / 111320, origin.longitude, "c$id")
    Given("strict normalized name and 50 metre match") {
        Then("NFKC lowercase and whitespace match; closest restaurant wins") {
            MarketTourMenuService.match("ＳＨＯＰ", origin,
                listOf(restaurant(1, 10.0, "shop")))?.attraction?.id shouldBe 1
            MarketTourMenuService.match("순희네빈대떡", origin,
                listOf(restaurant(2, 30.0), restaurant(1, 10.0)))?.attraction?.id shouldBe 1
        }
        Then("restaurants beyond 50 metres do not attach") {
            MarketTourMenuService.match("순희네빈대떡", origin, listOf(restaurant(1, 50.01))) shouldBe null
            MarketTourMenuService.match("순희네빈대떡", origin, listOf(restaurant(1, 49.99)))?.attraction?.id shouldBe 1
        }
        Then("equal distance and different names remain unmatched") {
            MarketTourMenuService.match("순희네빈대떡", origin,
                listOf(restaurant(1, 10.0), restaurant(2, 10.0))) shouldBe null
            MarketTourMenuService.match("다른이름", origin, listOf(restaurant(1, 0.0))) shouldBe null
        }
    }
    Given("attach orchestration") {
        Then("replaces stale derivations and refreshes search even when center is missing") {
            val query = mockk<MarketQueryPort>()
            val editor = mockk<MarketEditorPort>()
            val geometry = mockk<MarketGeometryQueryPort>()
            val tour = mockk<MarketTourMenuPort>(relaxed = true)
            val refresh = mockk<MarketSearchRefreshPort>(relaxed = true)
            every { editor.findMarket(1) } returns Market("c", "시장", MarketType.STREET, id = 1)
            every { query.findStores(1) } returns emptyList()
            every { query.findOverrides(emptyList()) } returns emptyList()
            every { geometry.findBoundary(1) } returns null
            MarketTourMenuService(query, geometry, editor, tour, refresh).attach(1) shouldBe MarketTourMenuUseCase.Summary(1, 0)
            verifyOrder { tour.replace(1, emptyMap()); refresh.refresh(1) }
        }
    }
})
