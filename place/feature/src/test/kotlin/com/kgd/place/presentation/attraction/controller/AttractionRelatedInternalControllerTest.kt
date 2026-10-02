package com.kgd.place.presentation.attraction.controller

import com.kgd.place.application.attraction.usecase.SyncAttractionRelatedUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import tools.jackson.module.kotlin.jacksonObjectMapper
import tools.jackson.module.kotlin.readValue

/** 수집기(place-ingest `related.record` · `place_client.put_related`)가 보내는 JSON 모양 그대로 요청 DTO 로 읽혀 유스케이스에 닿는지. */
class AttractionRelatedInternalControllerTest : BehaviorSpec({
    val useCase = mockk<SyncAttractionRelatedUseCase>()
    val controller = AttractionRelatedInternalController(useCase)
    val json = jacksonObjectMapper()

    Given("수집기가 보낸 한 시군구의 연관 관광지") {
        // 원천 키 이름(tAtsCd · tAtsNm — 둘째 글자가 대문자)이 그대로 필드 이름이다
        val body = """
            {"baseYm":"202608","items":[
              {"tAtsCd":"d123f0a5568bc89d8d3ba07dec2aed8f","tAtsNm":"해운대해수욕장",
               "relatedRaw":"[{\"rlteRank\":\"1\"}]","attractionId":501,"matchMethod":"EXACT",
               "targets":[{"rank":1,"name":"동백섬","lcls":"관광지","mcls":"자연관광","scls":"자연경관(하천/해양)","signguCd":"26350",
                           "attractionId":601,"matchMethod":"NORMALIZED"},
                          {"rank":2,"name":"화로구이/마장점","lcls":"음식","mcls":"음식","scls":"한식","signguCd":"11200",
                           "attractionId":null,"matchMethod":"NONE"}]},
              {"tAtsCd":"e456","tAtsNm":"SEA LIFE 부산아쿠아리움","relatedRaw":"[]","attractionId":null,"matchMethod":"NONE","targets":[]}
            ]}
        """.trimIndent()
        Then("달 · 출발 · 대상 순위와 매칭이 그대로 유스케이스로 간다") {
            val items = slot<List<SyncAttractionRelatedUseCase.Item>>()
            every { useCase.replaceSigungu("26350", "202608", capture(items)) } returns SyncAttractionRelatedUseCase.Applied(2, 1, 0)

            controller.replace("26350", json.readValue<RelatedRequest>(body)).data!!.linked shouldBe 1

            items.captured.map { it.tAtsNm } shouldBe listOf("해운대해수욕장", "SEA LIFE 부산아쿠아리움")
            items.captured[0].attractionId shouldBe 501L
            items.captured[0].targets.map { Triple(it.rank, it.attractionId, it.matchMethod) } shouldBe
                listOf(Triple(1, 601L, "NORMALIZED"), Triple(2, null, "NONE"))
            items.captured[0].targets[0].scls shouldBe "자연경관(하천/해양)"
            items.captured[1].targets shouldBe emptyList()
        }
    }

    Given("수집기가 상태를 물을 때") {
        Then("place_client.related_state 가 읽는 이름(sigungu)으로 나간다") {
            every { useCase.state() } returns mapOf("26350" to "202608")
            val out = json.readTree(json.writeValueAsString(controller.state().data))
            out.path("sigungu").path("26350").asString() shouldBe "202608"
        }
    }
})
