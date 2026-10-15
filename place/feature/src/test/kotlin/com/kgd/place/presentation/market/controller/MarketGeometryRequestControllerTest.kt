package com.kgd.place.presentation.market.controller

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.place.application.market.port.*
import com.kgd.place.application.market.service.*
import com.kgd.place.domain.market.model.*
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.LocalDateTime

private class GeometryRequestFixture {
    val requests = mockk<MarketGeometryRequestPort>()
    val grants = mockk<MarketStewardPort>()
    val editor = mockk<MarketEditorPort>()
    val query = mockk<MarketQueryPort>()
    val geometry = mockk<MarketGeometryQueryPort>()
    val judgments = mockk<MarketJudgmentSavePort>(relaxed = true)
    val rejudge = MarketRejudgeService(editor, query, geometry, judgments, mockk(relaxed = true))
    var grant = MarketSteward(1, 7, "상인회", "연락처", MarketStewardStatus.ACTIVE, 9, LocalDateTime.now(), 3)
    val rows = mutableMapOf<Long, MarketGeometryRequest>()
    val service = MarketGeometryRequestService(requests, MarketStewardService(grants, editor), grants, editor)
    val mvc = MockMvcBuilders.standaloneSetup(MarketGeometryRequestController(service), MarketGeometryRequestAdminController(service))
        .setControllerAdvice(MarketAdminExceptionHandler(), GlobalExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build())).build()
    init {
        every { editor.lockMarket(any()) } answers { Market("m", "시장", MarketType.STREET, id = firstArg()) }
        every { grants.find(any(), any()) } answers { grant.takeIf { it.marketId == firstArg<Long>() && it.memberId == secondArg<Long>() } }
        every { grants.lockById(3) } answers { grant }
        every { requests.save(any()) } answers { firstArg<MarketGeometryRequest>().let { it.copy(id = it.id ?: rows.size + 1L) }.also { rows[it.id!!] = it } }
        every { requests.lockById(any()) } answers { rows[firstArg<Long>()] }
        every { requests.listForMarket(any()) } answers { rows.values.filter { it.marketId == firstArg<Long>() } }
        every { requests.list(any()) } answers { rows.values.filter { firstArg<GeometryRequestStatus?>() == null || it.status == firstArg<GeometryRequestStatus?>() } }
        every { query.findStores(1) } returns listOf(MarketStore(1, "가게", MarketStoreSource.ONNURI, sourceKey = "a", onnuriKey = "a", onnuriRaw = "{}",
            membership = MarketMembership(MarketMembershipStatus.OUT), latitude = 37.0, longitude = 127.0, id = 10,
            judgedMembership = MarketMembershipStatus.OUT, judgedBy = MarketJudgedBy.INGEST))
        every { query.findOverrides(any()) } returns emptyList()
        every { geometry.findBoundary(1) } returns null
        every { geometry.findPaths(1) } returns emptyList()
        every { geometry.findRoadRules(1) } returns emptyList()
    }
    fun submit(market: Long = 1, body: String = """{"kind":"BOUNDARY","geometry":[[36,126],[36,128],[38,128],[38,126]],"description":"경계를 확인해 주세요"}""") =
        mvc.perform(post("/api/v1/place/markets/$market/manage/geometry-requests").header("X-User-Id", "7").contentType("application/json").content(body))
    fun decide(body: String) = mvc.perform(put("/api/v1/admin/place/markets/geometry-requests/1").header("X-User-Id", "9").contentType("application/json").content(body))
}

class MarketGeometryRequestControllerTest : BehaviorSpec({
    Given("market-scoped proposals and admin review") {
        Then("ACTIVE submits PENDING and reads own market; other market and suspended read/write return403") {
            val f = GeometryRequestFixture()
            f.submit().andExpect(status().isOk).andExpect(jsonPath("$.data.status").value("PENDING")).andExpect(jsonPath("$.data.id").value(1))
            f.mvc.perform(get("/api/v1/place/markets/1/manage/geometry-requests").header("X-User-Id", "7"))
                .andExpect(status().isOk).andExpect(jsonPath("$.data[0].stewardId").value(3))
            f.submit(2).andExpect(status().isForbidden)
            f.mvc.perform(get("/api/v1/place/markets/2/manage/geometry-requests").header("X-User-Id", "7")).andExpect(status().isForbidden)
            f.grant = f.grant.copy(status = MarketStewardStatus.SUSPENDED)
            f.submit().andExpect(status().isForbidden)
            f.mvc.perform(get("/api/v1/place/markets/1/manage/geometry-requests").header("X-User-Id", "7")).andExpect(status().isForbidden)
            f.rows.size shouldBe 1
        }
        Then("missing/blank reason400, decision metadata, filtered list, and repeated decision409") {
            val f = GeometryRequestFixture(); f.submit()
            f.decide("""{"action":"APPROVE"}""").andExpect(status().isBadRequest)
            f.decide("""{"action":"REJECT","reason":"  "}""").andExpect(status().isBadRequest)
            f.decide("""{"action":"REJECT","reason":" 現地 확인 필요 "}""").andExpect(status().isOk)
                .andExpect(jsonPath("$.data.status").value("REJECTED")).andExpect(jsonPath("$.data.decidedByMemberId").value(9))
            f.decide("""{"action":"APPROVE","reason":"재검토"}""").andExpect(status().isConflict)
            f.mvc.perform(get("/api/v1/admin/place/markets/geometry-requests").header("X-User-Id", "9").param("status", "PENDING"))
                .andExpect(status().isOk).andExpect(jsonPath("$.data.length()").value(0))
        }
        Then("neither pending nor approved drawings affect rejudgement or write editor history") {
            val f = GeometryRequestFixture()
            f.rejudge.rejudge(1) shouldBe 0
            f.submit().andExpect(status().isOk)
            f.rejudge.rejudge(1) shouldBe 0
            f.decide("""{"action":"APPROVE","reason":"그림 확인, 별도 편집 예정"}""").andExpect(status().isOk)
                .andExpect(jsonPath("$.data.status").value("APPROVED"))
            f.rejudge.rejudge(1) shouldBe 0
            f.rows[1]!!.appliedChangeLogId shouldBe null
            verify(exactly = 0) { f.judgments.saveJudgment(any(), any(), any()); f.editor.findChanges(any(), any(), any()) }
            verify(exactly = 1) { f.requests.lockById(1) }
        }
        Then("rejects malformed coordinates, insufficient points and blank descriptions; accepts nullable drawings") {
            val f = GeometryRequestFixture()
            listOf(
                """{"kind":"PATH","geometry":[[37,127]],"description":"골목"}""",
                """{"kind":"NOTE","geometry":[[91,127]],"description":"위치"}""",
                """{"kind":"NOTE","geometry":[[37,127,4]],"description":"위치"}""",
                """{"kind":"BOUNDARY","geometry":[[37,127],[37,127],[37,127]],"description":"경계"}""",
                """{"kind":"NOTE","description":" "}"""
            ).forEach { f.submit(body = it).andExpect(status().isBadRequest) }
            f.submit(body = """{"kind":"NOTE","geometry":null,"description":"현장 확인 요청"}""").andExpect(status().isOk)
        }
        Then("rechecks grant under the lock if suspension wins the race") {
            val f = GeometryRequestFixture()
            every { f.grants.lockById(3) } returns f.grant.copy(status = MarketStewardStatus.SUSPENDED)
            f.submit().andExpect(status().isForbidden)
            f.rows.size shouldBe 0
        }
    }
})
