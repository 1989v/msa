package com.kgd.search.presentation.render.controller

import com.kgd.search.application.attraction.port.AttractionShellPort
import com.kgd.search.application.attraction.service.AttractionPageService
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import com.kgd.search.infrastructure.config.AttractionRenderProperties
import com.kgd.search.infrastructure.render.AttractionPageFixtures
import com.kgd.search.infrastructure.render.AttractionPageRenderer
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.string.shouldStartWith
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.databind.ObjectMapper

/**
 * 실제 서비스·렌더러를 붙이고 포트(색인·셸)만 대역으로 둔다 — 상태 코드·헤더·본문을 응답에서 읽는다.
 */
class AttractionPageControllerTest : BehaviorSpec({
    val searchPort = mockk<AttractionSearchPort>()
    val shellPort = object : AttractionShellPort {
        override fun shell() = AttractionPageFixtures.SHELL
    }
    val service = AttractionPageService(
        searchPort, shellPort, AttractionPageRenderer(AttractionRenderProperties(), ObjectMapper()),
    )
    val mvc = MockMvcBuilders.standaloneSetup(AttractionPageController(service)).build()

    fun call(path: String): MvcResult = mvc.perform(get(path)).andReturn()
    fun MvcResult.body(): String = response.getContentAsString(Charsets.UTF_8)

    beforeTest { clearMocks(searchPort) }

    given("있는 관광지") {
        `when`("국문 경로로 요청하면") {
            then("200 · HTML · 서버 렌더 표지 · 재검증 캐시 헤더") {
                every { searchPort.findById("1001") } returns AttractionPageFixtures.doc()

                val result = call("/internal/render/attractions/1001")

                result.response.status shouldBe 200
                result.response.contentType!! shouldStartWith "text/html"
                result.response.getHeader("X-Render") shouldBe "ssr"
                result.response.getHeader("Cache-Control") shouldBe "no-cache, must-revalidate"
                result.body() shouldContain "<h1>경복궁</h1>"
            }
        }

        `when`("영문 경로로 국문 문서를 요청하면") {
            then("canonical 은 문서 언어(국문) 경로다") {
                every { searchPort.findById("1001") } returns AttractionPageFixtures.doc()

                val body = call("/internal/render/en/attractions/1001").body()

                body shouldContain """<link rel="canonical" href="https://place.1989v.com/attractions/1001" />"""
                body shouldNotContain "/en/attractions/1001"
            }
        }
    }

    given("없는 관광지") {
        `when`("요청하면") {
            then("404 HTML 이고 요청 id 를 되돌려 쓰지 않는다") {
                every { searchPort.findById("424242") } returns null

                val result = call("/internal/render/attractions/424242")

                result.response.status shouldBe 404
                result.response.getHeader("X-Render") shouldBe "ssr"
                result.body() shouldContain "noindex"
                result.body() shouldNotContain "424242"
            }
        }
    }

    given("형식이 틀린 id") {
        `when`("숫자가 아니거나 13자리 이상이면") {
            then("조회 없이 404 이고 요청 값을 되돌려 쓰지 않는다") {
                listOf("abc%3Csvg%3E" to "svg", "1234567890123" to "1234567890123", "12a" to "12a").forEach { (raw, echo) ->
                    val result = call("/internal/render/attractions/$raw")
                    result.response.status shouldBe 404
                    result.body() shouldNotContain echo
                }
                verify(exactly = 0) { searchPort.findById(any()) }
            }
        }
    }

    given("색인 조회가 실패할 때") {
        `when`("요청하면") {
            then("셸을 그대로 200 으로 내고 서버 렌더 표지와 구분되는 값을 단다") {
                every { searchPort.findById("1001") } throws RuntimeException("opensearch down")

                val result = call("/internal/render/attractions/1001")

                result.response.status shouldBe 200
                result.body() shouldBe AttractionPageFixtures.SHELL
                result.response.getHeader("X-Render") shouldBe "shell-fallback"
            }
        }
    }
})
