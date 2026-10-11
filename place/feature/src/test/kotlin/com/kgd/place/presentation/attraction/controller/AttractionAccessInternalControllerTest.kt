package com.kgd.place.presentation.attraction.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.place.application.attraction.usecase.SyncAttractionAccessUseCase
import com.kgd.place.domain.attraction.model.TransitKind
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import tools.jackson.module.kotlin.jacksonObjectMapper
import tools.jackson.module.kotlin.readValue
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * 수집기(place-ingest `transit_stops.nearest_stops`)가 보내는 JSON 이 그대로 읽혀 유스케이스에 닿는지, 그리고 순위·거리 상한을 400 으로 막는지.
 * 경계는 리터럴로 쓴다 — 상수 이름으로 경계를 만들면 상수를 바꿔도 초록이다.
 */
class AttractionAccessInternalControllerTest : BehaviorSpec({
    val useCase = mockk<SyncAttractionAccessUseCase>()
    val controller = AttractionAccessInternalController(useCase)
    val json = jacksonObjectMapper()

    fun body(kind: String, rank: Int, distance: Int) = """
        {"computedAt":"2026-10-12T00:00:00","items":[
          {"attractionId":1,"stops":[
            {"kind":"$kind","sourceKey":"0133|I4101|서울역|1호선","name":"서울역","nameEn":"Seoul Station","lines":"1·4호선",
             "distanceM":$distance,"rank":$rank,"baseDate":"2024-12-31"}]},
          {"attractionId":2,"stops":[]}
        ]}
    """.trimIndent()

    fun invalid(block: () -> Unit) = shouldThrow<BusinessException>(block).errorCode shouldBe ErrorCode.INVALID_INPUT

    Given("수집기가 보낸 가는 법 한 묶음") {
        Then("관광지·종류·순위·사본·기준일이 그대로 유스케이스로 가고, 빈 목록 관광지도 간다") {
            val computed = slot<LocalDateTime>()
            val items = slot<List<SyncAttractionAccessUseCase.Item>>()
            every { useCase.replace(capture(computed), capture(items)) } returns SyncAttractionAccessUseCase.Applied(2, 1, 0)

            controller.replace(json.readValue<AccessRequest>(body("RAIL", 1, 2000))).data!!.attractions shouldBe 2

            computed.captured shouldBe LocalDateTime.of(2026, 10, 12, 0, 0)
            items.captured.map { it.attractionId to it.stops.size } shouldBe listOf(1L to 1, 2L to 0)
            items.captured[0].stops.single().let {
                listOf(it.kind, it.rank, it.name, it.lines, it.distanceM, it.baseDate)
            } shouldBe listOf(TransitKind.RAIL, 1, "서울역", "1·4호선", 2000, LocalDate.of(2024, 12, 31))
        }
    }

    Given("상한을 넘는 줄") {
        every { useCase.replace(any(), any()) } returns SyncAttractionAccessUseCase.Applied(2, 1, 0)
        Then("역 2001m · 정류장 501m · 순위 3 · 순위 0 · 음수 거리 · 모르는 종류는 400") {
            invalid { controller.replace(json.readValue<AccessRequest>(body("RAIL", 1, 2001))) }
            invalid { controller.replace(json.readValue<AccessRequest>(body("BUS", 1, 501))) }
            invalid { controller.replace(json.readValue<AccessRequest>(body("RAIL", 3, 100))) }
            invalid { controller.replace(json.readValue<AccessRequest>(body("BUS", 0, 100))) }
            invalid { controller.replace(json.readValue<AccessRequest>(body("BUS", 1, -1))) }
            invalid { controller.replace(json.readValue<AccessRequest>(body("TRAM", 1, 100))) }
        }
        Then("정류장 500m · 순위 2 는 받는다") {
            controller.replace(json.readValue<AccessRequest>(body("BUS", 2, 500))).data!!.rows shouldBe 1
        }
    }
})
