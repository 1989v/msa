package com.kgd.place.application.market.service

import com.kgd.place.application.market.port.MarketSavePort
import com.kgd.place.application.market.usecase.IngestMarketUseCase
import com.kgd.place.domain.market.model.*
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify

class MarketIngestServiceTest : BehaviorSpec({
    Given("cluster ingestion with source keys and a building/floor hierarchy") {
        val save = mockk<MarketSavePort>()
        val service = MarketIngestService(save)
        val market = Market("123", "광명시장", MarketType.BUILDING)
        val building = MarketZone(1, MarketZoneKind.BUILDING, "본관", MarketZoneSource.AUTO, sourceKey = "building")
        val floor = MarketZone(1, MarketZoneKind.FLOOR, "2층", MarketZoneSource.AUTO, sourceKey = "floor")
        val store = MarketStore(1, "가게", MarketStoreSource.ONNURI, sourceKey = "merchant", onnuriKey = "merchant", onnuriRaw = "{}")
        every { save.saveMarket(market) } returns market.copy(id = 5)
        every { save.saveZone(match { it.sourceKey == "building" }) } answers { firstArg<MarketZone>().copy(id = 10) }
        every { save.saveZone(match { it.sourceKey == "floor" }) } answers { firstArg<MarketZone>().copy(id = 11) }
        every { save.saveSourceStore(any(), any()) } answers { firstArg() }
        Then("resolves persisted parent/zone IDs instead of trusting ingest-supplied IDs") {
            val command = IngestMarketUseCase.Command(market,
                listOf(IngestMarketUseCase.Zone(building), IngestMarketUseCase.Zone(floor, "building")),
                listOf(IngestMarketUseCase.Store(store, "floor")), listOf("merchant"))
            service.ingest(command).marketId shouldBe 5
            verify { save.saveZone(match { it.sourceKey == "floor" && it.parentId == 10L && it.marketId == 5L }) }
            verify { save.saveSourceStore(match { it.marketId == 5L && it.zoneId == 11L }, setOf("merchant")) }
            verify(exactly = 0) { save.saveOverride(any()) }
        }
    }
    Given("automatic reingest tries to write a manual row") {
        val save = mockk<MarketSavePort>()
        val service = MarketIngestService(save)
        val market = Market("123", "시장", MarketType.STREET)
        val manual = MarketStore(1, "운영자 가게", MarketStoreSource.MANUAL,
            actorKind = MarketActorKind.ADMIN, createdByMemberId = 7)
        Then("rejects before any market, zone, store or override write") {
            shouldThrow<IllegalArgumentException> {
                service.ingest(IngestMarketUseCase.Command(market, emptyList(), listOf(IngestMarketUseCase.Store(manual))))
            }
            verify(exactly = 0) { save.saveMarket(any()) }
            verify(exactly = 0) { save.saveStore(any()) }
            verify(exactly = 0) { save.saveOverride(any()) }
        }
    }
    Given("unknown zone references or invalid parent ordering") {
        val save = mockk<MarketSavePort>()
        val service = MarketIngestService(save)
        val market = Market("123", "시장", MarketType.STREET)
        val zone = MarketZone(1, MarketZoneKind.FLOOR, "층", MarketZoneSource.AUTO, sourceKey = "floor")
        Then("fails before any writes") {
            shouldThrow<IllegalArgumentException> {
                service.ingest(IngestMarketUseCase.Command(market, listOf(IngestMarketUseCase.Zone(zone, "missing")), emptyList()))
            }
            verify(exactly = 0) { save.saveMarket(any()) }
        }
    }
})
