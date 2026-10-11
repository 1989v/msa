package com.kgd.search.presentation.render.controller

import com.kgd.search.application.attraction.port.AttractionShellPort
import com.kgd.search.application.attraction.service.AttractionPageService
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import com.kgd.search.infrastructure.config.AttractionRenderProperties
import com.kgd.search.infrastructure.render.AttractionPageFixtures
import com.kgd.search.infrastructure.render.AttractionPageRenderer
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
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
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

/**
 * 실제 서비스·렌더러를 붙이고 포트(색인·셸)만 대역으로 둔다 — 상태 코드·헤더·본문을 응답에서 읽는다.
 */
class AttractionPageControllerTest : BehaviorSpec({
    val searchPort = mockk<AttractionSearchPort>()
    val shellPort = object : AttractionShellPort {
        override fun shell() = AttractionPageFixtures.SHELL
    }
    val renderer = AttractionPageRenderer(AttractionRenderProperties(), ObjectMapper())
    val service = AttractionPageService(
        searchPort, shellPort, renderer,
        Clock.fixed(Instant.parse("2026-10-08T03:00:00Z"), ZoneOffset.UTC),
    )
    val mvc = MockMvcBuilders.standaloneSetup(AttractionPageController(service, renderer)).build()
    val locationShape = Regex("^/(en/)?attractions/\\d{1,12}$")

    fun call(path: String): MvcResult = mvc.perform(get(path)).andReturn()
    fun MvcResult.body(): String = response.getContentAsString(Charsets.UTF_8)
    fun callIfNoneMatch(path: String, etag: String): MvcResult =
        mvc.perform(get(path).header("If-None-Match", etag)).andReturn()

    /** 첫 응답이 내준 ETag 를 그대로 읽는다 — 테스트가 해시를 다시 계산하지 않는다. */
    fun etagOf(path: String): String = call(path).response.getHeader("ETag").shouldNotBeNull()

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
            then("301 · Location 은 문서 언어(국문) 경로만 · 본문·ETag 없음 · 재검증 캐시 헤더") {
                every { searchPort.findById("1001") } returns AttractionPageFixtures.doc()

                val result = call("/internal/render/en/attractions/1001")

                result.response.status shouldBe 301
                result.response.getHeader("Location") shouldBe "/attractions/1001"
                result.response.contentAsByteArray.size shouldBe 0
                result.response.getHeader("ETag") shouldBe null
                result.response.getHeader("Cache-Control") shouldBe "no-cache, must-revalidate"
            }
        }

        `when`("국문 경로로 영문 문서를 요청하면") {
            then("301 · Location 은 영문 경로") {
                every { searchPort.findById("6001") } returns AttractionPageFixtures.doc(id = "6001", lang = "en")

                val result = call("/internal/render/attractions/6001")

                result.response.status shouldBe 301
                result.response.getHeader("Location") shouldBe "/en/attractions/6001"
                result.response.getHeader("Location")!!.matches(locationShape) shouldBe true
            }
        }

        `when`("영문 짝이 있는 국문 문서를 영문 경로로 요청하면") {
            then("짝이 아니라 문서 자신의 국문 경로로 301") {
                every { searchPort.findById("1001") } returns AttractionPageFixtures.doc().copy(alternateId = "6001")

                val result = call("/internal/render/en/attractions/1001")

                result.response.status shouldBe 301
                result.response.getHeader("Location") shouldBe "/attractions/1001"
            }
        }

        `when`("행사 문서를 어긋난 언어 경로로 요청하면") {
            then("상세와 같이 301") {
                every { searchPort.findById("5001") } returns AttractionPageFixtures.event()

                val result = call("/internal/render/en/attractions/5001")

                result.response.status shouldBe 301
                result.response.getHeader("Location") shouldBe "/attractions/5001"
            }
        }

        `when`("en 이 아닌 언어(xx) 문서를 국문 경로로 요청하면") {
            then("국문으로 보아 200 렌더 — 이동하지 않는다") {
                every { searchPort.findById("1001") } returns AttractionPageFixtures.doc(lang = "xx")

                val result = call("/internal/render/attractions/1001")

                result.response.status shouldBe 200
                result.response.getHeader("Location") shouldBe null
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

    given("있는 관광지의 ETag") {
        val path = "/internal/render/attractions/1001"

        `when`("200 응답이면") {
            then("ETag 를 단다") {
                every { searchPort.findById("1001") } returns AttractionPageFixtures.doc()

                val result = call(path)

                result.response.status shouldBe 200
                result.response.getHeader("ETag").shouldNotBeNull()
            }
        }

        `when`("첫 응답의 ETag 를 If-None-Match 로 다시 보내면") {
            then("304 · 본문 없음 · ETag·Cache-Control·X-Render 유지") {
                every { searchPort.findById("1001") } returns AttractionPageFixtures.doc()
                val etag = etagOf(path)

                val result = callIfNoneMatch(path, etag)

                result.response.status shouldBe 304
                result.response.contentAsByteArray.size shouldBe 0
                result.response.getHeader("ETag") shouldBe etag
                result.response.getHeader("Cache-Control") shouldBe "no-cache, must-revalidate"
                result.response.getHeader("X-Render") shouldBe "ssr"
            }
        }

        `when`("nginx gzip 이 약하게 바꾼 W/ 값을 보내면") {
            then("약한 비교로 304") {
                every { searchPort.findById("1001") } returns AttractionPageFixtures.doc()
                val etag = etagOf(path)

                callIfNoneMatch(path, "W/$etag").response.status shouldBe 304
            }
        }

        `when`("다른 값을 보내면") {
            then("200 과 본문") {
                every { searchPort.findById("1001") } returns AttractionPageFixtures.doc()

                val result = callIfNoneMatch(path, "\"0000000000000000\"")

                result.response.status shouldBe 200
                result.body() shouldContain "<h1>경복궁</h1>"
            }
        }

        `when`("같은 id 문서의 개요만 바뀐 뒤 옛 ETag 를 보내면") {
            then("200 · 새 개요 · 다른 ETag") {
                every { searchPort.findById("1001") } returnsMany listOf(
                    AttractionPageFixtures.doc(),
                    AttractionPageFixtures.doc(overview = "개요를 고쳐 다시 색인했다."),
                )
                val oldEtag = etagOf(path)

                val result = callIfNoneMatch(path, oldEtag)

                result.response.status shouldBe 200
                result.body() shouldContain "개요를 고쳐 다시 색인했다."
                result.response.getHeader("ETag").shouldNotBeNull() shouldNotBe oldEtag
            }
        }

        `when`("같은 언어 경로로 같은 문서를 두 번 받으면") {
            then("본문이 같으므로 ETag 도 같다 — 영문 문서의 영문 경로도 ETag 를 단다") {
                every { searchPort.findById("1001") } returns AttractionPageFixtures.doc()
                every { searchPort.findById("6001") } returns AttractionPageFixtures.doc(id = "6001", lang = "en")

                etagOf(path) shouldBe etagOf(path)
                etagOf("/internal/render/en/attractions/6001") shouldBe etagOf("/internal/render/en/attractions/6001")
            }
        }

        `when`("언어가 다른 두 문서를 받으면") {
            then("ETag 가 다르다") {
                every { searchPort.findById("1001") } returns AttractionPageFixtures.doc()
                every { searchPort.findById("6001") } returns AttractionPageFixtures.doc(id = "6001", lang = "en")

                etagOf(path) shouldNotBe etagOf("/internal/render/en/attractions/6001")
            }
        }
    }

    given("ETag 를 달지 않는 응답") {
        `when`("색인 조회가 실패할 때 정상 ETag 를 보내면") {
            then("200 · 셸 본문 · ETag 없음") {
                every { searchPort.findById("1001") } returns AttractionPageFixtures.doc()
                val etag = etagOf("/internal/render/attractions/1001")
                every { searchPort.findById("1001") } throws RuntimeException("opensearch down")

                val result = callIfNoneMatch("/internal/render/attractions/1001", etag)

                result.response.status shouldBe 200
                result.body() shouldBe AttractionPageFixtures.SHELL
                result.response.getHeader("X-Render") shouldBe "shell-fallback"
                result.response.getHeader("ETag") shouldBe null
            }
        }

        `when`("없는 관광지에 정상 ETag 를 보내면") {
            then("404 · ETag 없음") {
                every { searchPort.findById("1001") } returns AttractionPageFixtures.doc()
                val etag = etagOf("/internal/render/attractions/1001")
                every { searchPort.findById("424242") } returns null

                val result = callIfNoneMatch("/internal/render/attractions/424242", etag)

                result.response.status shouldBe 404
                result.body() shouldContain "noindex"
                result.response.getHeader("ETag") shouldBe null
            }
        }
    }
})
