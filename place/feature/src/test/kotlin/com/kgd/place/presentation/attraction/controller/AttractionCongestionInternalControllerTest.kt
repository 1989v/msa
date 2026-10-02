package com.kgd.place.presentation.attraction.controller

import com.kgd.place.application.attraction.usecase.SyncAttractionCongestionUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import tools.jackson.module.kotlin.jacksonObjectMapper
import tools.jackson.module.kotlin.readValue
import java.time.LocalDate

/** 수집기(place-ingest `congestion.record`)가 보내는 JSON 모양 그대로 요청 DTO 로 읽혀 유스케이스에 닿는지. */
class AttractionCongestionInternalControllerTest : BehaviorSpec({
    val useCase = mockk<SyncAttractionCongestionUseCase>()
    val controller = AttractionCongestionInternalController(useCase)
    val json = jacksonObjectMapper()

    Given("수집기가 보낸 한 시군구의 집중률") {
        // 원천 키 이름(tAtsNm — 둘째 글자가 대문자)이 그대로 필드 이름이다
        val body = """
            {"items":[
              {"tAtsNm":"해운대해수욕장","areaCd":"26","areaNm":"부산광역시","signguNm":"해운대구",
               "ratesRaw":"[{\"baseYmd\":\"20261002\",\"cnctrRate\":\"47.16\"}]","firstYmd":"2026-10-02","lastYmd":"2026-10-31",
               "attractionId":501,"matchMethod":"EXACT"},
              {"tAtsNm":"SEA LIFE 부산아쿠아리움","areaCd":"26","areaNm":"부산광역시","signguNm":"해운대구",
               "ratesRaw":"[]","firstYmd":"2026-10-02","lastYmd":"2026-10-31","attractionId":null,"matchMethod":"NONE"}
            ]}
        """.trimIndent()
        Then("이름 · 날짜 · 매칭이 그대로 유스케이스로 간다") {
            val items = slot<List<SyncAttractionCongestionUseCase.Item>>()
            every { useCase.replaceSigungu("26350", capture(items)) } returns SyncAttractionCongestionUseCase.Applied(2, 1, 0)

            controller.replace("26350", json.readValue<CongestionRequest>(body)).data!!.linked shouldBe 1

            items.captured.map { it.tAtsNm } shouldBe listOf("해운대해수욕장", "SEA LIFE 부산아쿠아리움")
            items.captured[0].firstYmd shouldBe LocalDate.of(2026, 10, 2)
            items.captured[0].attractionId shouldBe 501L
            items.captured[1].attractionId shouldBe null
            items.captured[1].matchMethod shouldBe "NONE"
        }
    }
})
