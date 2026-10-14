package com.kgd.place.application.market.service

import com.kgd.common.exception.BusinessException
import com.kgd.place.application.market.port.*
import com.kgd.place.application.market.usecase.*
import com.kgd.place.domain.market.model.*
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import org.springframework.transaction.annotation.Transactional

private class EditorFixture {
    val market = Market("123", "시장", MarketType.STREET, id = 1)
    val stores = mutableMapOf<Long, MarketStore>(10L to MarketStore(1, "원천", MarketStoreSource.ONNURI,
        sourceKey = "o", onnuriKey = "o", onnuriRaw = "{}", latitude = 37.0, longitude = 127.0,
        membership = MarketMembership(MarketMembershipStatus.IN), id = 10))
    val zones = mutableMapOf<Long, MarketZone>()
    val overrides = mutableListOf<MarketStoreOverride>()
    val changes = mutableListOf<MarketChangeLog>()
    val query = mockk<MarketQueryPort>()
    val save = mockk<MarketSavePort>()
    val editor = mockk<MarketEditorPort>()
    val actor = MarketEditorActor(MarketActorKind.ADMIN, 7)
    val service = MarketEditorService(query, save, editor)
    init {
        every { editor.findMarket(1) } returns market
        every { editor.lockMarket(1) } returns market
        every { query.findStores(any()) } answers { stores.values.filter { it.marketId == firstArg<Long>() } }
        every { query.findZones(any()) } answers { zones.values.filter { it.marketId == firstArg<Long>() } }
        every { query.findOverrides(any()) } answers { overrides.filter { it.storeId in firstArg<List<Long>>() } }
        every { save.saveStore(any()) } answers {
            val row = firstArg<MarketStore>(); val result = row.copy(id = row.id ?: 20L)
            stores[requireNotNull(result.id)] = result; result
        }
        every { editor.saveEditedZone(any()) } answers {
            val row = firstArg<MarketZone>(); val result = row.copy(id = row.id ?: 30L)
            zones[requireNotNull(result.id)] = result; result
        }
        every { editor.deleteManualStore(any()) } answers { stores.remove(firstArg<Long>()); Unit }
        every { editor.deleteZone(any()) } answers { zones.remove(firstArg<Long>()); Unit }
        every { editor.replaceOverrides(any(), any()) } answers {
            val id = firstArg<MarketStore>().id
            overrides.removeAll { it.storeId == id }
            overrides.addAll(secondArg<List<MarketStoreOverride>>().mapIndexed { i, row -> row.copy(id = row.id ?: (100L + i)) }); Unit
        }
        every { save.appendChange(any()) } answers {
            firstArg<MarketChangeLog>().copy(id = changes.size + 1L).also { changes.add(it) }
        }
        every { editor.findChange(any()) } answers { changes.find { it.id == firstArg<Long>() } }
    }
    fun manual(name: String = "수동") = EditMarketUseCase.ManualStoreRequest(name, latitude = 37.1, longitude = 127.1)
}

