package com.kgd.place.presentation.attraction.controller

import com.kgd.place.application.attraction.usecase.LookupAttractionExtrasUseCase
import com.kgd.place.application.attraction.usecase.SyncAttractionBarrierFreeUseCase
import com.kgd.place.application.attraction.usecase.SyncAttractionWellnessUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import tools.jackson.module.kotlin.jacksonObjectMapper
import tools.jackson.module.kotlin.readValue
import java.time.LocalDateTime

/** 수집기(place-ingest `place_client.py`)가 보내는 JSON 모양 그대로 요청 DTO 로 읽혀 유스케이스에 닿는지. */
class AttractionExtrasInternalControllerTest : BehaviorSpec({
    val barrierFree = mockk<SyncAttractionBarrierFreeUseCase>()
    val wellness = mockk<SyncAttractionWellnessUseCase>()
    val lookup = mockk<LookupAttractionExtrasUseCase>()
    val controller = AttractionExtrasInternalController(barrierFree, wellness, lookup)
    val json = jacksonObjectMapper()

    Given("수집기가 보낸 무장애 상세 요청") {
        // barrier_free.detail_record 가 만드는 모양 — 원천이 빈 응답을 준 곳은 detailRaw 가 null 이다
        val body = """
            {"items":[
              {"contentId":"126508","detailRaw":"{\"contentid\":\"126508\",\"wheelchair\":\"대여가능\"}","flags":["WHEELCHAIR"],"flagsRuleVer":1,"detailSyncedAt":"2026-10-03T02:41:00"},
              {"contentId":"3305925","detailRaw":null,"flags":[],"flagsRuleVer":1,"detailSyncedAt":"2026-10-03T02:41:01"}
            ]}
        """.trimIndent()
        Then("받은 시각·플래그·빈 원문이 그대로 유스케이스로 간다") {
            val items = slot<List<SyncAttractionBarrierFreeUseCase.DetailItem>>()
            every { barrierFree.applyDetails(capture(items)) } returns 2

            controller.barrierFreeDetails(json.readValue<BarrierFreeDetailRequest>(body)).data!!.applied shouldBe 2

            items.captured.map { it.contentId } shouldBe listOf("126508", "3305925")
            items.captured[0].flags shouldBe listOf("WHEELCHAIR")
            items.captured[0].detailSyncedAt shouldBe LocalDateTime.of(2026, 10, 3, 2, 41)
            items.captured[1].detailRaw shouldBe null
        }
    }

    Given("수집기가 보낸 무장애 목록 요청") {
        val body = """{"items":[{"contentId":"126508","listRaw":"{}","listModifiedAt":"2025-12-24T17:18:58"},{"contentId":"3305925","listRaw":"{}","listModifiedAt":null}]}"""
        Then("수정 시각이 없는 행도 받는다") {
            val items = slot<List<SyncAttractionBarrierFreeUseCase.ListItem>>()
            every { barrierFree.applyList(capture(items)) } returns SyncAttractionBarrierFreeUseCase.ListApplied(1, 1, listOf("3305925"))

            controller.barrierFreeList(json.readValue<BarrierFreeListRequest>(body)).data!!.unmatchedSample shouldBe listOf("3305925")
            items.captured.map { it.listModifiedAt } shouldBe listOf(LocalDateTime.of(2025, 12, 24, 17, 18, 58), null)
        }
    }

    Given("웰니스 교체 요청") {
        Then("언어와 항목을 그대로 넘긴다") {
            every { wellness.replace("ko", any()) } returns SyncAttractionWellnessUseCase.Applied(1, 0, 0)
            val request = json.readValue<WellnessRequest>("""{"lang":"ko","items":[{"contentId":"127956","themaCd":"EX050100","listRaw":"{}"}]}""")
            controller.wellness(request).data!! shouldBe SyncAttractionWellnessUseCase.Applied(1, 0, 0)
        }
    }

    Given("재색인의 묶음 조회") {
        Then("항목마다 무장애·웰니스를 한 번에 싣는다") {
            every { lookup.lookup(listOf(11L, 21L)) } returns listOf(
                LookupAttractionExtrasUseCase.Found(11L, LookupAttractionExtrasUseCase.BarrierFree(listOf("WHEELCHAIR"), "{}"), null),
            )
            val out = json.readTree(json.writeValueAsString(controller.lookup(ExtrasLookupRequest(listOf(11L, 21L))).data))
            out.path("items").path(0).path("attractionId").asLong() shouldBe 11L
            out.path("items").path(0).path("barrierFree").path("flags").path(0).asString() shouldBe "WHEELCHAIR"
            out.path("items").path(0).path("wellness").isNull shouldBe true
        }
    }

    Given("집중률이 있는 곳의 묶음 조회") {
        Then("search-batch 가 읽는 이름(congestion.matchMethod · days[].date · days[].rate)으로 나간다") {
            every { lookup.lookup(listOf(31L)) } returns listOf(
                LookupAttractionExtrasUseCase.Found(
                    31L, null, null,
                    LookupAttractionExtrasUseCase.Congestion("EXACT", listOf(LookupAttractionExtrasUseCase.Day("2026-10-02", 47.16))),
                ),
            )
            val item = json.readTree(json.writeValueAsString(controller.lookup(ExtrasLookupRequest(listOf(31L))).data)).path("items").path(0)
            item.path("congestion").path("matchMethod").asString() shouldBe "EXACT"
            item.path("congestion").path("days").path(0).path("date").asString() shouldBe "2026-10-02"
            item.path("congestion").path("days").path(0).path("rate").asDouble() shouldBe 47.16
        }
    }
})
