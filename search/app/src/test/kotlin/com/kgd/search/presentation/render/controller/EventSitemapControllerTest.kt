package com.kgd.search.presentation.render.controller

import com.kgd.search.application.attraction.service.EventSitemapService
import com.kgd.search.domain.attraction.model.EventPeriod
import com.kgd.search.domain.attraction.model.EventSitemapEntry
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import com.kgd.search.infrastructure.config.AttractionRenderProperties
import com.kgd.search.infrastructure.render.EventSitemapRenderer
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.string.shouldStartWith
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import java.net.SocketTimeoutException
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/** 실제 서비스·렌더러를 붙이고 색인 포트만 대역으로 둔다 — 상태 코드·헤더·본문을 응답에서 읽는다. */
class EventSitemapControllerTest : BehaviorSpec({
    val searchPort = mockk<AttractionSearchPort>()
    // 2026-10-02 KST
    val clock = Clock.fixed(Instant.parse("2026-10-02T03:00:00Z"), ZoneOffset.UTC)
    val today = LocalDate.of(2026, 10, 2)
    val service = EventSitemapService(searchPort, EventSitemapRenderer(AttractionRenderProperties()), clock)
    val mvc = MockMvcBuilders.standaloneSetup(EventSitemapController(service)).build()

    fun call(): MvcResult = mvc.perform(get("/internal/render/sitemap/events.xml")).andReturn()
    fun MvcResult.body(): String = response.getContentAsString(Charsets.UTF_8)
    fun ended(id: String, daysAgo: Long) = EventSitemapEntry(
        id = id, lang = "ko", period = EventPeriod(today.minusDays(daysAgo + 2), today.minusDays(daysAgo)),
        hasOverview = true, modifiedAt = null,
    )

    beforeTest { clearMocks(searchPort) }

    given("조회 성공") {
        then("200 · application/xml · 종료 +30일은 있고 +31일은 없다") {
            every { searchPort.findEvents(any()) } returns listOf(ended("8030", 30), ended("8031", 31))

            val result = call()

            result.response.status shouldBe 200
            result.response.contentType!! shouldStartWith "application/xml"
            result.body() shouldContain "<loc>https://place.1989v.com/attractions/8030</loc>"
            result.body() shouldNotContain "8031"
        }
    }

    given("조회 실패") {
        then("503 이고 urlset 을 내지 않는다 · 앞단 캐시가 오류를 붙잡지 않게 no-store") {
            every { searchPort.findEvents(any()) } throws SocketTimeoutException("read timed out")

            val result = call()

            result.response.status shouldBe 503
            result.body() shouldNotContain "urlset"
            result.response.getHeader("Cache-Control") shouldBe "no-store"
        }
    }
})