class MarketEditorServiceTest : BehaviorSpec({
    Given("field whitelist and audit evidence") {
        Then("rejects unsupported fields, blank reasons and incomplete coordinate pairs without writes") {
            val f = EditorFixture()
            listOf(EditMarketUseCase.OverrideRequest(mapOf("pinKind" to "EXACT"), reason = "확인"),
                EditMarketUseCase.OverrideRequest(mapOf("name" to "수정"), reason = " "),
                EditMarketUseCase.OverrideRequest(mapOf("latitude" to "37"), reason = "확인"),
                EditMarketUseCase.OverrideRequest(clear = setOf("longitude"), reason = "확인")).forEach {
                shouldThrow<IllegalArgumentException> { f.service.override(f.actor, 1, 10, it) }
            }
            f.changes.size shouldBe 0
            verify(exactly = 0) { f.editor.replaceOverrides(any(), any()) }
        }
        Then("sets and clears paired coordinates with reason and source preservation, and reverts clear") {
            val f = EditorFixture(); val source = f.stores[10L]
            f.service.override(f.actor, 1, 10, EditMarketUseCase.OverrideRequest(mapOf("latitude" to "37.2", "longitude" to "127.2"), reason = "현장 확인"))
            f.overrides.size shouldBe 2
            f.service.override(f.actor, 1, 10, EditMarketUseCase.OverrideRequest(clear = setOf("latitude", "longitude"), reason = "원천 복원"))
            f.overrides.size shouldBe 0
            f.changes.last().afterRaw!!.contains("원천 복원") shouldBe true
            f.service.revert(f.actor, 1, 2)
            f.overrides.size shouldBe 2
            f.stores[10L] shouldBe source
            f.changes.last().action shouldBe MarketChangeAction.REVERT
            f.changes.all { it.memberId == 7L && it.actorKind == MarketActorKind.ADMIN } shouldBe true
        }
        Then("rejects cross-market store and zone IDs") {
            val f = EditorFixture()
            shouldThrow<IllegalArgumentException> { f.service.override(f.actor, 1, 999, EditMarketUseCase.OverrideRequest(mapOf("name" to "x"), reason = "확인")) }
            shouldThrow<IllegalArgumentException> { f.service.override(f.actor, 1, 10, EditMarketUseCase.OverrideRequest(mapOf("zoneId" to "999"), reason = "확인")) }
        }
    }
    Given("manual lifecycle and references") {
        Then("adds updates deletes and restores original ID/provenance from delete history") {
            val f = EditorFixture()
            f.service.manualStore(f.actor, 1, null, f.manual())
            f.service.manualStore(f.actor, 1, 20, f.manual("수정"))
            val edited = f.stores[20L]
            f.service.deleteStore(f.actor, 1, 20)
            f.stores.containsKey(20L) shouldBe false
            f.service.revert(f.actor, 1, 3)
            f.stores[20L] shouldBe edited
            f.service.revert(f.actor, 1, 4)
            f.stores.containsKey(20L) shouldBe false
        }
        Then("rejects mutation of both upstream sources") {
            val f = EditorFixture()
            f.stores[11L] = MarketStore(1, "상가", MarketStoreSource.SANGGA, sourceKey = "s", sanggaKey = "s", sanggaRaw = "{}", id = 11)
            listOf(10L, 11L).forEach {
                shouldThrow<IllegalArgumentException> { f.service.manualStore(f.actor, 1, it, f.manual()) }
                shouldThrow<IllegalArgumentException> { f.service.deleteStore(f.actor, 1, it) }
            }
            f.changes.size shouldBe 0
        }
        Then("reference requires same-market exact visible store, relative position and memo") {
            val f = EditorFixture()
            val request = EditMarketUseCase.ManualStoreRequest("국화빵", pinKind = MarketPinKind.REFERENCE,
                referenceStoreId = 10, relativePosition = "옆", positionNote = "약국 입구")
            f.service.manualStore(f.actor, 1, null, request).referenceStoreId shouldBe 10
            shouldThrow<IllegalArgumentException> { f.service.manualStore(f.actor, 1, null, request.copy(referenceStoreId = 999)) }
            shouldThrow<IllegalArgumentException> { f.service.manualStore(f.actor, 1, 20, request.copy(positionNote = null)) }
            shouldThrow<IllegalArgumentException> { f.service.manualStore(f.actor, 1, 20, request.copy(referenceStoreId = 20)) }
            shouldThrow<IllegalArgumentException> { f.service.manualStore(f.actor, 1, null, f.manual().copy(latitude = null, longitude = null)) }
        }
        Then("rejects deletion or create revert when another row references the manual store") {
            val f = EditorFixture(); f.service.manualStore(f.actor, 1, null, f.manual())
            f.stores[21L] = MarketStore(1, "참고", MarketStoreSource.MANUAL, pinKind = MarketPinKind.REFERENCE,
                referenceStoreId = 20, relativePosition = "옆", positionNote = "메모", actorKind = MarketActorKind.ADMIN, createdByMemberId = 7, id = 21)
            shouldThrow<IllegalArgumentException> { f.service.deleteStore(f.actor, 1, 20) }
            shouldThrow<IllegalArgumentException> { f.service.revert(f.actor, 1, 1) }
        }
    }
    Given("zones, ordering and safe revert") {
        Then("edits automatic zone names/polygon, orders zones and restores deleted manual IDs") {
            val f = EditorFixture()
            f.zones[31L] = MarketZone(1, MarketZoneKind.ROAD, "자동", MarketZoneSource.AUTO, sourceKey = "r", id = 31)
            val request = EditMarketUseCase.ZoneRequest("골목", MarketZoneKind.ROAD, polygonWkt = "POLYGON((127 37,128 37,128 38,127 37))")
            f.service.zone(f.actor, 1, 31, request).source shouldBe MarketZoneSource.AUTO
            f.service.zone(f.actor, 1, null, EditMarketUseCase.ZoneRequest("본관", MarketZoneKind.BUILDING, dong = "A", floor = "1"))
            f.service.orderZones(f.actor, 1, listOf(30, 31))
            f.zones[31L]!!.sortOrder shouldBe 1
            f.service.deleteZone(f.actor, 1, 30)
            val deletedLog = f.changes.last().id!!
            f.service.revert(f.actor, 1, deletedLog)
            f.zones[30L]!!.name shouldBe "본관"
        }
        Then("deletes unreferenced automatic zones and restores IDs/source keys, refusing ingest recreation conflicts") {
            val f = EditorFixture()
            val original = MarketZone(1, MarketZoneKind.ROAD, "자동", MarketZoneSource.AUTO, sourceKey = "r", id = 31)
            f.zones[31L] = original
            f.service.deleteZone(f.actor, 1, 31)
            f.service.revert(f.actor, 1, 1)
            f.zones[31L] shouldBe original
            f.service.deleteZone(f.actor, 1, 31)
            f.zones[32L] = original.copy(id = 32)
            shouldThrow<MarketEditConflict> { f.service.revert(f.actor, 1, 3) }
            f.zones.containsKey(31L) shouldBe false
        }
        Then("rejects invalid geometry, cross-market parents, cycles and incomplete ordering") {
            val f = EditorFixture()
            val request = EditMarketUseCase.ZoneRequest("구역", MarketZoneKind.CUSTOM)
            listOf("POINT(127 37)", "POLYGON((127 37,128 37,128 38))", "POLYGON((0 0,2 2,0 2,2 0,0 0))",
                "POLYGON((0 0,1 0,1 1,0 0),,)", "POLYGON((0 0,1 0,1 1,0 0),(2 2,3 2,3 3,2 2))").forEach {
                shouldThrow<IllegalArgumentException> { f.service.zone(f.actor, 1, null, request.copy(polygonWkt = it)) }
            }
            shouldThrow<IllegalArgumentException> { f.service.zone(f.actor, 1, null, request.copy(parentId = 999)) }
            f.service.zone(f.actor, 1, null, request)
            shouldThrow<IllegalArgumentException> { f.service.zone(f.actor, 1, 30, request.copy(parentId = 30)) }
            shouldThrow<IllegalArgumentException> { f.service.orderZones(f.actor, 1, emptyList()) }
            f.stores[10L] = f.stores.getValue(10L).copy(zoneId = 30)
            shouldThrow<IllegalArgumentException> { f.service.deleteZone(f.actor, 1, 30) }
        }
        Then("accepts closed polygons with interior holes") {
            val f = EditorFixture()
            val wkt = "POLYGON((0 0,4 0,4 4,0 4,0 0),(1 1,2 1,2 2,1 2,1 1))"
            f.service.zone(f.actor, 1, null, EditMarketUseCase.ZoneRequest("구역", MarketZoneKind.CUSTOM, polygonWkt = wkt)).polygonWkt shouldBe wkt
        }
        Then("stale snapshots and foreign-market history cannot be reverted") {
            val f = EditorFixture()
            f.service.manualStore(f.actor, 1, null, f.manual())
            f.service.manualStore(f.actor, 1, 20, f.manual("後"))
            shouldThrow<MarketEditConflict> { f.service.revert(f.actor, 1, 1) }
            f.changes.add(f.changes[0].copy(marketId = 2, id = 3))
            shouldThrow<IllegalArgumentException> { f.service.revert(f.actor, 1, 3) }
            f.service.revert(f.actor, 1, 2)
            f.stores[20L]!!.name shouldBe "수동"
            f.service.revert(f.actor, 1, 1)
            f.stores.containsKey(20L) shouldBe false
        }
        Then("DB timestamp truncation does not create a false revert conflict") {
            val f = EditorFixture()
            f.service.manualStore(f.actor, 1, null, f.manual())
            val row = f.stores.getValue(20L)
            f.stores[20L] = row.copy(createdAt = row.createdAt.withNano(row.createdAt.nano / 1000 * 1000))
            f.service.revert(f.actor, 1, 1)
            f.stores.containsKey(20L) shouldBe false
            f.service.override(f.actor, 1, 10, EditMarketUseCase.OverrideRequest(mapOf("name" to "수정"), reason = "근거"))
            f.overrides.replaceAll { it.copy(createdAt = it.createdAt.withNano(it.createdAt.nano / 1000 * 1000)) }
            f.service.revert(f.actor, 1, 3)
            f.overrides.isEmpty() shouldBe true
        }
        Then("numeric zone override variants prevent deletion") {
            val f = EditorFixture()
            f.service.zone(f.actor, 1, null, EditMarketUseCase.ZoneRequest("구역", MarketZoneKind.CUSTOM))
            listOf("030", "+30").forEach { value ->
                f.service.override(f.actor, 1, 10, EditMarketUseCase.OverrideRequest(mapOf("zoneId" to value), reason = "확인"))
                shouldThrow<IllegalArgumentException> { f.service.deleteZone(f.actor, 1, 30) }
            }
            f.zones.containsKey(30L) shouldBe true
        }
        Then("reference pins derive a public visible coordinate without changing persisted source coordinates") {
            val f = EditorFixture()
            val request = EditMarketUseCase.ManualStoreRequest("국화빵", pinKind = MarketPinKind.REFERENCE,
                referenceStoreId = 10, relativePosition = "옆", positionNote = "약국 입구")
            val row = f.service.manualStore(f.actor, 1, null, request)
            row.latitude shouldBe null
            val projected = MarketPublicProjection.stores(f.stores.values.toList(), emptyMap()).find { it.source.id == row.id }!!
            projected.display.coordinate shouldBe MarketCoordinate(37.0, 127.0)
            projected.display.pinKind shouldBe MarketPinKind.REFERENCE
            f.stores[10L] = f.stores.getValue(10L).copy(membership = MarketMembership(MarketMembershipStatus.UNKNOWN))
            shouldThrow<IllegalArgumentException> { f.service.manualStore(f.actor, 1, 20, request) }
            MarketPublicProjection.stores(f.stores.values.toList(), emptyMap()).find { it.source.id == row.id }!!.display.coordinate shouldBe null
        }
    }
    Given("actor scope and place transaction boundary") {
        Then("stewards cannot edit other markets, revert or clear polygons") {
            val f = EditorFixture(); val steward = MarketEditorActor(MarketActorKind.STEWARD, 8, setOf(2))
            shouldThrow<BusinessException> { f.service.manualStore(steward, 1, null, f.manual()) }
            val own = steward.copy(allowedMarketIds = setOf(1))
            shouldThrow<BusinessException> { f.service.revert(own, 1, 999) }
            f.zones[30L] = MarketZone(1, MarketZoneKind.CUSTOM, "구역", MarketZoneSource.MANUAL, polygonWkt = "POLYGON((0 0,1 0,1 1,0 0))", id = 30)
            shouldThrow<BusinessException> { f.service.zone(own, 1, 30, EditMarketUseCase.ZoneRequest("구역", MarketZoneKind.CUSTOM)) }
            verify(exactly = 0) { f.save.appendChange(any()) }
        }
        Then("every mutation has placeTransactionManager and complete admin detail includes OUT/UNKNOWN/raw overrides") {
            val mutationNames = setOf("override", "manualStore", "deleteStore", "zone", "deleteZone", "orderZones", "revert")
            MarketEditorService::class.java.methods.filter { it.name in mutationNames }.forEach {
                it.getAnnotation(Transactional::class.java).transactionManager shouldBe "placeTransactionManager"
            }
            val f = EditorFixture()
            f.stores[10L] = f.stores.getValue(10L).copy(membership = MarketMembership(MarketMembershipStatus.OUT))
            f.stores[11L] = f.stores.getValue(10L).copy(id = 11, sourceKey = "o2", onnuriKey = "o2", membership = MarketMembership(MarketMembershipStatus.UNKNOWN))
            f.service.detail(f.actor, 1).stores.size shouldBe 2
        }
    }
})
