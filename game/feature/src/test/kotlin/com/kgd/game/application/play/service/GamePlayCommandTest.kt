package com.kgd.game.application.play.service

import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.catalog.port.GameStatsRepositoryPort
import com.kgd.game.application.play.port.GameRatingRepositoryPort
import com.kgd.game.application.play.port.PlaySessionRepositoryPort
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.catalog.exception.GameNotPlayableException
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.GameStats
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.play.model.DeviceType
import com.kgd.game.domain.play.model.GamePlaySession
import com.kgd.game.domain.play.model.GameRating
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import java.time.Instant

class GamePlayCommandTest : BehaviorSpec({

    fun publishedGame(): Game {
        val game = Game.restore(
            id = 1L,
            slug = "concept-memory",
            title = "Concept Memory",
            description = "짝 맞추기",
            thumbnailUrl = "/t.png",
            coverUrl = null,
            engineType = EngineType.REACT_INTERNAL,
            loadType = LoadType.INTERNAL_ROUTE,
            entryUrl = "concept-memory",
            orientation = com.kgd.game.domain.catalog.model.Orientation.BOTH,
            supportsMobile = true,
            developerName = "kgd",
            sdkIntegrated = false,
            status = com.kgd.game.domain.catalog.model.GameStatus.PUBLISHED,
            tags = listOf("puzzle"),
            releasedAt = Instant.parse("2026-07-01T00:00:00Z"),
            contentUpdatedAt = null,
        )
        return game
    }

    fun draftGame(): Game = Game.create(
        slug = "unreleased",
        title = "Unreleased",
        description = "",
        thumbnailUrl = "/t.png",
        engineType = EngineType.HTML5,
        loadType = LoadType.IFRAME,
        entryUrl = "/game-assets/unreleased/",
        developerName = "kgd",
    )

    given("세션 시작 시") {
        `when`("게시된 게임을 게스트가 플레이하면") {
            then("세션이 저장되고 플레이 수가 증가해야 한다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val statsRepository = mockk<GameStatsRepositoryPort>()
                val sessionRepository = mockk<PlaySessionRepositoryPort>()
                val ratingRepository = mockk<GameRatingRepositoryPort>()
                val command = GamePlayCommand(gameRepository, statsRepository, sessionRepository, ratingRepository)

                every { gameRepository.findBySlug("concept-memory") } returns publishedGame()
                every { sessionRepository.save(any()) } answers { firstArg() }
                every { statsRepository.findByGameId(1L) } returns GameStats.init(1L)
                val savedStats = slot<GameStats>()
                every { statsRepository.save(capture(savedStats)) } answers { firstArg() }

                val result = command.startSession("concept-memory", memberId = null, deviceType = DeviceType.MOBILE)

                result.gameId shouldBe 1L
                result.session.memberId shouldBe null
                result.session.deviceType shouldBe DeviceType.MOBILE
                savedStats.captured.playCount shouldBe 1
                savedStats.captured.weeklyPlayCount shouldBe 1
            }
        }

        `when`("아직 게시되지 않은 게임이면") {
            then("GameNotPlayableException 이 발생해야 한다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val command = GamePlayCommand(gameRepository, mockk(), mockk(), mockk())
                every { gameRepository.findBySlug("unreleased") } returns draftGame()

                shouldThrow<GameNotPlayableException> {
                    command.startSession("unreleased", memberId = 1L, deviceType = DeviceType.DESKTOP)
                }
            }
        }

        `when`("존재하지 않는 게임이면") {
            then("GameNotFoundException 이 발생해야 한다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val command = GamePlayCommand(gameRepository, mockk(), mockk(), mockk())
                every { gameRepository.findBySlug("nope") } returns null

                shouldThrow<GameNotFoundException> {
                    command.startSession("nope", memberId = null, deviceType = DeviceType.DESKTOP)
                }
            }
        }
    }

    given("평점 등록 시") {
        `when`("처음 투표하면") {
            then("표 수와 합계가 함께 증가해야 한다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val statsRepository = mockk<GameStatsRepositoryPort>()
                val ratingRepository = mockk<GameRatingRepositoryPort>()
                val command = GamePlayCommand(gameRepository, statsRepository, mockk(), ratingRepository)

                every { gameRepository.findBySlug("concept-memory") } returns publishedGame()
                every { ratingRepository.findByGameIdAndMemberId(1L, 7L) } returns null
                every { ratingRepository.save(any()) } answers { firstArg() }
                every { statsRepository.findByGameId(1L) } returns GameStats.init(1L)
                every { statsRepository.save(any()) } answers { firstArg() }

                val result = command.rate("concept-memory", memberId = 7L, score = 9)

                result.score shouldBe 9
                result.ratingCount shouldBe 1
                result.ratingAvg shouldBe 9.0
            }
        }

        `when`("이미 투표한 회원이 재투표하면") {
            then("표 수는 유지되고 평균만 갱신되어야 한다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val statsRepository = mockk<GameStatsRepositoryPort>()
                val ratingRepository = mockk<GameRatingRepositoryPort>()
                val command = GamePlayCommand(gameRepository, statsRepository, mockk(), ratingRepository)

                val stats = GameStats.restore(gameId = 1L, playCount = 5, ratingSum = 9, ratingCount = 1, weeklyPlayCount = 5)
                every { gameRepository.findBySlug("concept-memory") } returns publishedGame()
                every { ratingRepository.findByGameIdAndMemberId(1L, 7L) } returns GameRating.restore(3L, 1L, 7L, 9)
                every { ratingRepository.save(any()) } answers { firstArg() }
                every { statsRepository.findByGameId(1L) } returns stats
                every { statsRepository.save(any()) } answers { firstArg() }

                val result = command.rate("concept-memory", memberId = 7L, score = 5)

                result.ratingCount shouldBe 1
                result.ratingAvg shouldBe 5.0
            }
        }
    }

    given("세션 종료 시") {
        `when`("존재하는 세션 키가 주어지면") {
            then("종료 시각과 재생 시간이 기록되어야 한다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val sessionRepository = mockk<PlaySessionRepositoryPort>()
                val command = GamePlayCommand(gameRepository, mockk(), sessionRepository, mockk())

                val session = GamePlaySession.restore(
                    id = 10L,
                    sessionKey = "sess-1",
                    gameId = 1L,
                    memberId = null,
                    deviceType = DeviceType.DESKTOP,
                    startedAt = Instant.now().minusSeconds(30),
                    endedAt = null,
                    durationSec = null,
                )
                every { sessionRepository.findBySessionKey("sess-1") } returns session
                every { sessionRepository.save(any()) } answers { firstArg() }
                every { gameRepository.findByIds(listOf(1L)) } returns listOf(publishedGame())

                val result = command.endSession("sess-1")

                result.gameSlug shouldBe "concept-memory"
                result.session.isEnded() shouldBe true
                (result.session.durationSec ?: 0) shouldBe 30L
            }
        }
    }
})
