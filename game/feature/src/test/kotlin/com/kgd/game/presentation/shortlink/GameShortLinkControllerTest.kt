package com.kgd.game.presentation.shortlink

import com.kgd.common.shortlink.ShortCode
import com.kgd.common.shortlink.ShortLinkProperties
import com.kgd.common.shortlink.ShortLinks
import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.shortlink.port.GameShortLinkClick
import com.kgd.game.application.shortlink.port.GameShortLinkClickRepositoryPort
import com.kgd.game.application.shortlink.service.GameShortLinkService
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation
import com.kgd.game.presentation.shortlink.controller.GameShortLinkController
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
import java.time.Instant

/**
 * `/g/{code}` 리다이렉터. 컨트롤러를 직접 만들고 실제 해석 서비스·실제 `ShortLinks` 를 붙인다 —
 * 저장소 포트만 목이다. 판정은 컨트롤러가 내놓은 응답과 포트가 받은 값으로 한다.
 */
class GameShortLinkControllerTest : BehaviorSpec({

    val gameId = 77L
    val code = ShortCode.encode(gameId)
    val browser = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
    val home = "https://game.1989v.com/"

    fun game(status: GameStatus, slug: String = "sum-trail") = Game.restore(
        id = gameId, slug = slug, title = slug, description = "", thumbnailUrl = "/t.png",
        coverUrl = null, engineType = EngineType.HTML5, loadType = LoadType.IFRAME,
        entryUrl = "/games/$slug/", orientation = Orientation.BOTH, supportsMobile = true,
        developerName = "kgd", sdkIntegrated = false, status = status, genre = Genre.CASUAL,
        tags = emptyList(), releasedAt = Instant.parse("2026-07-01T00:00:00Z"), contentUpdatedAt = null,
    )

    class Fixture(
        val controller: GameShortLinkController,
        val games: GameRepositoryPort,
        val clicks: GameShortLinkClickRepositoryPort,
    )

    // 블록마다 새 목 — 공유하면 앞 블록의 호출이 뒤 블록의 verify 를 오염시킨다
    fun fixture(found: Game? = game(GameStatus.PUBLISHED), recordFails: Boolean = false): Fixture {
        val games = mockk<GameRepositoryPort>()
        val clicks = mockk<GameShortLinkClickRepositoryPort>()
        every { games.findByIds(any()) } returns emptyList()
        every { games.findByIds(listOf(gameId)) } returns listOfNotNull(found)
        if (recordFails) {
            every { clicks.record(any()) } throws IllegalStateException("DB down")
        } else {
            every { clicks.record(any()) } returns Unit
        }
        val service = GameShortLinkService(games, clicks, ShortLinks(ShortLinkProperties()))
        return Fixture(GameShortLinkController(service, service), games, clicks)
    }

    fun get(uri: String, query: String? = null) = MockHttpServletRequest("GET", uri).apply { queryString = query }

    fun ResponseEntity<Void>.location() = headers.getFirst(HttpHeaders.LOCATION)

    given("게임 상태 전수 × 유효한 코드") {
        then("리다이렉터가 여는 상태 집합이 Game.isPlayable() 이 참인 집합과 같다") {
            val opened = GameStatus.entries.filter { status ->
                fixture(found = game(status)).controller.open(get("/g/$code"), null, browser).location() != home
            }.toSet()
            val playable = GameStatus.entries.filter { game(it).isPlayable() }.toSet()

            playable.shouldNotBeEmpty()
            opened shouldBe playable
        }
    }

    given("플레이할 수 있는 게임의 코드로 들어오면") {
        val f = fixture()
        val request = get("/g/$code", query = "utm_source=x").apply {
            serverName = "evil.example"
            addHeader("X-Forwarded-Host", "evil.example")
        }
        val response = f.controller.open(request, "https://open.kakao.com/o/abc?x=1", browser)

        then("302 로 game 상세로 보낸다 — 요청 쿼리·호스트는 쓰지 않는다") {
            response.statusCode shouldBe HttpStatus.FOUND
            response.location() shouldBe "https://game.1989v.com/games/sum-trail"
        }

        then("캐시·색인을 막는 헤더가 붙는다") {
            response.headers.getFirst(HttpHeaders.CACHE_CONTROL) shouldBe "no-store"
            response.headers.getFirst("X-Robots-Tag") shouldBe "noindex, nofollow"
        }

        then("게임 id 로 한 번 적재하고, 리퍼러는 호스트만·UA 는 계열만 넘긴다") {
            val click = slot<GameShortLinkClick>()
            verify(exactly = 1) { f.clicks.record(capture(click)) }
            click.captured.gameId shouldBe gameId
            click.captured.referrerHost shouldBe "open.kakao.com"
            click.captured.uaFamily shouldBe "mobile"
        }
    }

    given("슬러그에 경로 예약 문자가 섞여 있으면") {
        val f = fixture(found = game(GameStatus.BETA, slug = "a b/c"))
        val response = f.controller.open(get("/g/$code"), null, browser)

        then("세그먼트 하나로 인코딩한다 — 목적지 경로가 쪼개지지 않는다") {
            response.location() shouldBe "https://game.1989v.com/games/a%20b%2Fc"
        }
    }

    given("해석에 실패하는 경로면") {
        val cases = mapOf(
            "없는 게임" to "/g/${ShortCode.encode(gameId + 1)}",
            "형식 오류" to "/g/not-a-code",
            "대소문자만 바꾼 코드" to "/g/${code.map { if (it.isUpperCase()) it.lowercaseChar() else it.uppercaseChar() }.joinToString("")}",
            "세그먼트가 더 붙은 경로" to "/g/$code/extra",
        )

        then("모두 game 홈으로 302 하고 세지 않는다") {
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
        then("`/g`·`/g/`·`/g/list` 모두 game 홈으로 가고 저장소를 보지 않는다") {
            listOf("/g", "/g/", "/g/list").forEach { uri ->
                val f = fixture()
                withClue(uri) { f.controller.open(get(uri), null, browser).location() shouldBe home }
                verify(exactly = 0) { f.games.findByIds(any()) }
            }
        }
    }

    given("크롤러·미리보기 봇이 열면") {
        val f = fixture()
        val kakaoScrap = "facebookexternalhit/1.1; kakaotalk-scrap/1.0; +https://devtalk.kakao.com/"
        val response = f.controller.open(get("/g/$code"), null, kakaoScrap)

        then("목적지로 보내되 세지 않는다") {
            response.location() shouldBe "https://game.1989v.com/games/sum-trail"
            verify(exactly = 0) { f.clicks.record(any()) }
        }
    }

    given("클릭 적재가 실패하면") {
        val f = fixture(recordFails = true)
        val response = f.controller.open(get("/g/$code"), null, browser)

        then("그래도 목적지로 302 한다") {
            response.statusCode shouldBe HttpStatus.FOUND
            response.location() shouldBe "https://game.1989v.com/games/sum-trail"
        }
    }
})
