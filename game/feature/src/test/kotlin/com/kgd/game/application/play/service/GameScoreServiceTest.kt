package com.kgd.game.application.play.service

import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.play.port.GameScoreRepositoryPort
import com.kgd.game.application.play.port.ScoreBoardRef
import com.kgd.game.application.play.port.ScoreEntry
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation
import com.kgd.game.domain.play.model.ScoreTrack
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify

class GameScoreServiceTest : BehaviorSpec({

    fun game(id: Long, slug: String, status: GameStatus = GameStatus.PUBLISHED): Game = Game.restore(
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
        status = status,
        genre = Genre.ACTION,
        tags = emptyList(),
        releasedAt = null,
        contentUpdatedAt = null,
    )

    fun entry(rank: Int, nickname: String, score: Long) = ScoreEntry(rank, nickname, score, null)

    given("허브 랭킹 레일 조회 시") {
        `when`("한 게임에 두 트랙의 기록이 모두 있으면") {
            then("최근 갱신된 트랙 하나만 싣고 두 보드를 합치지 않아야 한다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val scoreRepository = mockk<GameScoreRepositoryPort>()
                every { scoreRepository.activeBoards(any()) } returns listOf(
                    ScoreBoardRef(1L, ScoreTrack.MODDED),
                    ScoreBoardRef(1L, ScoreTrack.BASE),
                    ScoreBoardRef(2L, ScoreTrack.BASE),
                )
                every { gameRepository.findByIds(listOf(1L, 2L)) } returns
                    listOf(game(1L, "abyssal-crown"), game(2L, "coin-corgi"))
                every { scoreRepository.top(1L, ScoreTrack.MODDED, 3) } returns listOf(entry(1, "가", 900))
                every { scoreRepository.top(2L, ScoreTrack.BASE, 3) } returns listOf(entry(1, "나", 700))

                val boards = GameScoreService(gameRepository, scoreRepository).activeBoards(8, 3)

                boards.map { it.slug } shouldContainExactly listOf("abyssal-crown", "coin-corgi")
                boards[0].track shouldBe ScoreTrack.MODDED
                verify(exactly = 0) { scoreRepository.top(1L, ScoreTrack.BASE, any()) }
            }
        }

        `when`("기록은 있지만 공개 상태가 아닌 게임이 섞여 있으면") {
            then("그 보드는 빼고 돌려줘야 한다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val scoreRepository = mockk<GameScoreRepositoryPort>()
                every { scoreRepository.activeBoards(any()) } returns listOf(
                    ScoreBoardRef(1L, ScoreTrack.BASE),
                    ScoreBoardRef(2L, ScoreTrack.BASE),
                )
                every { gameRepository.findByIds(listOf(1L, 2L)) } returns listOf(
                    game(1L, "suspended-game", GameStatus.SUSPENDED),
                    game(2L, "coin-corgi"),
                )
                every { scoreRepository.top(2L, ScoreTrack.BASE, 3) } returns listOf(entry(1, "나", 700))

                val boards = GameScoreService(gameRepository, scoreRepository).activeBoards(8, 3)

                boards.map { it.slug } shouldContainExactly listOf("coin-corgi")
            }
        }

        `when`("아무 게임에도 기록이 없으면") {
            then("빈 목록이어야 한다 — 허브는 이걸로 위젯 자체를 그리지 않는다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val scoreRepository = mockk<GameScoreRepositoryPort>()
                every { scoreRepository.activeBoards(any()) } returns emptyList()
                every { gameRepository.findByIds(emptyList()) } returns emptyList()

                GameScoreService(gameRepository, scoreRepository).activeBoards(8, 3) shouldBe emptyList()
            }
        }

        `when`("요청 개수가 범위를 벗어나면") {
            then("보드/항목 수를 상한과 하한으로 잘라야 한다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val scoreRepository = mockk<GameScoreRepositoryPort>()
                every { scoreRepository.activeBoards(any()) } returns listOf(ScoreBoardRef(1L, ScoreTrack.BASE))
                every { gameRepository.findByIds(listOf(1L)) } returns listOf(game(1L, "coin-corgi"))
                every { scoreRepository.top(1L, ScoreTrack.BASE, 1) } returns listOf(entry(1, "나", 700))

                GameScoreService(gameRepository, scoreRepository).activeBoards(0, 0)

                // 0 → 1 로 올라가고, 집계는 여유분(×3)까지 긁는다
                verify { scoreRepository.activeBoards(3) }
                verify { scoreRepository.top(1L, ScoreTrack.BASE, 1) }
            }
        }
    }
})
