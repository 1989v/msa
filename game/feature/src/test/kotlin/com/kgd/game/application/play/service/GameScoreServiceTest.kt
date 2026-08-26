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
import com.kgd.game.domain.catalog.model.ScoreBoardDef
import com.kgd.game.domain.play.model.GameDay
import com.kgd.game.domain.play.model.ScoreBoardKey
import com.kgd.game.domain.play.model.ScorePeriod
import com.kgd.game.domain.play.model.ScoreTrack
import com.kgd.game.application.play.usecase.GetActiveLeaderboardsUseCase
import com.kgd.game.application.play.usecase.GetGameLeaderboardUseCase
import com.kgd.game.application.play.usecase.SubmitGameScoreUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.time.LocalDate

class GameScoreServiceTest : BehaviorSpec({

    val default = ScoreBoardKey.DEFAULT

    fun game(
        id: Long,
        slug: String,
        status: GameStatus = GameStatus.PUBLISHED,
        scoreBoards: List<ScoreBoardDef> = emptyList(),
    ): Game = Game.restore(
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
        scoreBoards = scoreBoards,
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
                    ScoreBoardRef(1L, ScoreTrack.MODDED, default),
                    ScoreBoardRef(1L, ScoreTrack.BASE, default),
                    ScoreBoardRef(2L, ScoreTrack.BASE, default),
                )
                every { gameRepository.findByIds(listOf(1L, 2L)) } returns
                    listOf(game(1L, "abyssal-crown"), game(2L, "coin-corgi"))
                every { scoreRepository.top(1L, ScoreTrack.MODDED, default, 3) } returns listOf(entry(1, "가", 900))
                every { scoreRepository.top(2L, ScoreTrack.BASE, default, 3) } returns listOf(entry(1, "나", 700))
                every { scoreRepository.topDaily(any(), any(), any(), any(), any()) } returns emptyList()

                val boards = GameScoreService(gameRepository, scoreRepository).execute(GetActiveLeaderboardsUseCase.Query(8, 3))

                boards.map { it.slug } shouldContainExactly listOf("abyssal-crown", "coin-corgi")
                boards[0].track shouldBe ScoreTrack.MODDED
                verify(exactly = 0) { scoreRepository.top(1L, ScoreTrack.BASE, any(), any()) }
            }
        }

        `when`("한 게임이 모드를 나눠 보드가 여럿이면") {
            then("레일에는 최근 갱신된 보드 하나만 싣는다 — 같은 게임이 여러 칸을 먹으면 순회가 반복으로 보인다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val scoreRepository = mockk<GameScoreRepositoryPort>()
                val rock = ScoreBoardKey.from("rockfall")
                val water = ScoreBoardKey.from("leak")
                every { scoreRepository.activeBoards(any()) } returns listOf(
                    ScoreBoardRef(1L, ScoreTrack.BASE, rock),
                    ScoreBoardRef(1L, ScoreTrack.BASE, water),
                )
                every { gameRepository.findByIds(listOf(1L)) } returns listOf(
                    game(
                        1L,
                        "bee-guard",
                        scoreBoards = listOf(
                            ScoreBoardDef("leak", "물 막기", "Water"),
                            ScoreBoardDef("rockfall", "돌 막기", "Rocks"),
                        ),
                    ),
                )
                every { scoreRepository.top(1L, ScoreTrack.BASE, rock, 3) } returns listOf(entry(1, "가", 900))
                every { scoreRepository.topDaily(any(), any(), any(), any(), any()) } returns emptyList()

                val boards = GameScoreService(gameRepository, scoreRepository).execute(GetActiveLeaderboardsUseCase.Query(8, 3))

                boards.size shouldBe 1
                boards[0].board shouldBe "rockfall"
                boards[0].boardName shouldBe "돌 막기"
                boards[0].boardNameEn shouldBe "Rocks"
                verify(exactly = 0) { scoreRepository.top(1L, ScoreTrack.BASE, water, any()) }
            }
        }

        `when`("게임이 보낸 보드 키가 카탈로그 선언에 아직 없으면") {
            then("기록은 그대로 싣고 이름만 빈다 — 키를 그대로 화면에 띄우지 않는다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val scoreRepository = mockk<GameScoreRepositoryPort>()
                val fresh = ScoreBoardKey.from("newmode")
                every { scoreRepository.activeBoards(any()) } returns listOf(ScoreBoardRef(1L, ScoreTrack.BASE, fresh))
                every { gameRepository.findByIds(listOf(1L)) } returns listOf(
                    game(1L, "bee-guard", scoreBoards = listOf(ScoreBoardDef("leak", "물 막기", "Water"))),
                )
                every { scoreRepository.top(1L, ScoreTrack.BASE, fresh, 3) } returns listOf(entry(1, "가", 900))
                every { scoreRepository.topDaily(any(), any(), any(), any(), any()) } returns emptyList()

                val boards = GameScoreService(gameRepository, scoreRepository).execute(GetActiveLeaderboardsUseCase.Query(8, 3))

                boards[0].board shouldBe "newmode"
                boards[0].boardName shouldBe null
                boards[0].entries.map { it.nickname } shouldContainExactly listOf("가")
            }
        }

        `when`("기록은 있지만 공개 상태가 아닌 게임이 섞여 있으면") {
            then("그 보드는 빼고 돌려줘야 한다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val scoreRepository = mockk<GameScoreRepositoryPort>()
                every { scoreRepository.activeBoards(any()) } returns listOf(
                    ScoreBoardRef(1L, ScoreTrack.BASE, default),
                    ScoreBoardRef(2L, ScoreTrack.BASE, default),
                )
                every { gameRepository.findByIds(listOf(1L, 2L)) } returns listOf(
                    game(1L, "suspended-game", GameStatus.SUSPENDED),
                    game(2L, "coin-corgi"),
                )
                every { scoreRepository.top(2L, ScoreTrack.BASE, default, 3) } returns listOf(entry(1, "나", 700))
                every { scoreRepository.topDaily(any(), any(), any(), any(), any()) } returns emptyList()

                val boards = GameScoreService(gameRepository, scoreRepository).execute(GetActiveLeaderboardsUseCase.Query(8, 3))

                boards.map { it.slug } shouldContainExactly listOf("coin-corgi")
            }
        }

        `when`("아무 게임에도 기록이 없으면") {
            then("빈 목록이어야 한다 — 허브는 이걸로 위젯 자체를 그리지 않는다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val scoreRepository = mockk<GameScoreRepositoryPort>()
                every { scoreRepository.activeBoards(any()) } returns emptyList()
                every { gameRepository.findByIds(emptyList()) } returns emptyList()

                GameScoreService(gameRepository, scoreRepository).execute(GetActiveLeaderboardsUseCase.Query(8, 3)) shouldBe emptyList()
            }
        }

        `when`("요청 개수가 범위를 벗어나면") {
            then("보드/항목 수를 상한과 하한으로 잘라야 한다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val scoreRepository = mockk<GameScoreRepositoryPort>()
                every { scoreRepository.activeBoards(any()) } returns
                    listOf(ScoreBoardRef(1L, ScoreTrack.BASE, default))
                every { gameRepository.findByIds(listOf(1L)) } returns listOf(game(1L, "coin-corgi"))
                every { scoreRepository.top(1L, ScoreTrack.BASE, default, 1) } returns listOf(entry(1, "나", 700))
                every { scoreRepository.topDaily(any(), any(), any(), any(), any()) } returns emptyList()

                GameScoreService(gameRepository, scoreRepository).execute(GetActiveLeaderboardsUseCase.Query(0, 0))

                // 0 → 1 로 올라가고, 집계는 여유분(×6)까지 긁는다 — 게임당 보드가 최대 3개가 됐다
                verify { scoreRepository.activeBoards(6) }
                verify { scoreRepository.top(1L, ScoreTrack.BASE, default, 1) }
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
                every { scores.top(1L, ScoreTrack.BASE, default, 10) } returns listOf(entry(1, "가", 900))

                GameScoreService(games, scores).execute(GetGameLeaderboardUseCase.Query("coin-corgi", ScoreTrack.BASE, 10))
                    .map { it.nickname } shouldContainExactly listOf("가")

                verify(exactly = 0) { scores.topDaily(any(), any(), any(), any(), any()) }
            }
        }

        `when`("board 를 생략하면") {
            then("기본 보드를 읽는다 — 모드를 안 나눈 게임 60여 종의 기존 계약이 그대로다") {
                val (games, scores) = serving("coin-corgi")
                every { scores.top(1L, ScoreTrack.BASE, default, 10) } returns listOf(entry(1, "가", 900))

                GameScoreService(games, scores).execute(GetGameLeaderboardUseCase.Query("coin-corgi", ScoreTrack.BASE, 10))

                verify { scores.top(1L, ScoreTrack.BASE, ScoreBoardKey.DEFAULT, 10) }
            }
        }

        `when`("board 를 지정하면") {
            then("그 보드만 읽는다 — 모드가 다르면 재는 자가 달라 한 표에 섞지 않는다") {
                val (games, scores) = serving("bee-guard")
                val rock = ScoreBoardKey.from("rockfall")
                every { scores.top(1L, ScoreTrack.BASE, rock, 10) } returns listOf(entry(1, "돌잡이", 798))

                GameScoreService(games, scores).execute(GetGameLeaderboardUseCase.Query("bee-guard", ScoreTrack.BASE, 10, rock))
                    .map { it.nickname } shouldContainExactly listOf("돌잡이")

                verify(exactly = 0) { scores.top(1L, ScoreTrack.BASE, ScoreBoardKey.DEFAULT, any()) }
            }
        }

        `when`("period=DAILY 이고 날짜를 주지 않으면") {
            then("KST 기준 오늘 보드를 읽는다") {
                val (games, scores) = serving("coin-corgi")
                every { scores.topDaily(1L, ScoreTrack.BASE, default, GameDay.today(), 10) } returns
                    listOf(entry(1, "나", 300))

                GameScoreService(games, scores)
                    .execute(GetGameLeaderboardUseCase.Query("coin-corgi", ScoreTrack.BASE, 10, default, ScorePeriod.DAILY))
                    .map { it.nickname } shouldContainExactly listOf("나")

                verify(exactly = 0) { scores.top(any(), any(), any(), any()) }
            }
        }

        `when`("보드와 기간을 함께 지정하면") {
            then("오늘 보드도 모드별로 갈린다 — 한쪽 축만 나누면 오늘의 1위가 다른 모드를 가리킨다") {
                val (games, scores) = serving("bee-guard")
                val bee = ScoreBoardKey.from("bee")
                every { scores.topDaily(1L, ScoreTrack.BASE, bee, GameDay.today(), 10) } returns
                    listOf(entry(1, "벌잡이", 383))

                GameScoreService(games, scores)
                    .execute(GetGameLeaderboardUseCase.Query("bee-guard", ScoreTrack.BASE, 10, bee, ScorePeriod.DAILY))
                    .map { it.nickname } shouldContainExactly listOf("벌잡이")
            }
        }

        `when`("지난 날짜를 지정하면") {
            then("그날의 보드를 읽는다 — 오늘로 조용히 바꾸지 않는다") {
                val (games, scores) = serving("coin-corgi")
                val past = LocalDate.of(2026, 8, 1)
                every { scores.topDaily(1L, ScoreTrack.BASE, default, past, 10) } returns listOf(entry(1, "다", 120))

                GameScoreService(games, scores)
                    .execute(GetGameLeaderboardUseCase.Query("coin-corgi", ScoreTrack.BASE, 10, default, ScorePeriod.DAILY, past))
                    .map { it.nickname } shouldContainExactly listOf("다")
            }
        }

        `when`("그날 아무도 안 놀았으면") {
            then("빈 목록이다 — 오류가 아니라 아직 비어 있는 보드다") {
                val (games, scores) = serving("coin-corgi")
                every { scores.topDaily(any(), any(), any(), any(), any()) } returns emptyList()

                GameScoreService(games, scores)
                    .execute(GetGameLeaderboardUseCase.Query("coin-corgi", ScoreTrack.BASE, 10, default, ScorePeriod.DAILY)) shouldBe emptyList()
            }
        }

        `when`("limit 이 범위를 벗어나면") {
            then("오늘 보드에도 같은 상·하한이 걸린다") {
                val (games, scores) = serving("coin-corgi")
                every { scores.topDaily(1L, ScoreTrack.BASE, default, GameDay.today(), 50) } returns emptyList()

                GameScoreService(games, scores)
                    .execute(GetGameLeaderboardUseCase.Query("coin-corgi", ScoreTrack.BASE, 999, default, ScorePeriod.DAILY))

                verify { scores.topDaily(1L, ScoreTrack.BASE, default, GameDay.today(), 50) }
            }
        }
    }

    given("점수를 제출할 때") {
        `when`("클라이언트가 날짜를 보내지 않아도") {
            then("서버가 정한 오늘(KST)을 함께 저장한다 — 기기 시계로 보드가 갈리지 않는다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val scoreRepository = mockk<GameScoreRepositoryPort>()
                every { gameRepository.findBySlug("coin-corgi") } returns game(1L, "coin-corgi")
                every {
                    scoreRepository.submit(1L, ScoreTrack.BASE, default, "가나", 900, null, GameDay.today())
                } returns (true to 1)

                GameScoreService(gameRepository, scoreRepository)
                    .execute(SubmitGameScoreUseCase.Command("coin-corgi", ScoreTrack.BASE, default, "가나", 900, null)) shouldBe (true to 1)

                verify { scoreRepository.submit(1L, ScoreTrack.BASE, default, "가나", 900, null, GameDay.today()) }
            }
        }

        `when`("게임이 카탈로그에 없는 보드 키로 올리면") {
            then("거절하지 않고 그대로 쌓는다 — 게임이 모드를 늘렸는데 시드가 늦은 순간에 기록을 버리게 된다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val scoreRepository = mockk<GameScoreRepositoryPort>()
                val fresh = ScoreBoardKey.from("newmode")
                every { gameRepository.findBySlug("bee-guard") } returns
                    game(1L, "bee-guard", scoreBoards = listOf(ScoreBoardDef("leak", "물 막기")))
                every {
                    scoreRepository.submit(1L, ScoreTrack.BASE, fresh, "가나", 900, null, GameDay.today())
                } returns (true to 1)

                GameScoreService(gameRepository, scoreRepository)
                    .execute(SubmitGameScoreUseCase.Command("bee-guard", ScoreTrack.BASE, fresh, "가나", 900, null)) shouldBe (true to 1)
            }
        }
    }

    given("허브 레일이 오늘 기록을 함께 받을 때") {
        `when`("오늘 기록이 있는 보드와 없는 보드가 섞여 있으면") {
            then("요청을 한 번 더 하지 않고 한 응답에 둘 다 실린다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val scoreRepository = mockk<GameScoreRepositoryPort>()
                every { scoreRepository.activeBoards(any()) } returns listOf(
                    ScoreBoardRef(1L, ScoreTrack.BASE, default),
                    ScoreBoardRef(2L, ScoreTrack.BASE, default),
                )
                every { gameRepository.findByIds(listOf(1L, 2L)) } returns
                    listOf(game(1L, "abyssal-crown"), game(2L, "coin-corgi"))
                every { scoreRepository.top(1L, ScoreTrack.BASE, default, 3) } returns listOf(entry(1, "가", 900))
                every { scoreRepository.top(2L, ScoreTrack.BASE, default, 3) } returns listOf(entry(1, "나", 700))
                every { scoreRepository.topDaily(1L, ScoreTrack.BASE, default, GameDay.today(), 3) } returns
                    listOf(entry(1, "오늘1등", 400))
                every { scoreRepository.topDaily(2L, ScoreTrack.BASE, default, GameDay.today(), 3) } returns emptyList()

                val boards = GameScoreService(gameRepository, scoreRepository).execute(GetActiveLeaderboardsUseCase.Query(8, 3))

                boards[0].todayEntries.map { it.nickname } shouldContainExactly listOf("오늘1등")
                boards[1].todayEntries shouldBe emptyList()
            }
        }
    }
})
