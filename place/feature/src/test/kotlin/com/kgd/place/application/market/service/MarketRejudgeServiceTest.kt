package com.kgd.place.application.market.service

import com.kgd.place.application.market.port.*
import com.kgd.place.domain.market.model.*
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.*

class MarketRejudgeServiceTest : BehaviorSpec({
    val editor = mockk<MarketEditorPort>()
    val query = mockk<MarketQueryPort>()
    val geometry = mockk<MarketGeometryQueryPort>()
    val save = mockk<MarketJudgmentSavePort>(relaxed = true)
    val service = MarketRejudgeService(editor, query, geometry, save)
    val source = MarketStore(1, "가게", MarketStoreSource.ONNURI, sourceKey = "a", onnuriKey = "a", onnuriRaw = "{\"raw\":1}",
        membership = MarketMembership(MarketMembershipStatus.OUT), latitude = 37.0, longitude = 127.0, id = 10)
    beforeEach {
        clearMocks(editor, query, geometry, save)
        every { editor.lockMarket(1) } returns Market("1", "시장", MarketType.STREET, id = 1)
        every { geometry.findBoundary(1) } returns null
        every { geometry.findPaths(1) } returns emptyList()
        every { geometry.findRoadRules(1) } returns emptyList()
        every { query.findOverrides(any()) } returns emptyList()
    }
    given("rejudging a single market") {
        then("writes only changed derived judgments and counts stores, preserving ingest evidence") {
            val changed = source.copy(judgedMembership = MarketMembershipStatus.IN, judgedBy = MarketJudgedBy.BOUNDARY, pathId = 5, needsReview = true)
            val unchanged = source.copy(id = 11, judgedMembership = MarketMembershipStatus.OUT, judgedBy = MarketJudgedBy.INGEST)
            val manual = MarketStore(1, "수동", MarketStoreSource.MANUAL, actorKind = MarketActorKind.ADMIN, createdByMemberId = 7, id = 12)
            every { query.findStores(1) } returns listOf(changed, unchanged, manual)
            service.rejudge(1) shouldBe 1
            verify(exactly = 1) { save.saveJudgment(1, 10, MarketStoreJudgment(MarketMembershipStatus.OUT, MarketJudgedBy.INGEST, null, false)) }
            verify(exactly = 0) { save.saveJudgment(1, 11, any()) }
            verify(exactly = 0) { save.saveJudgment(1, 12, any()) }
            verify { query.findOverrides(listOf(10, 11)) }
            changed.membership.status shouldBe MarketMembershipStatus.OUT
            changed.onnuriRaw shouldBe "{\"raw\":1}"
        }
        then("counts a path-only change and no change on an identical rerun") {
            val path = MarketPath(1, "골목길", true, listOf(MarketCoordinate(37.0, 127.0), MarketCoordinate(37.001, 127.0)), MarketGeometrySource.OSM, id = 3)
            val row = source.copy(roadName = "골목길", membership = MarketMembership(MarketMembershipStatus.IN),
                judgedMembership = MarketMembershipStatus.IN, judgedBy = MarketJudgedBy.INGEST)
            every { geometry.findPaths(1) } returns listOf(path)
            every { query.findStores(1) } returns listOf(row)
            service.rejudge(1) shouldBe 1
            verify { save.saveJudgment(1, 10, MarketStoreJudgment(MarketMembershipStatus.IN, MarketJudgedBy.INGEST, 3, false)) }
            clearMocks(save)
            every { query.findStores(1) } returns listOf(row.copy(pathId = 3))
            service.rejudge(1) shouldBe 0
            verify(exactly = 0) { save.saveJudgment(any(), any(), any()) }
        }
        then("uses current membership and coordinate overrides without editing source") {
            every { query.findStores(1) } returns listOf(source)
            every { query.findOverrides(listOf(10)) } returns listOf(
                MarketStoreOverride(10, MarketStoreField.MEMBERSHIP, "IN", "현장", 7, MarketActorKind.ADMIN))
            service.rejudge(1) shouldBe 1
            verify { save.saveJudgment(1, 10, MarketStoreJudgment(MarketMembershipStatus.IN, MarketJudgedBy.OVERRIDE, null, false)) }
            source.membership.status shouldBe MarketMembershipStatus.OUT
        }
    }
})
