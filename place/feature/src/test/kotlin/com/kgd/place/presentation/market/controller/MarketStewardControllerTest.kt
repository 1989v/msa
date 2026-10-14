package com.kgd.place.presentation.market.controller

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.place.application.market.port.*
import com.kgd.place.application.market.service.MarketEditorService
import com.kgd.place.application.market.service.MarketStewardService
import com.kgd.place.application.market.usecase.*
import com.kgd.place.domain.market.model.*
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder

private class StewardControllerFixture {
    val port = mockk<MarketStewardPort>()
    val editor = mockk<MarketEditorPort>()
    val query = mockk<MarketQueryPort>()
    val save = mockk<MarketSavePort>()
    var grant: MarketSteward? = null
    val changes = mutableListOf<MarketChangeLog>()
    val stores = mutableListOf<MarketStore>()
    val service = MarketStewardService(port, editor)
    val edit = MarketEditorService(query, save, editor)
    val mvc = MockMvcBuilders.standaloneSetup(MarketStewardController(service), MarketStewardAdminController(service), MarketManageController(edit, service))
        .setControllerAdvice(MarketAdminExceptionHandler(), GlobalExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build())).build()
    init {
        val market = Market("m", "시장", MarketType.STREET, id = 1)
        every { editor.lockMarket(1) } returns market
        every { editor.findMarket(1) } returns market
        every { port.find(any(), any()) } answers { grant?.takeIf { it.marketId == firstArg<Long>() && it.memberId == secondArg<Long>() } }
        every { port.marketIdById(1) } answers { grant?.marketId }
        every { port.lockById(1) } answers { grant }
        every { port.save(any()) } answers { firstArg<MarketSteward>().copy(id = 1).also { grant = it } }
        every { port.list(any(), any(), any()) } answers { listOfNotNull(grant) to if (grant == null) 0L else 1L }
        every { query.findStores(1) } answers { stores.toList() }
        every { query.findZones(1) } returns emptyList()
        every { query.findOverrides(any()) } returns emptyList()
        every { save.saveStore(any()) } answers { firstArg<MarketStore>().copy(id = 10).also { stores.add(it) } }
        every { save.appendChange(any()) } answers { firstArg<MarketChangeLog>().copy(id = changes.size + 1L).also { changes.add(it) } }
        every { editor.findChanges(1, 0, 20) } answers { changes.toList() to changes.size.toLong() }
    }
    fun apply() = mvc.perform(post("/api/v1/place/markets/1/steward-applications").header("X-User-Id", "7")
        .contentType("application/json").content("""{"orgName":"상인회","contact":"연락처"}"""))
    fun decide(action: String) = mvc.perform(put("/api/v1/admin/place/stewards/1").header("X-User-Id", "9")
        .contentType("application/json").content("""{"action":"$action"}"""))
}

class MarketStewardControllerTest : BehaviorSpec({
    Given("authenticated market applications and admin decisions") {
        Then("returns PENDING/current state, duplicate409, paged admin list, and invalid transition409") {
            val f = StewardControllerFixture()
            f.apply().andExpect(status().isOk).andExpect(jsonPath("$.data.status").value("PENDING"))
            f.apply().andExpect(status().isConflict)
            f.mvc.perform(get("/api/v1/place/markets/1/steward-applications/me").header("X-User-Id", "7"))
                .andExpect(status().isOk).andExpect(jsonPath("$.data.memberId").value(7))
            f.mvc.perform(get("/api/v1/admin/place/stewards").header("X-User-Id", "9").param("status", "PENDING"))
                .andExpect(status().isOk).andExpect(jsonPath("$.data.total").value(1))
            f.decide("SUSPEND").andExpect(status().isConflict)
            f.decide("APPROVE").andExpect(status().isOk).andExpect(jsonPath("$.data.approvedByMemberId").value(9))
            f.apply().andExpect(status().isConflict)
            f.mvc.perform(get("/api/v1/place/markets/1/steward-applications/me")).andExpect(status().isBadRequest)
        }
        Then("approved manual edit and history record STEWARD, other market403, suspension blocks next edit403") {
            val f = StewardControllerFixture()
            f.apply(); f.decide("APPROVE")
            val body = """{"name":"국화빵","items":"빵","latitude":37.1,"longitude":127.1}"""
            f.mvc.perform(post("/api/v1/place/markets/1/manage/stores").header("X-User-Id", "7").contentType("application/json").content(body))
                .andExpect(status().isOk).andExpect(jsonPath("$.data.actorKind").value("STEWARD"))
            f.stores.single().source shouldBe MarketStoreSource.MANUAL
            f.stores.single().createdByMemberId shouldBe 7
            f.changes.single().actorKind shouldBe MarketActorKind.STEWARD
            f.mvc.perform(get("/api/v1/place/markets/1/manage/changes").header("X-User-Id", "7"))
                .andExpect(status().isOk).andExpect(jsonPath("$.data.items[0].actorKind").value("STEWARD"))
            f.mvc.perform(post("/api/v1/place/markets/2/manage/stores").header("X-User-Id", "7").contentType("application/json").content(body))
                .andExpect(status().isForbidden)
            f.decide("SUSPEND").andExpect(status().isOk)
            f.mvc.perform(post("/api/v1/place/markets/1/manage/stores").header("X-User-Id", "7").contentType("application/json").content(body))
                .andExpect(status().isForbidden)
            f.changes.size shouldBe 1
            verify(exactly = 1) { f.save.saveStore(any()) }
        }
        Then("explicit forbidden revert and zone-delete return403 without editor writes") {
            val f = StewardControllerFixture()
            f.apply(); f.decide("APPROVE")
            f.mvc.perform(post("/api/v1/place/markets/1/manage/changes/1/revert").header("X-User-Id", "7"))
                .andExpect(status().isForbidden)
            f.mvc.perform(delete("/api/v1/place/markets/1/manage/zones/1").header("X-User-Id", "7"))
                .andExpect(status().isForbidden)
            verify(exactly = 0) { f.editor.deleteZone(any()); f.editor.findChange(any()); f.save.appendChange(any()) }
        }
    }
})
