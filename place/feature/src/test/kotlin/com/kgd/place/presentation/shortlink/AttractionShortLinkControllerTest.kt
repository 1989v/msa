package com.kgd.place.presentation.shortlink

import com.kgd.common.shortlink.ShortCode
import com.kgd.common.shortlink.ShortLinkProperties
import com.kgd.common.shortlink.ShortLinks
import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.application.shortlink.port.AttractionShortLinkClick
import com.kgd.place.application.shortlink.port.AttractionShortLinkClickRepositoryPort
import com.kgd.place.application.shortlink.service.AttractionShortLinkService
import com.kgd.place.domain.attraction.model.Attraction
import com.kgd.place.presentation.shortlink.controller.AttractionShortLinkController
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.mock.web.MockHttpServletRequest

/**
 * `/p/{code}` 리다이렉터. 컨트롤러를 직접 만들고 실제 해석 서비스·실제 `ShortLinks` 를 붙인다 —
 * 저장소 포트만 목이다. 판정은 컨트롤러가 내놓은 응답과 포트가 받은 값으로 한다.
 */
class AttractionShortLinkControllerTest : BehaviorSpec({

    val attractionId = 4321L
    val code = ShortCode.encode(attractionId)
    val browser = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
    val home = "https://place.1989v.com/"

    fun attraction(lang: String = "ko", status: String = "ACTIVE") = Attraction.create(
        contentId = "126508", lang = lang, title = "경복궁",
        latitude = 37.5788, longitude = 126.9770,
    ).apply { this.status = status }

    class Fixture(
        val controller: AttractionShortLinkController,
        val attractions: AttractionRepositoryPort,
        val clicks: AttractionShortLinkClickRepositoryPort,
    )

    // 블록마다 새 목 — 공유하면 앞 블록의 호출이 뒤 블록의 verify 를 오염시킨다
    fun fixture(found: Attraction? = attraction(), recordFails: Boolean = false): Fixture {
        val attractions = mockk<AttractionRepositoryPort>()
        val clicks = mockk<AttractionShortLinkClickRepositoryPort>()
        every { attractions.findById(any()) } returns null
        every { attractions.findById(attractionId) } returns found
        if (recordFails) {
            every { clicks.record(any()) } throws IllegalStateException("DB down")
        } else {
            every { clicks.record(any()) } returns Unit
        }
        val service = AttractionShortLinkService(attractions, clicks, ShortLinks(ShortLinkProperties()))
        return Fixture(AttractionShortLinkController(service, service), attractions, clicks)
    }

    fun get(uri: String, query: String? = null) = MockHttpServletRequest("GET", uri).apply { queryString = query }

    fun ResponseEntity<Void>.location() = headers.getFirst(HttpHeaders.LOCATION)

    given("ACTIVE 인 국문 관광지의 코드로 들어오면") {
        val f = fixture()
        val request = get("/p/$code", query = "utm_source=x").apply {
            serverName = "evil.example"
            addHeader("X-Forwarded-Host", "evil.example")
        }
        val response = f.controller.open(request, "https://open.kakao.com/o/abc?x=1", browser)

        then("302 로 국문 상세로 보낸다 — 요청 쿼리·호스트는 쓰지 않는다") {
            response.statusCode shouldBe HttpStatus.FOUND
            response.location() shouldBe "https://place.1989v.com/attractions/4321"
        }

        then("캐시·색인을 막는 헤더가 붙는다") {
            response.headers.getFirst(HttpHeaders.CACHE_CONTROL) shouldBe "no-store"
            response.headers.getFirst("X-Robots-Tag") shouldBe "noindex, nofollow"
        }

        then("관광지 id 로 한 번 적재하고, 리퍼러는 호스트만·UA 는 계열만 넘긴다") {
            val click = slot<AttractionShortLinkClick>()
            verify(exactly = 1) { f.clicks.record(capture(click)) }
            click.captured.attractionId shouldBe attractionId
            click.captured.referrerHost shouldBe "open.kakao.com"
            click.captured.uaFamily shouldBe "mobile"
        }
    }

    given("영문 행이면") {
        val f = fixture(found = attraction(lang = "en"))

        then("영문 상세 `/en/attractions/{id}` 로 보낸다") {
            f.controller.open(get("/p/$code"), null, browser).location() shouldBe
                "https://place.1989v.com/en/attractions/4321"
        }
    }

    given("ACTIVE 가 아닌 관광지면") {
        then("place 홈으로 보내고 세지 않는다") {
            listOf("INACTIVE", "DELETED", "active").forEach { status ->
                val f = fixture(found = attraction(status = status))
                withClue(status) { f.controller.open(get("/p/$code"), null, browser).location() shouldBe home }
                verify(exactly = 0) { f.clicks.record(any()) }
            }
        }
    }

    given("해석에 실패하는 경로면") {
        val cases = mapOf(
            "없는 관광지" to "/p/${ShortCode.encode(attractionId + 1)}",
            "형식 오류" to "/p/not-a-code",
            "대소문자만 바꾼 코드" to "/p/${code.map { if (it.isUpperCase()) it.lowercaseChar() else it.uppercaseChar() }.joinToString("")}",
            "세그먼트가 더 붙은 경로" to "/p/$code/extra",
        )

        then("모두 place 홈으로 302 하고 세지 않는다") {
            cases.forEach { (name, uri) ->
                val f = fixture()
                val response = f.controller.open(get(uri), null, browser)
                response.statusCode shouldBe HttpStatus.FOUND
                withClue(name) { response.location() shouldBe home }
                verify(exactly = 0) { f.clicks.record(any()) }
            }
        }
    }

    given("코드 없는 경로·list 별칭이면") {
        then("`/p`·`/p/`·`/p/list` 모두 place 홈으로 가고 저장소를 보지 않는다") {
            listOf("/p", "/p/", "/p/list").forEach { uri ->
                val f = fixture()
                withClue(uri) { f.controller.open(get(uri), null, browser).location() shouldBe home }
                verify(exactly = 0) { f.attractions.findById(any()) }
            }
        }
    }

    given("크롤러·미리보기 봇이 열면") {
        val f = fixture()
        val kakaoScrap = "facebookexternalhit/1.1; kakaotalk-scrap/1.0; +https://devtalk.kakao.com/"
        val response = f.controller.open(get("/p/$code"), null, kakaoScrap)

        then("목적지로 보내되 세지 않는다") {
            response.location() shouldBe "https://place.1989v.com/attractions/4321"
            verify(exactly = 0) { f.clicks.record(any()) }
        }
    }

    given("클릭 적재가 실패하면") {
        val f = fixture(recordFails = true)
        val response = f.controller.open(get("/p/$code"), null, browser)

        then("그래도 목적지로 302 한다") {
            response.statusCode shouldBe HttpStatus.FOUND
            response.location() shouldBe "https://place.1989v.com/attractions/4321"
        }
    }
})
