package com.kgd.search.presentation.render.controller

import com.kgd.search.application.attraction.service.AttractionFeedService
import com.kgd.search.domain.attraction.model.AttractionFeedEntry
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import com.kgd.search.infrastructure.config.AttractionRenderProperties
import com.kgd.search.infrastructure.render.AttractionFeedRenderer
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
import java.net.SocketTimeoutException
import java.time.LocalDateTime

/** 실제 서비스·렌더러를 붙이고 색인 포트만 대역으로 둔다 — 상태 코드·헤더·본문을 응답에서 읽는다. */
class AttractionFeedControllerTest : BehaviorSpec({
    val searchPort = mockk<AttractionSearchPort>()
    val service = AttractionFeedService(searchPort, AttractionFeedRenderer(AttractionRenderProperties()))
    val mvc = MockMvcBuilders.standaloneSetup(AttractionFeedController(service)).build()

    fun call(path: String): MvcResult = mvc.perform(get(path)).andReturn()
    fun MvcResult.body(): String = response.getContentAsString(Charsets.UTF_8)
    fun entry(id: String, lang: String) =
        AttractionFeedEntry(id = id, lang = lang, title = "T$id", overview = null, contentUpdatedAt = LocalDateTime.of(2026, 10, 8, 9, 0))

    beforeTest { clearMocks(searchPort) }

    listOf("ko" to "https://place.1989v.com/attractions/11", "en" to "https://place.1989v.com/en/attractions/11").forEach { (lang, link) ->
        given("조회 성공 — $lang") {
            then("200 · application/rss+xml · 성공 캐시 헤더 · 그 언어의 항목") {
                every { searchPort.findRecentlyUpdated(lang, 50) } returns listOf(entry("11", lang))

                val result = call("/internal/render/feed/$lang.xml")

                result.response.status shouldBe 200
                result.response.contentType!! shouldStartWith "application/rss+xml"
                result.response.getHeader("Cache-Control") shouldBe "public, max-age=600"
                result.body() shouldContain "<link>$link</link>"
                result.body() shouldContain "<language>$lang</language>"
            }
        }
    }

    given("조회 실패") {
        then("503 이고 rss 를 내지 않는다 · 앞단 캐시가 오류를 붙잡지 않게 no-store") {
            every { searchPort.findRecentlyUpdated(any(), any()) } throws SocketTimeoutException("read timed out")

            val result = call("/internal/render/feed/ko.xml")

            result.response.status shouldBe 503
            result.body() shouldNotContain "<rss"
            result.response.getHeader("Cache-Control") shouldBe "no-store"
        }
    }

    given("모르는 언어") {
        then("404 · 색인을 묻지 않는다") {
            val result = call("/internal/render/feed/ja.xml")

            result.response.status shouldBe 404
            verify(exactly = 0) { searchPort.findRecentlyUpdated(any(), any()) }
        }
    }
})
