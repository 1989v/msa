package com.kgd.codedictionary.presentation.resume

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import com.kgd.codedictionary.application.resume.port.ResumeShareLinkRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeShortLinkClickRepositoryPort
import com.kgd.codedictionary.application.resume.service.ResumeShortLinkService
import com.kgd.codedictionary.domain.resume.model.ResumeShareLink
import com.kgd.codedictionary.presentation.resume.controller.ResumeShortLinkController
import com.kgd.common.shortlink.ShortLinkProperties
import com.kgd.common.shortlink.ShortLinks
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldNotContain
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.slf4j.LoggerFactory
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.mock.web.MockHttpServletRequest
import java.time.LocalDateTime

/**
 * `/r/{code}` 리다이렉터. 컨트롤러를 직접 만들고 실제 해석 서비스·실제 `ShortLinks` 를 붙인다 —
 * 저장소 포트만 목이다. 판정은 컨트롤러가 내놓은 응답과 포트가 받은 호출로 한다.
 */
class ResumeShortLinkControllerTest : BehaviorSpec({

    val code = "Ab3dE6gH9k"
    val token = "tok_-ABCDEFGHIJKLMNOPQRSTUVWXYZ012"
    val browser = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"

    fun link(revokedAt: LocalDateTime? = null) = ResumeShareLink.restore(
        id = 7L,
        token = token,
        shortCode = code,
        label = "OO사 백엔드",
        note = null,
        createdAt = LocalDateTime.now(),
        revokedAt = revokedAt,
    )

    class Fixture(
        val controller: ResumeShortLinkController,
        val links: ResumeShareLinkRepositoryPort,
        val clicks: ResumeShortLinkClickRepositoryPort,
    )

    // 블록마다 새 목 — 공유하면 앞 블록의 호출이 뒤 블록의 verify 를 오염시킨다
    fun fixture(found: ResumeShareLink? = link(), recordFails: Boolean = false): Fixture {
        val links = mockk<ResumeShareLinkRepositoryPort>()
        val clicks = mockk<ResumeShortLinkClickRepositoryPort>()
        every { links.findByShortCode(any()) } returns null
        every { links.findByShortCode(code) } returns found
        if (recordFails) {
            every { clicks.record(any(), any()) } throws IllegalStateException("DB down")
        } else {
            every { clicks.record(any(), any()) } returns Unit
        }
        val service = ResumeShortLinkService(links, clicks, ShortLinks(ShortLinkProperties()))
        return Fixture(ResumeShortLinkController(service, service), links, clicks)
    }

    fun get(uri: String, query: String? = null, userAgent: String? = browser) =
        MockHttpServletRequest("GET", uri).apply { queryString = query }.also { req ->
            userAgent?.let { req.addHeader(HttpHeaders.USER_AGENT, it) }
        }

    fun ResponseEntity<Void>.location() = headers.getFirst(HttpHeaders.LOCATION)

    val home = "https://resume.1989v.com/"

    given("쓸 수 있는 링크의 코드로 들어오면") {
        val f = fixture()
        val request = get("/r/$code", query = "k=evil&utm_source=x").apply {
            serverName = "evil.example"
            addHeader("X-Forwarded-Host", "evil.example")
        }
        val response = f.controller.open(request, browser)

        then("302 로 토큰을 붙인 resume 주소로 보낸다 — 요청 쿼리·호스트는 쓰지 않는다") {
            response.statusCode shouldBe HttpStatus.FOUND
            response.location() shouldBe "https://resume.1989v.com/?k=$token"
        }

        then("캐시·색인을 막는 헤더가 붙는다") {
            response.headers.getFirst(HttpHeaders.CACHE_CONTROL) shouldBe "no-store"
            response.headers.getFirst("X-Robots-Tag") shouldBe "noindex, nofollow"
        }

        then("링크 id 로 클릭을 한 번 적재한다") {
            verify(exactly = 1) { f.clicks.record(7L, any()) }
        }
    }

    given("폐기된 링크의 코드면") {
        val f = fixture(found = link(revokedAt = LocalDateTime.now().minusDays(1)))
        val response = f.controller.open(get("/r/$code"), browser)

        then("resume 홈으로 302 하고 세지 않는다") {
            response.statusCode shouldBe HttpStatus.FOUND
            response.location() shouldBe home
            verify(exactly = 0) { f.clicks.record(any(), any()) }
        }
    }

    given("해석에 실패하는 경로면") {
        val cases = mapOf(
            "없는 코드" to "/r/Zz9yX8wV7u",
            "대소문자만 바꾼 코드" to "/r/${code.uppercase()}",
            "길이가 다른 코드" to "/r/Ab3dE6gH9",
            "base62 밖 글자" to "/r/Ab3dE6gH9-",
            "세그먼트가 더 붙은 경로" to "/r/$code/extra",
        )

        then("모두 resume 홈으로 302 하고 세지 않는다") {
            cases.forEach { (name, uri) ->
                val f = fixture()
                val response = f.controller.open(get(uri), browser)
                response.statusCode shouldBe HttpStatus.FOUND
                withClue(name) { response.location() shouldBe home }
                verify(exactly = 0) { f.clicks.record(any(), any()) }
            }
        }
    }

    given("코드 없는 경로·list 별칭이면") {
        then("`/r`·`/r/`·`/r/list` 모두 resume 홈으로 간다") {
            listOf("/r", "/r/", "/r/list").forEach { uri ->
                val f = fixture()
                withClue(uri) { f.controller.open(get(uri), browser).location() shouldBe home }
                verify(exactly = 0) { f.links.findByShortCode(any()) }
            }
        }
    }

    given("크롤러·미리보기 봇이 열면") {
        val f = fixture()
        val kakaoScrap = "facebookexternalhit/1.1; kakaotalk-scrap/1.0; +https://devtalk.kakao.com/"
        val response = f.controller.open(get("/r/$code", userAgent = kakaoScrap), kakaoScrap)

        then("목적지로 보내되 세지 않는다") {
            response.location() shouldBe "https://resume.1989v.com/?k=$token"
            verify(exactly = 0) { f.clicks.record(any(), any()) }
        }
    }

    given("클릭 적재가 실패하면") {
        val f = fixture(recordFails = true)
        val response = f.controller.open(get("/r/$code"), browser)

        then("그래도 목적지로 302 한다") {
            response.statusCode shouldBe HttpStatus.FOUND
            response.location() shouldBe "https://resume.1989v.com/?k=$token"
        }
    }

    given("해석·적재 실패 로그") {
        val logger = LoggerFactory.getLogger("com.kgd.codedictionary") as Logger
        val previous = logger.level
        val appender = ListAppender<ILoggingEvent>().apply { start() }
        logger.level = Level.DEBUG
        logger.addAppender(appender)
        try {
            fixture().controller.open(get("/r/$code"), browser)
            fixture(found = link(revokedAt = LocalDateTime.now())).controller.open(get("/r/$code"), browser)
            fixture(recordFails = true).controller.open(get("/r/$code"), browser)
        } finally {
            logger.detachAppender(appender)
            logger.level = previous
        }

        then("링크 id 만 남기고 코드·토큰·목적지는 남기지 않는다") {
            appender.list.shouldNotBeEmpty()
            appender.list.forEach { event ->
                val text = event.formattedMessage + (event.throwableProxy?.message ?: "")
                text shouldNotContain code
                text shouldNotContain token
                text shouldNotContain "resume.1989v.com"
            }
            appender.list.any { "linkId=7" in it.formattedMessage } shouldBe true
        }
    }
})
