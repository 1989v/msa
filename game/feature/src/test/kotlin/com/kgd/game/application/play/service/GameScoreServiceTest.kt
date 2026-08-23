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
import com.kgd.game.domain.play.model.GameDay
import com.kgd.game.domain.play.model.ScorePeriod
import com.kgd.game.domain.play.model.ScoreTrack
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.time.LocalDate

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
                every { scoreRepository.topDaily(any(), any(), any(), any()) } returns emptyList()

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
                every { scoreRepository.topDaily(any(), any(), any(), any()) } returns emptyList()

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
                every { scoreRepository.topDaily(any(), any(), any(), any()) } returns emptyList()

                GameScoreService(gameRepository, scoreRepository).activeBoards(0, 0)

                // 0 → 1 로 올라가고, 집계는 여유분(×3)까지 긁는다
                verify { scoreRepository.activeBoards(3) }
                verify { scoreRepository.top(1L, ScoreTrack.BASE, 1) }
            }
        }
    }

    given("보드를 기간으로 나눠 조회할 때") {
        fun serving(slug: String): Pair<GameRepositoryPort, GameScoreRepositoryPort> {
            val gameRepository = mockk<GameRepositoryPort>()
            val scoreRepository = mockk<GameScoreRepositoryPort>()
            every { gameRepository.findBySlug(slug) } returns game(1L, slug)
            return gameRepository to scoreRepository
        }

        `when`("period 를 생략하면") {
            then("역대 보드를 읽는다 — 게임 안 위젯이 부르고 있는 기존 계약이다") {
                val (games, scores) = serving("coin-corgi")
                every { scores.top(1L, ScoreTrack.BASE, 10) } returns listOf(entry(1, "가", 900))

                GameScoreService(games, scores).leaderboard("coin-corgi", ScoreTrack.BASE, 10)
                    .map { it.nickname } shouldContainExactly listOf("가")

                verify(exactly = 0) { scores.topDaily(any(), any(), any(), any()) }
            }
        }

        `when`("period=DAILY 이고 날짜를 주지 않으면") {
            then("KST 기준 오늘 보드를 읽는다") {
                val (games, scores) = serving("coin-corgi")
                every { scores.topDaily(1L, ScoreTrack.BASE, GameDay.today(), 10) } returns listOf(entry(1, "나", 300))

                GameScoreService(games, scores)
                    .leaderboard("coin-corgi", ScoreTrack.BASE, 10, ScorePeriod.DAILY)
                    .map { it.nickname } shouldContainExactly listOf("나")

                verify(exactly = 0) { scores.top(any(), any(), any()) }
            }
        }

        `when`("지난 날짜를 지정하면") {
            then("그날의 보드를 읽는다 — 오늘로 조용히 바꾸지 않는다") {
                val (games, scores) = serving("coin-corgi")
                val past = LocalDate.of(2026, 8, 1)
                every { scores.topDaily(1L, ScoreTrack.BASE, past, 10) } returns listOf(entry(1, "다", 120))

                GameScoreService(games, scores)
                    .leaderboard("coin-corgi", ScoreTrack.BASE, 10, ScorePeriod.DAILY, past)
                    .map { it.nickname } shouldContainExactly listOf("다")
            }
        }

        `when`("그날 아무도 안 놀았으면") {
            then("빈 목록이다 — 오류가 아니라 아직 비어 있는 보드다") {
                val (games, scores) = serving("coin-corgi")
                every { scores.topDaily(any(), any(), any(), any()) } returns emptyList()

                GameScoreService(games, scores)
                    .leaderboard("coin-corgi", ScoreTrack.BASE, 10, ScorePeriod.DAILY) shouldBe emptyList()
            }
        }

        `when`("limit 이 범위를 벗어나면") {
            then("오늘 보드에도 같은 상·하한이 걸린다") {
                val (games, scores) = serving("coin-corgi")
                every { scores.topDaily(1L, ScoreTrack.BASE, GameDay.today(), 50) } returns emptyList()

                GameScoreService(games, scores).leaderboard("coin-corgi", ScoreTrack.BASE, 999, ScorePeriod.DAILY)

                verify { scores.topDaily(1L, ScoreTrack.BASE, GameDay.today(), 50) }
            }
        }
    }

    given("점수를 제출할 때") {
        `when`("클라이언트가 날짜를 보내지 않아도") {
            then("서버가 정한 오늘(KST)을 함께 저장한다 — 기기 시계로 보드가 갈리지 않는다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val scoreRepository = mockk<GameScoreRepositoryPort>()
                every { gameRepository.findBySlug("coin-corgi") } returns game(1L, "coin-corgi")
                every { scoreRepository.submit(1L, ScoreTrack.BASE, "가나", 900, null, GameDay.today()) } returns (true to 1)

                GameScoreService(gameRepository, scoreRepository)
                    .submit("coin-corgi", ScoreTrack.BASE, "가나", 900, null) shouldBe (true to 1)

                verify { scoreRepository.submit(1L, ScoreTrack.BASE, "가나", 900, null, GameDay.today()) }
            }
        }
    }

    given("허브 레일이 오늘 기록을 함께 받을 때") {
        `when`("오늘 기록이 있는 보드와 없는 보드가 섞여 있으면") {
            then("요청을 한 번 더 하지 않고 한 응답에 둘 다 실린다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val scoreRepository = mockk<GameScoreRepositoryPort>()
                every { scoreRepository.activeBoards(any()) } returns listOf(
                    ScoreBoardRef(1L, ScoreTrack.BASE),
                    ScoreBoardRef(2L, ScoreTrack.BASE),
                )
                every { gameRepository.findByIds(listOf(1L, 2L)) } returns
                    listOf(game(1L, "abyssal-crown"), game(2L, "coin-corgi"))
                every { scoreRepository.top(1L, ScoreTrack.BASE, 3) } returns listOf(entry(1, "가", 900))
                every { scoreRepository.top(2L, ScoreTrack.BASE, 3) } returns listOf(entry(1, "나", 700))
                every { scoreRepository.topDaily(1L, ScoreTrack.BASE, GameDay.today(), 3) } returns
                    listOf(entry(1, "오늘1등", 400))
                every { scoreRepository.topDaily(2L, ScoreTrack.BASE, GameDay.today(), 3) } returns emptyList()

                val boards = GameScoreService(gameRepository, scoreRepository).activeBoards(8, 3)

                boards[0].todayEntries.map { it.nickname } shouldContainExactly listOf("오늘1등")
                boards[1].todayEntries shouldBe emptyList()
            }
        }
    }
})
