package com.kgd.game.presentation.play.controller

import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.play.port.GameScoreRepositoryPort
import com.kgd.game.application.play.service.GameScoreService
import com.kgd.game.application.play.usecase.GetGameLeaderboardUseCase
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify

/**
 * 헤더 → Command 배선을 잰다. 운영자·자동화 판별은 컨트롤러가 헤더를 읽는 줄이 곧 게이트인데,
 * 운영 e2e 는 헤드리스 UA 에서 먼저 걸려 운영자 배선을 증명하지 못한다 — 여기서만 잰다.
 *
 * Spring 없이 생성자로 조립한다. 서비스와 판별기는 실제 것이고 포트만 mock 이라, 판정 근거는
 * 응답 필드가 아니라 **저장소 포트가 불렸는가**다 — 응답만 보면 저장이 새도 초록불이다.
 */
class GameScoreControllerTest : BehaviorSpec({

    // scripts/cdp-chrome.sh (--headless=new) 가 실제로 보내는 값 (2026-09-20 실측)
    val headlessUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36"
    val humanUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"

    fun game(): Game = Game.restore(
        id = 1L, slug = "coin-corgi", title = "coin-corgi", description = "d", thumbnailUrl = "/t.png", coverUrl = null,
        engineType = EngineType.CANVAS_TS, loadType = LoadType.IFRAME, entryUrl = "/e", orientation = Orientation.BOTH,
        supportsMobile = true, developerName = "kgd", sdkIntegrated = false, status = GameStatus.PUBLISHED,
        genre = Genre.ACTION, tags = emptyList(), releasedAt = null, contentUpdatedAt = null,
    )

    fun rig(): Pair<GameScoreController, GameScoreRepositoryPort> {
        val games = mockk<GameRepositoryPort> { every { findBySlug("coin-corgi") } returns game() }
        // submit 은 기록되는 케이스에서만 스텁한다 — 제외 케이스에서 불리면 MockK 가 예외를 던진다
        val scores = mockk<GameScoreRepositoryPort>()
        val service = GameScoreService(games, scores)
        return GameScoreController(service, mockk<GetGameLeaderboardUseCase>()) to scores
    }

    val request = ScoreSubmitRequest(nickname = "가나", score = 900)

    Given("점수 제출 헤더 배선") {

        When("헤드리스 크롬 UA · 역할 헤더 없음") {
            val (controller, scores) = rig()
            val res = controller.submit("coin-corgi", null, null, headlessUa, request)
            Then("excluded 이고 저장소는 불리지 않는다") {
                res.data!!.excluded shouldBe true
                res.data!!.rank shouldBe 0
                verify(exactly = 0) { scores.submit(any(), any(), any(), any(), any(), any(), any(), any()) }
            }
        }

        When("사람 UA · X-User-Roles 에 ROLE_ADMIN") {
            val (controller, scores) = rig()
            val res = controller.submit("coin-corgi", "1", "ROLE_USER,ROLE_ADMIN", humanUa, request)
            Then("excluded 이고 저장소는 불리지 않는다") {
                res.data!!.excluded shouldBe true
                verify(exactly = 0) { scores.submit(any(), any(), any(), any(), any(), any(), any(), any()) }
            }
        }

        When("사람 UA · X-User-Roles 에 ROLE_USER 만") {
            val (controller, scores) = rig()
            every { scores.submit(any(), any(), any(), any(), any(), any(), any(), any()) } returns (true to 3)
            val res = controller.submit("coin-corgi", "7", "ROLE_USER", humanUa, request)
            Then("기록된다 — 사람을 거르지 않는다") {
                res.data!!.excluded shouldBe false
                res.data!!.rank shouldBe 3
                verify(exactly = 1) { scores.submit(1L, any(), any(), "가나", 900, null, any(), 7L) }
            }
        }

        When("사람 UA · 역할 헤더 없음 (게이트웨이가 익명 통과 시 헤더를 지운다)") {
            val (controller, scores) = rig()
            every { scores.submit(any(), any(), any(), any(), any(), any(), any(), any()) } returns (true to 1)
            val res = controller.submit("coin-corgi", null, null, humanUa, request)
            Then("게스트로 기록된다") {
                res.data!!.excluded shouldBe false
                verify(exactly = 1) { scores.submit(1L, any(), any(), "가나", 900, null, any(), null) }
            }
        }
    }
})
