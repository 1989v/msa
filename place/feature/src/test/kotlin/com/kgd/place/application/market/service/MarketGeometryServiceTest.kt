package com.kgd.place.application.market.service

import com.kgd.place.application.market.port.*
import com.kgd.place.application.market.usecase.*
import com.kgd.place.application.market.usecase.MarketGeometryUseCase.*
import com.kgd.place.domain.market.model.*
import com.kgd.place.presentation.market.dto.MarketResponse
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.assertions.throwables.shouldThrow
import io.mockk.*
import java.time.LocalDateTime

private class GeometryFixture {
    val editor = mockk<MarketEditorPort>()
    val query = mockk<MarketQueryPort>()
    val save = mockk<MarketSavePort>()
    val geometry = mockk<MarketGeometryQueryPort>()
    val writes = mockk<MarketGeometryEditPort>()
    val judgments = mockk<MarketJudgmentSavePort>()
    var market = Market("market", "Market", MarketType.STREET, latitude = 37.0, longitude = 127.0, id = 1)
    var boundary: MarketBoundary? = null
    var paths = mutableListOf<MarketPath>()
    var entrances = mutableListOf<MarketEntrance>()
    var rules = mutableListOf<MarketRoadRule>()
    var stores = mutableListOf<MarketStore>()
    var overrides = mutableListOf<MarketStoreOverride>()
    val raw = mutableMapOf<MarketOsmKind, MarketOsmRaw>()
    val logs = mutableListOf<MarketChangeLog>()
    val actor = MarketEditorActor(MarketActorKind.ADMIN, 7)
    val polygon = listOf(listOf(36.99,126.99),listOf(36.99,127.01),listOf(37.01,127.01),listOf(37.01,126.99))
    val judge: MarketRejudgeService
    val service: MarketGeometryService
    init {
        every { editor.lockMarket(1) } answers { market }
        every { editor.findMarket(1) } answers { market }
        every { query.findStores(1) } answers { stores.toList() }
        every { query.findOverrides(any()) } answers { val ids = firstArg<List<Long>>(); overrides.filter { it.storeId in ids } }
        every { editor.replaceOverrides(any(), any()) } answers {
            val row = firstArg<MarketStore>(); overrides.removeAll { it.storeId == row.id }; overrides.addAll(secondArg())
        }
        every { geometry.findBoundary(1) } answers { boundary }
        every { geometry.findPaths(1) } answers { paths.toList() }
        every { geometry.findRoadRules(1) } answers { rules.toList() }
        every { writes.findEntrances(1) } answers { entrances.toList() }
        every { writes.findRaw(1, any()) } answers { raw[secondArg()] }
        every { writes.saveRaw(any()) } answers { firstArg<MarketOsmRaw>().let { raw[it.kind] = it }; Unit }
        every { writes.boundary(1, any()) } answers { boundary = secondArg(); Unit }
        every { writes.path(1, any(), any()) } answers {
            val id = secondArg<Long?>(); val row = thirdArg<MarketPath?>()?.copy(id = id ?: 100L)
            paths.removeAll { it.id == id }; if (row != null) paths.add(row); row
        }
        every { writes.entrance(1, any(), any()) } answers {
            val id = secondArg<Long?>(); val row = thirdArg<MarketEntrance?>()?.copy(id = id ?: 100L)
            entrances.removeAll { it.id == id }; if (row != null) entrances.add(row); row
        }
        every { writes.roadRule(1, any(), any()) } answers {
            val id = secondArg<Long?>(); val row = thirdArg<MarketRoadRule?>()?.copy(id = id ?: 100L)
            rules.removeAll { it.id == id }; if (row != null) rules.add(row); row
        }
        every { writes.geo(1, any(), any(), any()) } answers {
            market = market.copy(centerOverrideLat = secondArg(), centerOverrideLng = thirdArg(), radiusOverrideM = arg(3)); Unit
        }
        every { save.appendChange(any()) } answers { firstArg<MarketChangeLog>().copy(id = logs.size + 1L).also { logs.add(it) } }
        every { judgments.saveJudgment(1, any(), any()) } answers {
            val id = secondArg<Long>(); val judgment = thirdArg<MarketStoreJudgment>(); val index = stores.indexOfFirst { it.id == id }
            stores[index] = stores[index].copy(judgedMembership = judgment.membership, judgedBy = judgment.judgedBy, pathId = judgment.pathId, needsReview = judgment.needsReview); Unit
        }
        judge = MarketRejudgeService(editor, query, geometry, judgments)
        service = MarketGeometryService(editor, query, save, geometry, writes, judge)
    }
    fun source(id: Long) = MarketStore(1, "Store $id", MarketStoreSource.SANGGA, sourceKey = id.toString(), sanggaKey = id.toString(), sanggaRaw = "{}",
        membership = MarketMembership(MarketMembershipStatus.OUT), latitude = 37.0, longitude = 127.0,
        roadName = "Main", roadAddress = "Main 12", id = id)
}

