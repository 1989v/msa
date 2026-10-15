package com.kgd.place.infrastructure.persistence.market.adapter

import com.kgd.place.application.market.service.MarketEditorService
import com.kgd.place.application.market.service.MarketIngestService
import com.kgd.place.application.market.usecase.*
import com.kgd.place.domain.market.model.*
import com.kgd.place.infrastructure.persistence.market.entity.*
import com.kgd.place.infrastructure.persistence.market.repository.*
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import java.util.Optional

class MarketIngestProtectionTest : BehaviorSpec({
    Given("persisted editorial data and an actual source reingestion through the repository adapter") {
        Then("AC-5 retains pre/post manual-store, manual-zone and override counts and all editorial values") {
            val markets = mockk<MarketJpaRepository>(); val zones = mockk<MarketZoneJpaRepository>()
            val stores = mockk<MarketStoreJpaRepository>(); val overrides = mockk<MarketStoreOverrideJpaRepository>()
            val changes = mockk<MarketChangeLogJpaRepository>(); val stewards = mockk<MarketStewardJpaRepository>()
            val zoneRows = mutableMapOf<Long, MarketZoneJpaEntity>()
            val storeRows = mutableMapOf<Long, MarketStoreJpaEntity>()
            val overrideRows = mutableMapOf<Long, MarketStoreOverrideJpaEntity>()
            var market = Market("123", "시장", MarketType.STREET, id = 1)
            every { markets.findById(1) } answers { Optional.of(MarketJpaEntity.fromDomain(market)) }
            every { markets.lockById(1) } answers { MarketJpaEntity.fromDomain(market) }
            every { markets.findByAttractionContentId("123") } answers { MarketJpaEntity.fromDomain(market) }
            every { markets.save(any()) } answers { firstArg<MarketJpaEntity>().also { market = it.toDomain() } }
            every { zones.findAllByMarketIdOrderBySortOrderAscIdAsc(1) } answers { zoneRows.values.toList() }
            every { zones.findById(any()) } answers { Optional.ofNullable(zoneRows[firstArg<Long>()]) }
            every { zones.findByMarketIdAndSourceAndSourceKey(any(), any(), any()) } answers {
                zoneRows.values.find { it.marketId == firstArg<Long>() && it.source == secondArg<MarketZoneSource>() && it.sourceKey == thirdArg<String>() }
            }
            every { zones.save(any()) } answers {
                val row = firstArg<MarketZoneJpaEntity>().toDomain(); val entity = MarketZoneJpaEntity.fromDomain(row.copy(id = row.id ?: 30L))
                zoneRows[requireNotNull(entity.id)] = entity; entity
            }
            every { stores.findAllByMarketIdOrderByIdAsc(1) } answers { storeRows.values.toList() }
            every { stores.findById(any()) } answers { Optional.ofNullable(storeRows[firstArg<Long>()]) }
            every { stores.findByMarketIdAndSourceAndSourceKey(any(), any(), any()) } answers {
                storeRows.values.find { it.marketId == firstArg<Long>() && it.source == secondArg<MarketStoreSource>() && it.sourceKey == thirdArg<String>() }
            }
            every { stores.save(any()) } answers {
                val row = firstArg<MarketStoreJpaEntity>().toDomain(); val entity = MarketStoreJpaEntity.fromDomain(row.copy(id = row.id ?: 20L))
                storeRows[requireNotNull(entity.id)] = entity; entity
            }
            every { overrides.findAllByStoreIdIn(any()) } answers { overrideRows.values.filter { it.storeId in firstArg<List<Long>>() } }
            every { overrides.deleteAll(any<List<MarketStoreOverrideJpaEntity>>()) } answers {
                firstArg<List<MarketStoreOverrideJpaEntity>>().forEach { overrideRows.remove(it.id) }; Unit
            }
            every { overrides.save(any()) } answers {
                val row = firstArg<MarketStoreOverrideJpaEntity>().toDomain()
                val entity = MarketStoreOverrideJpaEntity.fromDomain(row.copy(id = row.id ?: overrideRows.size + 100L))
                overrideRows[requireNotNull(entity.id)] = entity; entity
            }
            every { changes.save(any()) } answers { firstArg() }
            zoneRows[10] = MarketZoneJpaEntity.fromDomain(MarketZone(1, MarketZoneKind.ROAD, "원천", MarketZoneSource.AUTO, sourceKey = "road", id = 10))
            storeRows[11] = MarketStoreJpaEntity.fromDomain(MarketStore(1, "원천", MarketStoreSource.ONNURI, sourceKey = "o",
                onnuriKey = "o", onnuriRaw = "{}", zoneId = 10, latitude = 37.0, longitude = 127.0, id = 11,
                goodPriceKey = "good", goodPriceRaw = """{"메뉴1":"국수","가격1":"5000"}""",
                goodPriceMatchedBy = "NAME", goodPriceMenuNames = "국수"))
            val adapter = MarketRepositoryAdapter(markets, zones, stores, overrides, changes, stewards, mockk())
            val edit = MarketEditorService(adapter, adapter, adapter); val actor = MarketEditorActor(MarketActorKind.ADMIN, 7)
            val polygon = "POLYGON((127 37,128 37,128 38,127 37))"
            edit.zone(actor, 1, 10, EditMarketUseCase.ZoneRequest("먹거리 골목", MarketZoneKind.ROAD, polygonWkt = polygon, sortOrder = 5))
            edit.zone(actor, 1, null, EditMarketUseCase.ZoneRequest("직접 만든 구역", MarketZoneKind.CUSTOM, polygonWkt = polygon))
            edit.manualStore(actor, 1, null, EditMarketUseCase.ManualStoreRequest("국화빵", zoneId = 30, latitude = 37.1, longitude = 127.1))
            edit.override(actor, 1, 11, EditMarketUseCase.OverrideRequest(mapOf("name" to "운영자 이름", "membership" to "IN", "zoneId" to "30"), reason = "현장 조사"))
            val beforeManual = adapter.findStores(1).filter { it.source == MarketStoreSource.MANUAL }
            val beforeManualZones = adapter.findZones(1).filter { it.source == MarketZoneSource.MANUAL }
            val beforeOverrides = adapter.findOverrides(listOf(11))
            val beforeAutoZone = adapter.findZones(1).find { it.id == 10L }!!
            MarketIngestService(adapter).ingest(IngestMarketUseCase.Command(market.copy(id = null),
                listOf(IngestMarketUseCase.Zone(MarketZone(1, MarketZoneKind.ROAD, "새 원천 구역", MarketZoneSource.AUTO, sourceKey = "road"))),
                listOf(IngestMarketUseCase.Store(MarketStore(1, "새 원천 이름", MarketStoreSource.ONNURI,
                    sourceKey = "o", onnuriKey = "o", onnuriRaw = "{\"version\":2}"), "road")), listOf("o")))
            val afterManual = adapter.findStores(1).filter { it.source == MarketStoreSource.MANUAL }
            val afterManualZones = adapter.findZones(1).filter { it.source == MarketZoneSource.MANUAL }
            val afterOverrides = adapter.findOverrides(listOf(11))
            beforeManual.size shouldBe 1; afterManual.size shouldBe beforeManual.size; afterManual shouldBe beforeManual
            beforeManualZones.size shouldBe 1; afterManualZones.size shouldBe beforeManualZones.size; afterManualZones shouldBe beforeManualZones
            beforeOverrides.size shouldBe 3; afterOverrides.size shouldBe beforeOverrides.size; afterOverrides shouldBe beforeOverrides
            val afterAutoZone = adapter.findZones(1).find { it.id == 10L }!!
            afterAutoZone.name shouldBe beforeAutoZone.name; afterAutoZone.polygonWkt shouldBe polygon; afterAutoZone.sortOrder shouldBe 5
            adapter.findStores(1).find { it.id == 11L }!!.name shouldBe "새 원천 이름"
            val reloaded = adapter.findStores(1).find { it.id == 11L }!!
            reloaded.goodPriceKey shouldBe null
            reloaded.goodPriceRaw shouldBe null
            reloaded.goodPriceMatchedBy shouldBe null
            reloaded.goodPriceMenuNames shouldBe null
            edit.detail(actor, 1).stores.find { it.source.id == 11L }!!.display.name shouldBe "운영자 이름"
        }
    }
})
