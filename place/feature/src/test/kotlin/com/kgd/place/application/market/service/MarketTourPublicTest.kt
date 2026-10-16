package com.kgd.place.application.market.service

import com.kgd.place.application.market.port.*
import com.kgd.place.application.market.usecase.*
import com.kgd.place.domain.market.model.*
import com.kgd.place.presentation.market.dto.MarketResponse
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.*

class MarketTourPublicTest : BehaviorSpec({
    Given("public restaurant projection") {
        Then("attachments on hidden OUT stores are excluded and Tour attribution is exposed") {
            val query = mockk<MarketQueryPort>()
            val save = mockk<MarketSavePort>()
            val tour = mockk<MarketTourMenuPort>()
            val market = Market("c", "시장", MarketType.STREET, latitude = 37.0, longitude = 127.0, id = 1)
            val inStore = MarketStore(1, "IN", MarketStoreSource.MANUAL, id = 1,
                actorKind = MarketActorKind.ADMIN, createdByMemberId = 1, membership = MarketMembership(MarketMembershipStatus.IN))
            val outStore = inStore.copy(id = 2, name = "OUT", membership = MarketMembership(MarketMembershipStatus.OUT))
            val first = MarketTourMenuUseCase.Restaurant(SearchMarketsUseCase.AttractionRef(11, "ko"), "붙은 곳", "국수", null, 37.0, 127.0)
            val second = first.copy(attraction = SearchMarketsUseCase.AttractionRef(12, "ko"), title = "소개 음식점")
            every { query.findMarketByContentId("c") } returns market
            every { query.findStores(1) } returns listOf(inStore, outStore)
            every { query.findOverrides(any()) } returns emptyList()
            every { query.findZones(1) } returns emptyList()
            every { tour.attached(1) } returns mapOf(2L to MarketTourMenuUseCase.Menu("국수", null, first.attraction))
            every { tour.restaurants(any(), any()) } returns listOf(first, second)
            val result = MarketService(query, save, tour = tour).find("c")!!
            result.stores.map { it.source.id } shouldBe listOf(1L)
            result.restaurants.map { it.attraction.id } shouldBe listOf(12L)
            val response = MarketResponse.from(result)
            response.attribution shouldBe listOf("한국관광공사 TourAPI · 공공누리")
            response.restaurants.single().title shouldBe "소개 음식점"
        }
        Then("boundary area is queried in full even beyond the attachment radius") {
            val query = mockk<MarketQueryPort>()
            val save = mockk<MarketSavePort>()
            val geometry = mockk<MarketGeometryQueryPort>()
            val tour = mockk<MarketTourMenuPort>()
            val market = Market("c", "시장", MarketType.STREET, latitude = 37.0, longitude = 127.0, id = 1)
            val polygon = listOf(MarketCoordinate(36.99,126.99), MarketCoordinate(36.99,127.01),
                MarketCoordinate(37.01,127.01), MarketCoordinate(37.01,126.99))
            val restaurant = MarketTourMenuUseCase.Restaurant(SearchMarketsUseCase.AttractionRef(12,"ko"),
                "경계 안", null, null, 37.005, 127.0)
            every { query.findMarketByContentId("c") } returns market
            every { query.findStores(1) } returns emptyList()
            every { query.findOverrides(any()) } returns emptyList()
            every { query.findZones(1) } returns emptyList()
            every { geometry.findPaths(1) } returns emptyList()
            every { geometry.findBoundary(1) } returns MarketBoundary(1, polygon, MarketGeometrySource.MANUAL)
            every { tour.attached(1) } returns emptyMap()
            every { tour.restaurants(MarketCoordinate(36.99,126.99), MarketCoordinate(37.01,127.01)) } returns listOf(restaurant)
            MarketService(query, save, geometry, tour = tour).find("c")!!.restaurants shouldBe listOf(restaurant)
        }
    }
})