class MarketGeometryServiceTest : BehaviorSpec({
    Given("boundary edits and history use the same rejudge path") {
        Then("boundary save counts changed stores and reverting restores the prior effective judgment") {
            val f = GeometryFixture(); f.stores.add(f.source(1)); f.judge.rejudge(1)
            f.service.edit(f.actor,1,MarketChangeTarget.BOUNDARY,null,Edit(polygon=f.polygon,reason="survey"),"survey")["rejudge"] shouldBe Rejudge(1)
            f.stores.single().judgedMembership shouldBe MarketMembershipStatus.IN
            f.stores.single().membership.status shouldBe MarketMembershipStatus.OUT
            f.service.revert(f.actor,f.logs.first())
            f.boundary shouldBe null
            f.stores.single().judgedMembership shouldBe MarketMembershipStatus.OUT
            f.stores.single().judgedBy shouldBe MarketJudgedBy.INGEST
            f.logs.last().action shouldBe MarketChangeAction.REVERT
        }
    }
    Given("OSM refresh after editorial corrections") {
        Then("keeps manual boundary, paths, entrances and rules and replaces only OSM source paths") {
            val f=GeometryFixture()
            f.boundary=MarketBoundary(1,f.polygon.coordinates(),MarketGeometrySource.MANUAL)
            val line=listOf(MarketCoordinate(37.0,127.0),MarketCoordinate(37.001,127.0))
            val manual=MarketPath(1,"edited",true,line,MarketGeometrySource.MANUAL,11,id=1)
            f.paths.add(manual); f.paths.add(MarketPath(1,"old",true,line,MarketGeometrySource.OSM,12,id=2))
            val entrance=MarketEntrance(1,37.0,127.0,1,"door",MarketGeometrySource.MANUAL,1); f.entrances.add(entrance)
            val rule=MarketRoadRule(1,"Main",MarketMembershipStatus.IN,"survey",id=1); f.rules.add(rule)
            f.service.ingest(1,Osm(LocalDateTime.now(),mapOf("boundary" to null,"paths" to mapOf("elements" to emptyList<Any>()),"roads" to mapOf("elements" to emptyList<Any>())),null,listOf(OsmPath(11,"source",line.arrays()),OsmPath(13,"new",line.arrays()))))
            f.boundary?.source shouldBe MarketGeometrySource.MANUAL
            f.paths.first { it.id==1L } shouldBe manual
            f.paths.any { it.osmWayId==12L } shouldBe false
            f.paths.any { it.osmWayId==13L } shouldBe true
            f.entrances.single() shouldBe entrance; f.rules.single() shouldBe rule
            f.raw.keys shouldBe MarketOsmKind.entries.toSet()
        }
    }
    Given("a market has no polygon") {
        Then("one road rule changes 141 stores without rewriting source membership") {
            val f=GeometryFixture(); (1L..141L).forEach { f.stores.add(f.source(it)) }
            f.service.edit(f.actor,1,MarketChangeTarget.ROAD_RULE,null,Edit(roadName="Main",membership=MarketMembershipStatus.IN,reason="survey"),"survey")["rejudge"] shouldBe Rejudge(141)
            f.stores.count { it.judgedMembership==MarketMembershipStatus.IN } shouldBe 141
            f.service.stores(1,MarketMembershipStatus.IN).size shouldBe 141
            f.stores.all { it.membership.status==MarketMembershipStatus.OUT } shouldBe true
        }
        Then("null center and radius explicitly clear previous overrides and are reversible") {
            val f=GeometryFixture(); f.market=f.market.copy(centerOverrideLat=38.0,centerOverrideLng=128.0,radiusOverrideM=500.0)
            val result=f.service.edit(f.actor,1,MarketChangeTarget.MARKET_GEO,null,Edit(reason="clear"),"clear")
            result["geo"] shouldBe Geo(37.0,127.0,300.0,false,false)
            MarketResponse.from(QueryMarketUseCase.MarketResult(f.market,emptyList(),emptyList())).market.latitude shouldBe 37.0
            f.service.revert(f.actor,f.logs.first())
            f.market.centerOverrideLat shouldBe 38.0; f.market.radiusOverrideM shouldBe 500.0
            val public = MarketResponse.from(QueryMarketUseCase.MarketResult(f.market,emptyList(),emptyList())).market
            public.latitude shouldBe 38.0; public.longitude shouldBe 128.0
        }
    }
    Given("an automatically flagged store") {
        Then("path correction survives subsequent rejudgement and uses the existing override history format") {
            val f=GeometryFixture(); f.stores.add(f.source(1).copy(membership=MarketMembership(MarketMembershipStatus.IN)))
            val line=listOf(MarketCoordinate(37.0,127.0),MarketCoordinate(37.001,127.0))
            f.paths.add(MarketPath(1,"other",true,line,MarketGeometrySource.OSM,11,id=1))
            f.judge.rejudge(1)
            f.service.needsReview(f.actor,1).single().suggestedPathId shouldBe 1
            f.service.assign(f.actor,1,1,Assignment(1,"checked"))["rejudge"] shouldBe Rejudge(1)
            f.judge.rejudge(1) shouldBe 0
            f.stores.single().needsReview shouldBe false
            f.overrides.single().field shouldBe MarketStoreField.PATH_ID
            f.logs.single().beforeRaw!!.contains("overrides") shouldBe true
        }
    }
    Given("paired public source rows") {
        Then("keeps a correction on the paired SANGGA row and prefers canonical row edits when both exist") {
            val f=GeometryFixture()
            val onnuri=f.source(1).copy(source=MarketStoreSource.ONNURI,onnuriKey="o1",onnuriRaw="{}",name="paired",jibunAddress="same",pathId=1)
            val sangga=f.source(2).copy(name="paired",jibunAddress="same")
            val correction=MarketStoreOverride(2,MarketStoreField.PATH_ID,"4","checked",7,MarketActorKind.ADMIN)
            MarketPublicProjection.stores(listOf(onnuri,sangga),mapOf(2L to listOf(correction)),setOf(1,4)).single().source.pathId shouldBe 4
            val own=MarketStoreOverride(1,MarketStoreField.PATH_ID,"1","checked",7,MarketActorKind.ADMIN)
            MarketPublicProjection.stores(listOf(onnuri,sangga),mapOf(1L to listOf(own),2L to listOf(correction)),setOf(1,4)).single().source.pathId shouldBe 1
            MarketPublicProjection.stores(listOf(onnuri,sangga),mapOf(2L to listOf(correction)),setOf(1)).single().source.pathId shouldBe 1
        }
    }
    Given("geometry history conflicts and deleted identities") {
        Then("rejects reverting an older edit after another write and restores a deleted path ID") {
            val f=GeometryFixture()
            f.service.edit(f.actor,1,MarketChangeTarget.BOUNDARY,null,Edit(polygon=f.polygon,reason="first"),"first")
            f.service.edit(f.actor,1,MarketChangeTarget.BOUNDARY,null,Edit(polygon=f.polygon.map { listOf(it[0]+0.1,it[1]) },reason="newer"),"newer")
            shouldThrow<MarketEditConflict> { f.service.revert(f.actor,f.logs.first()) }
            f.service.edit(f.actor,1,MarketChangeTarget.PATH,null,Edit(name="path",geometry=listOf(listOf(37.0,127.0),listOf(37.001,127.0)),reason="draw"),"draw")
            val created=f.logs.last(); val id=f.paths.single().id
            f.service.revert(f.actor,created); f.paths shouldBe emptyList()
            f.service.revert(f.actor,f.logs.last()); f.paths.single().id shouldBe id
        }
    }
    Given("paths referenced by entrances or persisted corrections") {
        Then("rejects operator deletion until references are removed") {
            val f=GeometryFixture()
            f.paths.add(MarketPath(1,"Main",true,listOf(MarketCoordinate(37.0,127.0),MarketCoordinate(37.001,127.0)),MarketGeometrySource.MANUAL,id=4))
            f.entrances.add(MarketEntrance(1,37.0,127.0,4,null,MarketGeometrySource.MANUAL,1))
            shouldThrow<IllegalArgumentException> { f.service.edit(f.actor,1,MarketChangeTarget.PATH,4,null,"delete") }
            f.entrances.clear(); f.stores.add(f.source(1))
            f.overrides.add(MarketStoreOverride(1,MarketStoreField.PATH_ID,"4","checked",7,MarketActorKind.ADMIN))
            shouldThrow<IllegalArgumentException> { f.service.edit(f.actor,1,MarketChangeTarget.PATH,4,null,"delete") }
            f.logs.size shouldBe 0; f.paths.size shouldBe 1
        }
        Then("OSM removal preserves manual entrance and correction evidence but hides stale references in map views") {
            val f=GeometryFixture()
            f.paths.add(MarketPath(1,"Main",true,listOf(MarketCoordinate(37.0,127.0),MarketCoordinate(37.001,127.0)),MarketGeometrySource.OSM,4,id=4))
            val entrance=MarketEntrance(1,37.0,127.0,4,null,MarketGeometrySource.MANUAL,1); f.entrances.add(entrance)
            val store=MarketStore(1,"manual",MarketStoreSource.MANUAL,membership=MarketMembership(MarketMembershipStatus.IN),latitude=37.0,longitude=127.0,actorKind=MarketActorKind.ADMIN,createdByMemberId=7,id=1)
            f.stores.add(store)
            val correction=MarketStoreOverride(1,MarketStoreField.PATH_ID,"4","checked",7,MarketActorKind.ADMIN); f.overrides.add(correction)
            f.service.ingest(1,Osm(LocalDateTime.now(),mapOf("boundary" to null,"paths" to emptyMap<String,Any>(),"roads" to emptyMap<String,Any>()),null,emptyList()))
            f.paths shouldBe emptyList(); f.entrances.single() shouldBe entrance; f.overrides.single() shouldBe correction
            f.service.geometry(f.actor,1).entrances.single().pathId shouldBe null
            val projected=MarketPublicProjection.stores(f.stores,mapOf(1L to f.overrides))
            val response=MarketResponse.from(QueryMarketUseCase.MarketResult(f.market,emptyList(),projected,entrances=f.entrances))
            response.stores.single().pathId shouldBe null; response.entrances.single().pathId shouldBe null
        }
    }
    Given("raw OSM drafts and road backgrounds") {
        Then("stitches reversed relation outer members for reset and exposes raw roads only as display lines") {
            val f=GeometryFixture()
            val payload="""{"elements":[{"type":"relation","id":99,"tags":{"amenity":"marketplace"},"members":[{"role":"outer","geometry":[{"lat":37,"lon":127},{"lat":37,"lon":127.01},{"lat":37.01,"lon":127.01}]},{"role":"outer","geometry":[{"lat":37,"lon":127},{"lat":37.01,"lon":127},{"lat":37.01,"lon":127.01}]}]}]}"""
            f.raw[MarketOsmKind.BOUNDARY]=MarketOsmRaw(1,MarketOsmKind.BOUNDARY,payload,LocalDateTime.now())
            f.raw[MarketOsmKind.ROADS]=MarketOsmRaw(1,MarketOsmKind.ROADS,"""{"elements":[{"tags":{"name":"Main","highway":"primary"},"geometry":[{"lat":37,"lon":127},{"lat":38,"lon":127}]}]}""",LocalDateTime.now())
            f.service.reset(f.actor,1,Reset(MarketGeometrySource.OSM,"restore"))
            f.boundary!!.polygon.first() shouldBe f.boundary!!.polygon.last()
            f.boundary!!.osmId shouldBe 99
            val view=f.service.geometry(f.actor,1)
            view.boundary!!.osmId shouldBe "relation/99"
            view.background.roads.single() shouldBe Road("Main","primary",listOf(listOf(37.0,127.0),listOf(38.0,127.0)))
            view.attribution shouldBe listOf("© OpenStreetMap contributors")
        }
        Then("DERIVED reset uses effective IN store positions and the buffered hull") {
            val f=GeometryFixture(); f.stores.add(f.source(1).copy(judgedMembership=MarketMembershipStatus.IN))
            f.service.reset(f.actor,1,Reset(MarketGeometrySource.DERIVED,"draft"))
            f.boundary!!.source shouldBe MarketGeometrySource.DERIVED
            MarketGeometry.contains(MarketCoordinate(37.0,127.0),f.boundary!!.polygon) shouldBe true
        }
    }
    Given("public market geometry") {
        Then("prefers derived membership and exposes only geometry views with attribution") {
            val f=GeometryFixture(); val source=f.source(1).copy(judgedMembership=MarketMembershipStatus.IN,judgedBy=MarketJudgedBy.BOUNDARY,needsReview=true,pathId=4,onnuriRaw="{\"secret\":true}")
            val projected=MarketPublicProjection.stores(listOf(source),emptyMap())
            projected.single().display.membership.status shouldBe MarketMembershipStatus.IN
            val response=MarketResponse.from(QueryMarketUseCase.MarketResult(f.market,emptyList(),projected,MarketBoundary(1,f.polygon.coordinates(),MarketGeometrySource.OSM,"way",1),
                listOf(MarketPath(1,"Main",true,listOf(MarketCoordinate(37.0,127.0),MarketCoordinate(37.001,127.0)),MarketGeometrySource.OSM,4,id=4))))
            response.stores.single().pathId shouldBe 4
            response.attribution shouldBe listOf("© OpenStreetMap contributors")
            val raw=tools.jackson.module.kotlin.jacksonMapperBuilder().build().writeValueAsString(response)
            raw.contains("needsReview") shouldBe false; raw.contains("judgedBy") shouldBe false; raw.contains("secret") shouldBe false
        }
    }
})
