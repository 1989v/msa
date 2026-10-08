package com.kgd.analytics.presentation.event

import com.kgd.analytics.application.event.usecase.CollectEventsUseCase
import com.kgd.analytics.presentation.event.controller.EventCollectController
import com.kgd.common.analytics.AnalyticsEvent
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.databind.ObjectMapper
import tools.jackson.module.kotlin.jacksonMapperBuilder

/**
 * 수집 진입점이 **누구의 세션으로** 원장에 넣는지 본다 — 판정은 응답 코드와 유스케이스에 넘긴 이벤트 값이다.
 *
 * 비크롤러 케이스는 사람 브라우저 UA 를 반드시 싣는다. MockMvc 기본 요청에는 UA 가 없고
 * `CrawlerUserAgents.isCrawler(null)` 이 true 라, 빠뜨리면 전부 202/accepted 0 으로 통과해 검사가 비어 버린다.
 */
class EventCollectControllerTest : BehaviorSpec({

    val json = ObjectMapper()
    val humanUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    val oneEvent =
        """{"entityType":"ATTRACTION","entityId":"1","action":"CLICK","screenType":"PLACE_HUB","sectionId":"ATTRACTION_LIST","viewId":"v1"}"""

    /** 케이스마다 새로 만든다 — `verify(exactly = 0)` 이 앞 케이스의 호출을 세면 안 된다. */
    class Harness {
        val collect = mockk<CollectEventsUseCase>()
        val saved = slot<List<AnalyticsEvent>>()
        val mvc: MockMvc = MockMvcBuilders.standaloneSetup(EventCollectController(collect))
            .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))
            .setControllerAdvice(com.kgd.common.exception.GlobalExceptionHandler())
            .build()

        init {
            every { collect.collect(capture(saved)) } answers { saved.captured.size }
        }

        fun send(body: String, userAgent: String? = humanUa, vararg headers: Pair<String, String>): MockHttpServletResponse =
            mvc.perform(
                post("/api/v1/events").contentType(MediaType.APPLICATION_JSON).content(body).apply {
                    userAgent?.let { header("User-Agent", it) }
                    headers.forEach { (name, value) -> header(name, value) }
                },
            ).andReturn().response
    }

    given("X-Session-Id 헤더가 있으면") {
        val h = Harness()
        val res = h.send("""{"events":[$oneEvent],"sessionId":"sb"}""", humanUa, "X-Session-Id" to "s1")
        then("202 이고 헤더 세션이 본문보다 앞선다") {
            res.status shouldBe 202
            json.readTree(res.contentAsString)["data"]["accepted"].asInt() shouldBe 1
            h.saved.captured.single().sessionId shouldBe "s1"
        }
    }

    given("헤더 없이 beacon 모양 본문(events + visitorId + sessionId)이 오면") {
        val h = Harness()
        val res = h.send("""{"events":[$oneEvent],"visitorId":"vx","sessionId":"sb"}""")
        then("거절하지 않고 본문 세션을 쓴다 — 본문 visitorId 는 무시한다") {
            res.status shouldBe 202
            val event = h.saved.captured.single()
            event.sessionId shouldBe "sb"
            event.visitorId shouldBe "anonymous"
        }
    }

    given("세션이 헤더에도 본문에도 없으면") {
        val h = Harness()
        val res = h.send("""{"events":[$oneEvent]}""", humanUa, "X-Visitor-Id" to "v9")
        then("방문자 키가 세션이 된다") {
            res.status shouldBe 202
            val event = h.saved.captured.single()
            event.sessionId shouldBe "v9"
            event.visitorId shouldBe "v9"
        }
    }

    given("X-User-Id 헤더를 실어 보내도") {
        val h = Harness()
        val res = h.send("""{"events":[$oneEvent]}""", humanUa, "X-User-Id" to "1")
        then("userId 는 null 이다 — 인증 필터를 거치지 않는 라우트라 클라이언트 값을 믿지 않는다") {
            res.status shouldBe 202
            h.saved.captured.single().userId.shouldBeNull()
        }
    }

    given("크롤러 UA(HeadlessChrome)면") {
        val h = Harness()
        val res = h.send("""{"events":[$oneEvent]}""", "Mozilla/5.0 HeadlessChrome/130")
        then("202 에 accepted 0 이고 원장에는 넣지 않는다") {
            res.status shouldBe 202
            json.readTree(res.contentAsString)["data"]["accepted"].asInt() shouldBe 0
            verify(exactly = 0) { h.collect.collect(any()) }
        }
    }

    given("events 가 상한(100)을 넘으면") {
        val h = Harness()
        val res = h.send("""{"events":[${List(101) { oneEvent }.joinToString(",")}]}""")
        then("400 이고 본문은 ApiResponse 실패 모양이다") {
            res.status shouldBe 400
            val body = json.readTree(res.contentAsString)
            body["success"].asBoolean() shouldBe false
            body["error"]["code"].asText() shouldBe "INVALID_INPUT"
            verify(exactly = 0) { h.collect.collect(any()) }
        }
    }
})
