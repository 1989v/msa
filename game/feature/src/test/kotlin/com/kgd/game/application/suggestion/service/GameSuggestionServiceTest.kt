package com.kgd.game.application.suggestion.service

import com.kgd.common.exception.BusinessException
import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.suggestion.port.GameSuggestionRepositoryPort
import com.kgd.game.application.suggestion.port.SuggestionReplyRepositoryPort
import com.kgd.game.application.suggestion.usecase.ChangeGameSuggestionStatusUseCase
import com.kgd.game.application.suggestion.usecase.CreateGameSuggestionUseCase
import com.kgd.game.application.suggestion.usecase.EditGameSuggestionUseCase
import com.kgd.game.application.suggestion.usecase.ListGameSuggestionsAdminUseCase
import com.kgd.game.application.suggestion.usecase.ListGameSuggestionsUseCase
import com.kgd.game.application.suggestion.usecase.ReplyToGameSuggestionUseCase
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation
import com.kgd.game.domain.suggestion.model.GameSuggestion
import com.kgd.game.domain.suggestion.model.ReplyAuthorType
import com.kgd.game.domain.suggestion.model.SuggestionReply
import com.kgd.game.domain.suggestion.model.SuggestionStatus
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import java.time.LocalDateTime

class GameSuggestionServiceTest : BehaviorSpec({

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
        scoreBoards = emptyList(),
        releasedAt = null,
        contentUpdatedAt = null,
    )

    fun suggestion(
        id: Long = 1L,
        gameId: Long = 100L,
        memberId: Long = 7L,
        status: SuggestionStatus = SuggestionStatus.OPEN,
        createdAt: LocalDateTime? = null,
        updatedAt: LocalDateTime? = null,
    ) = GameSuggestion.restore(
        id = id,
        gameId = gameId,
        memberId = memberId,
        nickname = "활잡이",
        body = "2스테이지 보스가 너무 빠릅니다",
        status = status,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )

    given("제안을 등록할 때") {
        `when`("공개된 게임이면") {
            then("접수 상태로 저장되고 자기 글로 돌아온다") {
                val games = mockk<GameRepositoryPort>()
                val suggestions = mockk<GameSuggestionRepositoryPort>()
                val replies = mockk<SuggestionReplyRepositoryPort>()
                every { games.findBySlug("archer-outbreak") } returns game(100L, "archer-outbreak")
                val saved = slot<GameSuggestion>()
                every { suggestions.save(capture(saved)) } answers { suggestion() }

                val dto = GameSuggestionService(games, suggestions, replies).execute(
                    CreateGameSuggestionUseCase.Command("archer-outbreak", 7L, "활잡이", "2스테이지 보스가 너무 빠릅니다")
                )

                saved.captured.gameId shouldBe 100L
                saved.captured.status shouldBe SuggestionStatus.OPEN
                dto.mine shouldBe true
                dto.status shouldBe SuggestionStatus.OPEN
            }
        }

        `when`("아직 공개되지 않은 게임이면") {
            then("존재를 숨긴다 — 카탈로그와 같은 판정이다") {
                val games = mockk<GameRepositoryPort>()
                every { games.findBySlug("secret") } returns game(101L, "secret", GameStatus.DRAFT)

                shouldThrow<GameNotFoundException> {
                    GameSuggestionService(games, mockk(), mockk()).execute(
                        CreateGameSuggestionUseCase.Command("secret", 7L, "활잡이", "미공개 게임에 제안")
                    )
                }
            }
        }
    }

    given("제안을 수정할 때") {
        `when`("주소의 게임과 제안의 게임이 다르면") {
            then("다른 게임의 주소로는 열 수 없다") {
                val games = mockk<GameRepositoryPort>()
                val suggestions = mockk<GameSuggestionRepositoryPort>()
                every { games.findBySlug("coin-corgi") } returns game(200L, "coin-corgi")
                every { suggestions.findById(1L) } returns suggestion(gameId = 100L)

                shouldThrow<BusinessException> {
                    GameSuggestionService(games, suggestions, mockk()).execute(
                        EditGameSuggestionUseCase.Command("coin-corgi", 1L, 7L, "다른 게임에서 수정")
                    )
                }
            }
        }

        `when`("남의 제안이면") {
            then("거부한다 — 판정은 도메인이 한다") {
                val games = mockk<GameRepositoryPort>()
                val suggestions = mockk<GameSuggestionRepositoryPort>()
                every { games.findBySlug("archer-outbreak") } returns game(100L, "archer-outbreak")
                every { suggestions.findById(1L) } returns suggestion(memberId = 7L)

                shouldThrow<BusinessException> {
                    GameSuggestionService(games, suggestions, mockk()).execute(
                        EditGameSuggestionUseCase.Command("archer-outbreak", 1L, 8L, "남의 글 고치기")
                    )
                }
            }
        }
    }

    given("답글을 달 때") {
        `when`("운영자 역할로 들어오면") {
            then("자격이 OPERATOR 로 저장된다") {
                val games = mockk<GameRepositoryPort>()
                val suggestions = mockk<GameSuggestionRepositoryPort>()
                val replies = mockk<SuggestionReplyRepositoryPort>()
                every { games.findBySlug("archer-outbreak") } returns game(100L, "archer-outbreak")
                every { suggestions.findById(1L) } returns suggestion()
                val saved = slot<SuggestionReply>()
                every { replies.save(capture(saved)) } answers { saved.captured }

                val dto = GameSuggestionService(games, suggestions, replies).execute(
                    ReplyToGameSuggestionUseCase.Command("archer-outbreak", 1L, 99L, isOperator = true, body = "1.2 에서 낮췄습니다")
                )

                saved.captured.authorType shouldBe ReplyAuthorType.OPERATOR
                dto.authorType shouldBe ReplyAuthorType.OPERATOR
                dto.authorName shouldBe GameSuggestion.OPERATOR_NAME
            }
        }

        `when`("제안자도 운영자도 아니면") {
            then("거부한다") {
                val games = mockk<GameRepositoryPort>()
                val suggestions = mockk<GameSuggestionRepositoryPort>()
                every { games.findBySlug("archer-outbreak") } returns game(100L, "archer-outbreak")
                every { suggestions.findById(1L) } returns suggestion(memberId = 7L)

                shouldThrow<BusinessException> {
                    GameSuggestionService(games, suggestions, mockk()).execute(
                        ReplyToGameSuggestionUseCase.Command("archer-outbreak", 1L, 8L, isOperator = false, body = "저도요")
                    )
                }
            }
        }
    }

    given("게임 상세의 제안 목록을 볼 때") {
        `when`("로그인해서 보면") {
            then("자기 글에만 mine 이 서고, 답글은 한 번에 붙는다") {
                val games = mockk<GameRepositoryPort>()
                val suggestions = mockk<GameSuggestionRepositoryPort>()
                val replies = mockk<SuggestionReplyRepositoryPort>()
                every { games.findBySlug("archer-outbreak") } returns game(100L, "archer-outbreak")
                every { suggestions.search(100L, null, any()) } returns PageImpl(
                    listOf(suggestion(id = 1L, memberId = 7L), suggestion(id = 2L, memberId = 8L)),
                    PageRequest.of(0, 20),
                    2,
                )
                val mine = suggestion(id = 1L)
                every { replies.findBySuggestionIds(listOf(1L, 2L)) } returns
                    listOf(mine.reply(memberId = 99L, isOperator = true, body = "확인했습니다"))

                val page = GameSuggestionQueryService(games, suggestions, replies).execute(
                    ListGameSuggestionsUseCase.Query("archer-outbreak", null, 0, 20, viewerId = 7L)
                )

                page.content.map { it.mine } shouldBe listOf(true, false)
                page.content[0].replies.map { it.body } shouldBe listOf("확인했습니다")
                page.content[1].replies shouldBe emptyList()
            }
        }

        `when`("비로그인으로 보면") {
            then("내용은 다 보이고 mine 만 전부 false 다") {
                val games = mockk<GameRepositoryPort>()
                val suggestions = mockk<GameSuggestionRepositoryPort>()
                val replies = mockk<SuggestionReplyRepositoryPort>()
                every { games.findBySlug("archer-outbreak") } returns game(100L, "archer-outbreak")
                every { suggestions.search(100L, null, any()) } returns
                    PageImpl(listOf(suggestion(id = 1L, memberId = 7L)), PageRequest.of(0, 20), 1)
                every { replies.findBySuggestionIds(listOf(1L)) } returns emptyList()

                val page = GameSuggestionQueryService(games, suggestions, replies).execute(
                    ListGameSuggestionsUseCase.Query("archer-outbreak", null, 0, 20, viewerId = null)
                )

                page.content[0].mine shouldBe false
                page.content[0].body shouldBe "2스테이지 보스가 너무 빠릅니다"
            }
        }

        `when`("작성 직후라 저장 시각이 밀리초만 다르면") {
            then("「수정됨」으로 표시하지 않는다") {
                val games = mockk<GameRepositoryPort>()
                val suggestions = mockk<GameSuggestionRepositoryPort>()
                val replies = mockk<SuggestionReplyRepositoryPort>()
                val created = LocalDateTime.of(2026, 9, 1, 10, 0, 0, 100_000_000)
                every { games.findBySlug("archer-outbreak") } returns game(100L, "archer-outbreak")
                every { suggestions.search(100L, null, any()) } returns PageImpl(
                    listOf(suggestion(createdAt = created, updatedAt = created.withNano(900_000_000))),
                    PageRequest.of(0, 20),
                    1,
                )
                every { replies.findBySuggestionIds(listOf(1L)) } returns emptyList()

                val page = GameSuggestionQueryService(games, suggestions, replies).execute(
                    ListGameSuggestionsUseCase.Query("archer-outbreak", null, 0, 20, null)
                )

                page.content[0].edited shouldBe false
            }
        }
    }

    given("백오피스에서 볼 때") {
        `when`("아직 공개되지 않은 게임의 제안이면") {
            then("목록에 그대로 실린다 — 공개 API 와 판정이 다르다") {
                val games = mockk<GameRepositoryPort>()
                val suggestions = mockk<GameSuggestionRepositoryPort>()
                val replies = mockk<SuggestionReplyRepositoryPort>()
                every { suggestions.search(null, SuggestionStatus.OPEN, any()) } returns
                    PageImpl(listOf(suggestion(gameId = 101L)), PageRequest.of(0, 30), 1)
                every { games.findByIds(listOf(101L)) } returns listOf(game(101L, "secret", GameStatus.DRAFT))
                every { replies.findBySuggestionIds(listOf(1L)) } returns emptyList()

                val page = GameSuggestionAdminService(games, suggestions, replies).execute(
                    ListGameSuggestionsAdminUseCase.Query(null, SuggestionStatus.OPEN, 0, 30)
                )

                page.content.map { it.gameSlug } shouldBe listOf("secret")
            }
        }

        `when`("상태를 반영으로 바꾸면") {
            then("본문은 그대로 두고 상태만 저장한다") {
                val games = mockk<GameRepositoryPort>()
                val suggestions = mockk<GameSuggestionRepositoryPort>()
                val replies = mockk<SuggestionReplyRepositoryPort>()
                every { suggestions.findById(1L) } returns suggestion()
                val saved = slot<GameSuggestion>()
                every { suggestions.save(capture(saved)) } answers { saved.captured }
                every { games.findByIds(listOf(100L)) } returns listOf(game(100L, "archer-outbreak"))
                every { replies.findBySuggestionIds(listOf(1L)) } returns emptyList()

                val dto = GameSuggestionAdminService(games, suggestions, replies).execute(
                    ChangeGameSuggestionStatusUseCase.Command(1L, SuggestionStatus.APPLIED)
                )

                saved.captured.status shouldBe SuggestionStatus.APPLIED
                saved.captured.body shouldBe "2스테이지 보스가 너무 빠릅니다"
                dto.status shouldBe SuggestionStatus.APPLIED
                dto.gameSlug shouldBe "archer-outbreak"
            }
        }
    }
})
