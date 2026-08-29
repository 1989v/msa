package com.kgd.game.application.catalog.service

import com.kgd.game.application.catalog.port.GameCollectionRepositoryPort
import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.catalog.port.GameStatsRepositoryPort
import com.kgd.game.application.catalog.usecase.GetGameDetailUseCase
import com.kgd.game.application.play.port.MemberGameRecordPort
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation
import java.time.Instant
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk

/**
 * 예상 플레이타임 — 표본이 적을 때 값을 내지 않는 것, 그리고 평균이 아니라 중앙값인 것이
 * 이 계산의 전부다. 둘 다 경계가 뚜렷해 테스트가 싸다.
 */
class EstimatedMinutesTest : BehaviorSpec({
    fun gameWith(id: Long, slug: String, status: GameStatus): Game = Game.restore(
        id = id, slug = slug, title = slug, description = "", thumbnailUrl = "/t.png",
        coverUrl = null, engineType = EngineType.HTML5, loadType = LoadType.IFRAME,
        entryUrl = "/game-assets/$slug/", orientation = Orientation.BOTH, supportsMobile = true,
        developerName = "kgd", sdkIntegrated = false, status = status, genre = Genre.CASUAL,
        tags = listOf("puzzle"), releasedAt = Instant.parse("2026-07-01T00:00:00Z"),
        contentUpdatedAt = null,
    )

    fun serviceWith(durations: List<Int>): Pair<GameQueryService, GameRepositoryPort> {
        val games = mockk<GameRepositoryPort>()
        val stats = mockk<GameStatsRepositoryPort>(relaxed = true)
        val records = mockk<MemberGameRecordPort>()
        every { records.recentDurations(any(), any()) } returns durations
        every { stats.findByGameId(any()) } returns null
        return GameQueryService(games, stats, mockk<GameCollectionRepositoryPort>(), records) to games
    }

    Given("세션 표본이 모자라면") {
        When("네 판뿐이면") {
            val (service, games) = serviceWith(listOf(600, 600, 600, 600))
            every { games.findBySlug("g") } returns gameWith(1L, "g", GameStatus.PUBLISHED)

            Then("값을 내지 않는다 — 두세 판으로 낸 중앙값은 숫자일 뿐이다") {
                service.execute(GetGameDetailUseCase.Query("g")).estimatedMinutes shouldBe null
            }
        }
    }

    Given("표본이 충분하면") {
        When("한 판이 유난히 길면") {
            // 열어 두고 자리를 비운 세션. 평균이면 40분이 되지만 중앙값은 흔들리지 않는다
            val (service, games) = serviceWith(listOf(300, 300, 300, 300, 12_000))
            every { games.findBySlug("g") } returns gameWith(1L, "g", GameStatus.PUBLISHED)

            Then("중앙값을 쓴다 — 5분") {
                service.execute(GetGameDetailUseCase.Query("g")).estimatedMinutes shouldBe 5
            }
        }

        When("전부 1분 미만이면") {
            val (service, games) = serviceWith(listOf(10, 12, 14, 16, 18))
            every { games.findBySlug("g") } returns gameWith(1L, "g", GameStatus.PUBLISHED)

            Then("0 이 아니라 1 로 올린다 — 0분은 정보가 아니다") {
                service.execute(GetGameDetailUseCase.Query("g")).estimatedMinutes shouldBe 1
            }
        }
    }
})
