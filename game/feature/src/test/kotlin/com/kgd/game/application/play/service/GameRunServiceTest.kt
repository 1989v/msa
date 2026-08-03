package com.kgd.game.application.play.service

import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.play.port.GameRunRepositoryPort
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation
import com.kgd.game.domain.play.exception.RunNotFoundException
import com.kgd.game.domain.play.model.GameRun
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import java.time.Instant

class GameRunServiceTest : BehaviorSpec({

    fun game(id: Long, slug: String): Game = Game.restore(
        id = id,
        slug = slug,
        title = slug,
        description = "d",
        thumbnailUrl = "/t.png",
        coverUrl = null,
        engineType = EngineType.CANVAS_TS,
        loadType = LoadType.IFRAME,
        entryUrl = "/e",
        orientation = Orientation.BOTH,
        supportsMobile = true,
        developerName = "kgd",
        sdkIntegrated = false,
        status = GameStatus.PUBLISHED,
        genre = Genre.RPG,
        tags = emptyList(),
        releasedAt = null,
        contentUpdatedAt = null,
    )

    given("런 시작 시") {
        `when`("PUBLISHED 게임이면") {
            then("서버가 시드를 발급하고 ACTIVE 런을 저장해야 한다") {
                val gameRepository = mockk<GameRepositoryPort>()
                every { gameRepository.findBySlug("roguelike") } returns game(1L, "roguelike")
                val runRepository = mockk<GameRunRepositoryPort>()
                val saved = slot<GameRun>()
                every { runRepository.save(capture(saved)) } answers { saved.captured }

                val run = GameRunService(gameRepository, runRepository).start("roguelike", memberId = null)

                run.isActive() shouldBe true
                run.runKey shouldNotBe ""
                saved.captured.gameId shouldBe 1L
            }
        }
    }

    given("런 종료 시") {
        `when`("다른 게임의 runKey를 넘기면") {
            then("RunNotFoundException이 발생해야 한다 (게임 간 격리)") {
                val gameRepository = mockk<GameRepositoryPort>()
                every { gameRepository.findBySlug("other-game") } returns game(2L, "other-game")
                val runRepository = mockk<GameRunRepositoryPort>()
                every { runRepository.findByRunKey("run-1") } returns
                    GameRun.start("run-1", gameId = 1L, memberId = null, seed = 42L, now = Instant.now())

                shouldThrow<RunNotFoundException> {
                    GameRunService(gameRepository, runRepository).consume("other-game", "run-1", "CLEAR")
                }
            }
        }
    }
})
