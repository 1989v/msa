package com.kgd.search.application.attraction.service

import com.kgd.search.application.attraction.port.AttractionPageRenderPort
import com.kgd.search.application.attraction.port.AttractionShellPort
import com.kgd.search.application.attraction.usecase.RenderAttractionPageUseCase
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.io.IOException
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

class AttractionPageServiceTest : BehaviorSpec({
    val searchPort = mockk<AttractionSearchPort>()
    val shellPort = mockk<AttractionShellPort>()
    val renderPort = mockk<AttractionPageRenderPort>()
    // UTC 로는 10월 1일 15:30 — KST 로는 10월 2일 00:30. UTC 날짜를 넘기면 하루 늦게 판정한다
    val clock = Clock.fixed(Instant.parse("2026-10-01T15:30:00Z"), ZoneOffset.UTC)
    val todayKst = LocalDate.of(2026, 10, 2)
    val service = AttractionPageService(searchPort, shellPort, renderPort, clock)

    val doc = AttractionDocument(id = "1001", contentId = "126508", lang = "ko", title = "경복궁", latitude = 37.5, longitude = 127.0)

    beforeTest {
        clearMocks(searchPort, shellPort, renderPort)
        every { shellPort.shell() } returns "SHELL"
        every { renderPort.attractionPage("SHELL", doc, todayKst) } returns "PAGE"
        every { renderPort.notFoundPage("SHELL", any()) } returns "NOT_FOUND"
        every { renderPort.fallbackPage("SHELL") } returns "RAW_SHELL"
    }

    given("색인에 있는 관광지") {
        `when`("렌더하면") {
            then("문서를 한 번만 조회하고 그 문서로 페이지를 만든다") {
                every { searchPort.findById("1001") } returns doc

                val page = service.render(RenderAttractionPageUseCase.Query("1001", "ko"))

                page.shouldBeInstanceOf<RenderAttractionPageUseCase.Page.Found>()
                page.html shouldBe "PAGE"
                verify(exactly = 1) { searchPort.findById(any()) }
            }

            then("렌더 포트에 시계로 계산한 KST 오늘을 넘긴다 — 렌더러는 시계를 읽지 않는다") {
                every { searchPort.findById("1001") } returns doc

                service.render(RenderAttractionPageUseCase.Query("1001", "ko"))

                verify(exactly = 1) { renderPort.attractionPage("SHELL", doc, todayKst) }
            }
        }
    }

    given("색인에 없는 관광지") {
        `when`("렌더하면") {
            then("경로 언어의 404 페이지를 낸다") {
                every { searchPort.findById("42") } returns null

                val page = service.render(RenderAttractionPageUseCase.Query("42", "en"))

                page.shouldBeInstanceOf<RenderAttractionPageUseCase.Page.NotFound>()
                verify(exactly = 1) { searchPort.findById(any()) }
                verify(exactly = 1) { renderPort.notFoundPage("SHELL", "en") }
            }
        }
    }

    given("조회가 실패할 때") {
        `when`("렌더하면") {
            then("예외를 내지 않고 셸을 그대로 200 으로 낸다 — 재시도하지 않는다") {
                every { searchPort.findById("1001") } throws IOException("opensearch down")

                val page = service.render(RenderAttractionPageUseCase.Query("1001", "ko"))

                page.shouldBeInstanceOf<RenderAttractionPageUseCase.Page.Fallback>()
                page.html shouldBe "RAW_SHELL"
                verify(exactly = 1) { searchPort.findById(any()) }
            }
        }
    }
})
