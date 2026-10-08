package com.kgd.blog.presentation

import com.kgd.blog.application.post.port.BlogPostRepositoryPort
import com.kgd.blog.application.shortlink.port.BlogShortLinkClick
import com.kgd.blog.application.shortlink.port.BlogShortLinkClickRepositoryPort
import com.kgd.blog.application.shortlink.service.BlogShortLinkService
import com.kgd.blog.domain.model.BlogPost
import com.kgd.blog.domain.model.PostStatus
import com.kgd.blog.presentation.controller.BlogShortLinkController
import com.kgd.common.shortlink.ShortCode
import com.kgd.common.shortlink.ShortLinkProperties
import com.kgd.common.shortlink.ShortLinks
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.mock.web.MockHttpServletRequest
import java.time.LocalDateTime

/**
 * `/b/{code}` 리다이렉터. 컨트롤러를 직접 만들고 실제 해석 서비스·실제 `ShortLinks` 를 붙인다 —
 * 저장소 포트만 목이다. 판정은 컨트롤러가 내놓은 응답과 포트가 받은 값으로 한다.
 */
class BlogShortLinkControllerTest : BehaviorSpec({

    val postId = 31L
    val code = ShortCode.encode(postId)
    val browser = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15"
    val home = "https://blog.1989v.com/"
    val target = "https://blog.1989v.com/posts/search-relevance-notes"

    fun post(status: PostStatus) = BlogPost(
        id = postId, authorProfileId = 1, categoryId = 1, slug = "search-relevance-notes",
        title = "제목", summary = null, body = "본문", coverImageUrl = null,
        status = status, publishedAt = LocalDateTime.now(),
    )

    class Fixture(
        val controller: BlogShortLinkController,
        val posts: BlogPostRepositoryPort,
        val clicks: BlogShortLinkClickRepositoryPort,
    )

    // 블록마다 새 목 — 공유하면 앞 블록의 호출이 뒤 블록의 verify 를 오염시킨다
    fun fixture(found: BlogPost? = post(PostStatus.PUBLISHED), recordFails: Boolean = false): Fixture {
        val posts = mockk<BlogPostRepositoryPort>()
        val clicks = mockk<BlogShortLinkClickRepositoryPort>()
        every { posts.findById(any()) } returns null
        every { posts.findById(postId) } returns found
        if (recordFails) {
            every { clicks.record(any()) } throws IllegalStateException("DB down")
        } else {
            every { clicks.record(any()) } returns Unit
        }
        val service = BlogShortLinkService(posts, clicks, ShortLinks(ShortLinkProperties()))
        return Fixture(BlogShortLinkController(service, service), posts, clicks)
    }

    fun get(uri: String, query: String? = null) = MockHttpServletRequest("GET", uri).apply { queryString = query }

    fun ResponseEntity<Void>.location() = headers.getFirst(HttpHeaders.LOCATION)

    given("글 상태 전수 × 유효한 코드") {
        then("리다이렉터가 여는 상태 집합이 PostStatus.publiclyVisible 이 참인 집합과 같다") {
            val opened = PostStatus.entries.filter { status ->
                fixture(found = post(status)).controller.open(get("/b/$code"), null, browser).location() != home
            }.toSet()
            val visible = PostStatus.entries.filter { it.publiclyVisible }.toSet()

            visible.shouldNotBeEmpty()
            opened shouldBe visible
        }
    }

    given("공개된 글의 코드로 들어오면") {
        val f = fixture()
        val request = get("/b/$code", query = "utm_source=x").apply {
            serverName = "evil.example"
            addHeader("X-Forwarded-Host", "evil.example")
        }
        val response = f.controller.open(request, "https://www.threads.net/@someone/post/1?igsh=abc", browser)

        then("302 로 blog 글 상세로 보낸다 — 요청 쿼리·호스트는 쓰지 않는다") {
            response.statusCode shouldBe HttpStatus.FOUND
            response.location() shouldBe target
        }

        then("캐시·색인을 막는 헤더가 붙는다") {
            response.headers.getFirst(HttpHeaders.CACHE_CONTROL) shouldBe "no-store"
            response.headers.getFirst("X-Robots-Tag") shouldBe "noindex, nofollow"
        }

        then("글 id 로 한 번 적재하고, 리퍼러는 호스트만·UA 는 계열만 넘긴다") {
            val click = slot<BlogShortLinkClick>()
            verify(exactly = 1) { f.clicks.record(capture(click)) }
            click.captured.postId shouldBe postId
            click.captured.referrerHost shouldBe "www.threads.net"
            click.captured.uaFamily shouldBe "desktop"
        }
    }

    given("해석에 실패하는 경로면") {
        val cases = mapOf(
            "없는 글" to "/b/${ShortCode.encode(postId + 1)}",
            "형식 오류" to "/b/not-a-code",
            "세그먼트가 더 붙은 경로" to "/b/$code/extra",
        )

        then("모두 blog 홈으로 302 하고 세지 않는다") {
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
        then("`/b`·`/b/`·`/b/list` 모두 blog 홈으로 가고 저장소를 보지 않는다") {
            listOf("/b", "/b/", "/b/list").forEach { uri ->
                val f = fixture()
                withClue(uri) { f.controller.open(get(uri), null, browser).location() shouldBe home }
                verify(exactly = 0) { f.posts.findById(any()) }
            }
        }
    }

    given("크롤러·미리보기 봇이 열면") {
        val f = fixture()
        val slackbot = "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"
        val response = f.controller.open(get("/b/$code"), null, slackbot)

        then("목적지로 보내되 세지 않는다") {
            response.location() shouldBe target
            verify(exactly = 0) { f.clicks.record(any()) }
        }
    }

    given("클릭 적재가 실패하면") {
        val f = fixture(recordFails = true)
        val response = f.controller.open(get("/b/$code"), null, browser)

        then("그래도 목적지로 302 한다") {
            response.statusCode shouldBe HttpStatus.FOUND
            response.location() shouldBe target
        }
    }
})
