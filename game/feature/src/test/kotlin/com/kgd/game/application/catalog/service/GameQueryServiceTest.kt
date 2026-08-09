package com.kgd.game.application.catalog.service

import com.kgd.game.application.catalog.port.GameCollectionRepositoryPort
import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.catalog.port.GameStatsRepositoryPort
import com.kgd.game.application.catalog.port.GameTagRepositoryPort
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.catalog.model.CollectionType
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.GameCollection
import com.kgd.game.domain.catalog.model.GameStats
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import org.springframework.data.domain.PageImpl
import java.time.Instant

class GameQueryServiceTest : BehaviorSpec({

    fun gameWith(id: Long, slug: String, status: GameStatus): Game = Game.restore(
        id = id,
        slug = slug,
        title = slug,
        description = "",
        thumbnailUrl = "/t.png",
        coverUrl = null,
        engineType = EngineType.HTML5,
        loadType = LoadType.IFRAME,
        entryUrl = "/game-assets/$slug/",
        orientation = Orientation.BOTH,
        supportsMobile = true,
        developerName = "kgd",
        sdkIntegrated = false,
        status = status,
        genre = Genre.CASUAL,
        tags = listOf("puzzle"),
        releasedAt = Instant.parse("2026-07-01T00:00:00Z"),
        contentUpdatedAt = null,
    )

    given("게임 상세 조회 시") {
        `when`("PUBLISHED 게임이면") {
            then("통계와 함께 반환되어야 한다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val statsRepository = mockk<GameStatsRepositoryPort>()
                val service = GameQueryService(gameRepository, statsRepository, mockk(), mockk())

                every { gameRepository.findBySlug("alpha") } returns gameWith(1L, "alpha", GameStatus.PUBLISHED)
                every { statsRepository.findByGameId(1L) } returns
                    GameStats.restore(gameId = 1L, playCount = 120, ratingSum = 91, ratingCount = 10, weeklyPlayCount = 12)

                val detail = service.detail("alpha")

                detail.slug shouldBe "alpha"
                detail.playCount shouldBe 120
                detail.ratingAvg shouldBe 9.1
            }
        }

        `when`("DRAFT 게임이면") {
            then("존재를 숨기고 GameNotFoundException 이어야 한다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val service = GameQueryService(gameRepository, mockk(), mockk(), mockk())
                every { gameRepository.findBySlug("hidden") } returns gameWith(2L, "hidden", GameStatus.DRAFT)

                shouldThrow<GameNotFoundException> { service.detail("hidden") }
            }
        }

        `when`("SUSPENDED 게임이면") {
            then("마찬가지로 GameNotFoundException 이어야 한다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val service = GameQueryService(gameRepository, mockk(), mockk(), mockk())
                every { gameRepository.findBySlug("stopped") } returns gameWith(3L, "stopped", GameStatus.SUSPENDED)

                shouldThrow<GameNotFoundException> { service.detail("stopped") }
            }
        }
    }

    given("홈 큐레이션 조회 시") {
        `when`("MANUAL 컬렉션이면") {
            then("지정한 순서대로 게임이 채워져야 한다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val statsRepository = mockk<GameStatsRepositoryPort>()
                val collectionRepository = mockk<GameCollectionRepositoryPort>()
                val tagRepository = mockk<GameTagRepositoryPort>()
                val service = GameQueryService(gameRepository, statsRepository, tagRepository, collectionRepository)

                every { collectionRepository.findActive() } returns listOf(
                    GameCollection.restore(
                        id = 1L,
                        slug = "editors-pick",
                        title = "Editor's Pick",
                        type = CollectionType.MANUAL,
                        tagSlug = null,
                        displayOrder = 1,
                        active = true,
                        gameIds = listOf(2L, 1L),
                    )
                )
                every { gameRepository.findByIds(listOf(2L, 1L)) } returns listOf(
                    gameWith(1L, "alpha", GameStatus.PUBLISHED),
                    gameWith(2L, "beta", GameStatus.PUBLISHED),
                )
                every { statsRepository.findByGameIds(listOf(2L, 1L)) } returns emptyList()

                val collections = service.collections()

                collections.size shouldBe 1
                collections[0].games.map { it.slug } shouldBe listOf("beta", "alpha")
                collections[0].games[0].ratingAvg shouldBe 0.0
            }
        }

        `when`("MANUAL 컬렉션에 공개 불가 상태 게임이 섞여 있으면") {
            then("공개 목록에서 빠진다 — findByIds 는 상태를 거르지 않는다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val statsRepository = mockk<GameStatsRepositoryPort>()
                val collectionRepository = mockk<GameCollectionRepositoryPort>()
                val tagRepository = mockk<GameTagRepositoryPort>()
                val service = GameQueryService(gameRepository, statsRepository, tagRepository, collectionRepository)

                every { collectionRepository.findActive() } returns listOf(
                    GameCollection.restore(
                        id = 1L, slug = "editors-pick", title = "Editor's Pick",
                        type = CollectionType.MANUAL, tagSlug = null, displayOrder = 1,
                        active = true, gameIds = listOf(1L, 2L),
                    )
                )
                every { gameRepository.findByIds(listOf(1L, 2L)) } returns listOf(
                    gameWith(1L, "alpha", GameStatus.PUBLISHED),
                    gameWith(2L, "hidden", GameStatus.DRAFT),
                )
                every { statsRepository.findByGameIds(listOf(1L)) } returns emptyList()

                service.collections()[0].games.map { it.slug } shouldBe listOf("alpha")
            }
        }

        `when`("자동 산출 컬렉션(TRENDING)에 gameIds 가 있으면") {
            then("그 게임들이 맨 앞에 고정되고 나머지는 산출 순서대로 이어진다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val statsRepository = mockk<GameStatsRepositoryPort>()
                val collectionRepository = mockk<GameCollectionRepositoryPort>()
                val tagRepository = mockk<GameTagRepositoryPort>()
                val service = GameQueryService(gameRepository, statsRepository, tagRepository, collectionRepository)

                every { collectionRepository.findActive() } returns listOf(
                    GameCollection.restore(
                        id = 2L, slug = "trending", title = "지금 인기",
                        type = CollectionType.TRENDING, tagSlug = null, displayOrder = 2,
                        active = true, gameIds = listOf(3L),
                    )
                )
                every { gameRepository.findByIds(listOf(3L)) } returns
                    listOf(gameWith(3L, "pinned", GameStatus.PUBLISHED))
                every { gameRepository.search(null, null, GameSort.TRENDING, any()) } returns
                    PageImpl(
                        listOf(
                            gameWith(1L, "top", GameStatus.PUBLISHED),
                            // 고정된 게임이 산출 목록에도 있으면 중복되지 않아야 한다
                            gameWith(3L, "pinned", GameStatus.PUBLISHED),
                        )
                    )
                every { statsRepository.findByGameIds(any()) } returns emptyList()

                service.collections()[0].games.map { it.slug } shouldBe listOf("pinned", "top")
            }
        }
    }
})
