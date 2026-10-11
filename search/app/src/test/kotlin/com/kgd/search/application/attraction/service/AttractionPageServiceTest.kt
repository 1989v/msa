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

    given("경로 언어와 문서 언어가 어긋날 때") {
        fun redirectOf(docLang: String, pathLang: String, target: AttractionDocument = doc.copy(lang = docLang)) =
            run {
                every { searchPort.findById(target.id) } returns target
                service.render(RenderAttractionPageUseCase.Query(target.id, pathLang))
            }

        `when`("국문 경로로 영문 문서를 받으면") {
            then("문서 언어(en)로 옮기라는 결과이고 조회는 한 번 · 렌더하지 않는다") {
                val page = redirectOf(docLang = "en", pathLang = "ko")

                page shouldBe RenderAttractionPageUseCase.Page.Redirect("en", "1001")
                verify(exactly = 1) { searchPort.findById(any()) }
                verify(exactly = 0) { renderPort.attractionPage(any(), any(), any()) }
            }
        }

        `when`("영문 경로로 국문 문서를 받으면") {
            then("문서 언어(ko)로 옮기라는 결과다") {
                redirectOf(docLang = "ko", pathLang = "en") shouldBe RenderAttractionPageUseCase.Page.Redirect("ko", "1001")
            }
        }

        `when`("영문 짝(alternateId)이 있는 국문 문서를 영문 경로로 받으면") {
            then("짝이 아니라 문서 자신의 id 로 옮긴다") {
                val paired = doc.copy(alternateId = "6001")

                redirectOf(docLang = "ko", pathLang = "en", target = paired) shouldBe
                    RenderAttractionPageUseCase.Page.Redirect("ko", "1001")
            }
        }

        `when`("행사 문서가 어긋나면") {
            then("상세와 같은 규칙으로 옮긴다") {
                val event = doc.copy(id = "5001", contentTypeId = "15")

                redirectOf(docLang = "ko", pathLang = "en", target = event) shouldBe
                    RenderAttractionPageUseCase.Page.Redirect("ko", "5001")
            }
        }

        `when`("en 이 아닌 언어(xx) 문서를 국문 경로로 받으면") {
            then("국문으로 보아 옮기지 않고 렌더한다 — 정규화 없이 비교하면 어느 경로에서도 어긋나 루프가 된다") {
                val xx = doc.copy(lang = "xx")
                every { renderPort.attractionPage("SHELL", xx, todayKst) } returns "PAGE_XX"

                val page = redirectOf(docLang = "xx", pathLang = "ko", target = xx)

                page shouldBe RenderAttractionPageUseCase.Page.Found("PAGE_XX")
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
