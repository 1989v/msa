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

class AttractionPageServiceTest : BehaviorSpec({
    val searchPort = mockk<AttractionSearchPort>()
    val shellPort = mockk<AttractionShellPort>()
    val renderPort = mockk<AttractionPageRenderPort>()
    val service = AttractionPageService(searchPort, shellPort, renderPort)

    val doc = AttractionDocument(id = "1001", contentId = "126508", lang = "ko", title = "경복궁", latitude = 37.5, longitude = 127.0)

    beforeTest {
        clearMocks(searchPort, shellPort, renderPort)
        every { shellPort.shell() } returns "SHELL"
        every { renderPort.attractionPage("SHELL", doc) } returns "PAGE"
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
