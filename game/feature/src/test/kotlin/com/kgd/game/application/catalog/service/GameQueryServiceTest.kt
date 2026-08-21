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
import org.springframework.data.domain.PageRequest
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

    given("큐레이션 행 간 중복 제거 시") {
        fun collectionOf(
            id: Long,
            slug: String,
            type: CollectionType,
            displayOrder: Int,
            tagSlug: String? = null,
            gameIds: List<Long> = emptyList(),
        ) = GameCollection.restore(
            id = id, slug = slug, title = slug, type = type,
            tagSlug = tagSlug, displayOrder = displayOrder, active = true, gameIds = gameIds,
        )

        `when`("같은 게임이 신작·인기 산출에 모두 오르면") {
            then("NEW 행이 갖고 TRENDING 은 다음 인기 게임으로 채운다 — 노출 순서는 display_order 그대로") {
                val gameRepository = mockk<GameRepositoryPort>()
                val statsRepository = mockk<GameStatsRepositoryPort>()
                val collectionRepository = mockk<GameCollectionRepositoryPort>()
                val service = GameQueryService(gameRepository, statsRepository, mockk(), collectionRepository)

                every { collectionRepository.findActive() } returns listOf(
                    collectionOf(1L, "trending", CollectionType.TRENDING, displayOrder = 1),
                    collectionOf(2L, "new-games", CollectionType.NEW, displayOrder = 2),
                )
                val fresh = gameWith(1L, "fresh", GameStatus.PUBLISHED)
                val backfill = gameWith(2L, "backfill", GameStatus.PUBLISHED)
                every { gameRepository.search(null, null, GameSort.NEW, any()) } returns PageImpl(listOf(fresh))
                every { gameRepository.search(null, null, GameSort.TRENDING, any()) } returns
                    PageImpl(listOf(fresh, backfill))
                every { statsRepository.findByGameIds(any()) } returns emptyList()

                val collections = service.collections()

                collections.map { it.slug } shouldBe listOf("trending", "new-games")
                collections[0].games.map { it.slug } shouldBe listOf("backfill")
                collections[1].games.map { it.slug } shouldBe listOf("fresh")
            }
        }

        `when`("운영자가 놓은 게임이 다른 행과 겹치면") {
            then("MANUAL 행과 자동 행의 상단 고정은 걷어내지 않는다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val statsRepository = mockk<GameStatsRepositoryPort>()
                val collectionRepository = mockk<GameCollectionRepositoryPort>()
                val service = GameQueryService(gameRepository, statsRepository, mockk(), collectionRepository)

                val alpha = gameWith(1L, "alpha", GameStatus.PUBLISHED)
                every { collectionRepository.findActive() } returns listOf(
                    collectionOf(1L, "editors-pick", CollectionType.MANUAL, displayOrder = 1, gameIds = listOf(1L)),
                    collectionOf(2L, "new-games", CollectionType.NEW, displayOrder = 2),
                    collectionOf(3L, "trending", CollectionType.TRENDING, displayOrder = 3, gameIds = listOf(1L)),
                )
                every { gameRepository.findByIds(listOf(1L)) } returns listOf(alpha)
                // alpha 는 MANUAL 이 이미 가져갔지만 신작 산출에도 올라 있다
                every { gameRepository.search(null, null, GameSort.NEW, any()) } returns
                    PageImpl(listOf(alpha, gameWith(2L, "nova", GameStatus.PUBLISHED)))
                every { gameRepository.search(null, null, GameSort.TRENDING, any()) } returns
                    PageImpl(listOf(gameWith(3L, "hit", GameStatus.PUBLISHED)))
                every { statsRepository.findByGameIds(any()) } returns emptyList()

                val collections = service.collections()

                collections[0].games.map { it.slug } shouldBe listOf("alpha")
                collections[1].games.map { it.slug } shouldBe listOf("nova")
                // 상단 고정은 다른 행에 이미 실렸어도 남는다 — 운영자 배치가 중복 제거보다 세다
                collections[2].games.map { it.slug } shouldBe listOf("alpha", "hit")
            }
        }

        `when`("산출 목록이 정원을 넘으면") {
            then("여유분 20개를 받아 걷어낸 뒤 10개로 자른다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val statsRepository = mockk<GameStatsRepositoryPort>()
                val collectionRepository = mockk<GameCollectionRepositoryPort>()
                val service = GameQueryService(gameRepository, statsRepository, mockk(), collectionRepository)

                every { collectionRepository.findActive() } returns listOf(
                    collectionOf(1L, "trending", CollectionType.TRENDING, displayOrder = 1),
                )
                // 페이지 크기까지 정확히 매칭 — 여유분을 안 받으면 이 스텁에 안 걸려 실패한다
                every { gameRepository.search(null, null, GameSort.TRENDING, PageRequest.of(0, 20)) } returns
                    PageImpl((1L..12L).map { gameWith(it, "game-$it", GameStatus.PUBLISHED) })
                every { statsRepository.findByGameIds(any()) } returns emptyList()

                service.collections()[0].games.size shouldBe 10
            }
        }

        `when`("행을 채울 게임이 하나도 없으면") {
            then("빈 행은 응답에서 뺀다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val statsRepository = mockk<GameStatsRepositoryPort>()
                val collectionRepository = mockk<GameCollectionRepositoryPort>()
                val service = GameQueryService(gameRepository, statsRepository, mockk(), collectionRepository)

                every { collectionRepository.findActive() } returns listOf(
                    collectionOf(1L, "retro", CollectionType.TAG_BASED, displayOrder = 1, tagSlug = "retro"),
                    collectionOf(2L, "new-games", CollectionType.NEW, displayOrder = 2),
                )
                every { gameRepository.search("retro", null, GameSort.TRENDING, any()) } returns
                    PageImpl(emptyList())
                every { gameRepository.search(null, null, GameSort.NEW, any()) } returns
                    PageImpl(listOf(gameWith(1L, "fresh", GameStatus.PUBLISHED)))
                every { statsRepository.findByGameIds(any()) } returns emptyList()

                service.collections().map { it.slug } shouldBe listOf("new-games")
            }
        }
    }
})
