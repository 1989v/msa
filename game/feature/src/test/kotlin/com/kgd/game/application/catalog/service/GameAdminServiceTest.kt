package com.kgd.game.application.catalog.service

import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.catalog.port.GameStatsRepositoryPort
import com.kgd.game.domain.catalog.exception.InvalidGameStatusException
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk

class GameAdminServiceTest : BehaviorSpec({

    fun gameWith(status: GameStatus, titleEn: String? = null, descriptionEn: String? = null): Game = Game.restore(
        id = 1L,
        slug = "alpha",
        title = "알파",
        description = "설명",
        titleEn = titleEn,
        descriptionEn = descriptionEn,
        thumbnailUrl = "/t.png",
        coverUrl = null,
        engineType = EngineType.HTML5,
        loadType = LoadType.IFRAME,
        entryUrl = "/games/alpha/index.html",
        orientation = Orientation.BOTH,
        supportsMobile = true,
        developerName = "kgd",
        sdkIntegrated = false,
        status = status,
        genre = Genre.CASUAL,
        tags = emptyList(),
        releasedAt = null,
        contentUpdatedAt = null,
    )

    fun serviceOf(game: Game): GameAdminService {
        val gameRepository = mockk<GameRepositoryPort>()
        val statsRepository = mockk<GameStatsRepositoryPort>()
        every { gameRepository.findBySlug("alpha") } returns game
        every { gameRepository.save(any()) } answers { firstArg() }
        every { statsRepository.findByGameId(1L) } returns null
        return GameAdminService(gameRepository, statsRepository, mockk())
    }

    given("상태 전이 요청 시") {
        `when`("BETA 게임에 PUBLISH 를 요청하면") {
            then("PUBLISHED 로 전이된다") {
                val service = serviceOf(gameWith(GameStatus.BETA))
                service.changeStatus("alpha", GameStatusAction.PUBLISH).status shouldBe GameStatus.PUBLISHED
            }
        }

        `when`("PUBLISHED 게임에 SUSPEND 후 RESUME 을 요청하면") {
            then("SUSPENDED 를 거쳐 다시 PUBLISHED 가 된다") {
                val game = gameWith(GameStatus.PUBLISHED)
                val service = serviceOf(game)
                service.changeStatus("alpha", GameStatusAction.SUSPEND).status shouldBe GameStatus.SUSPENDED
                service.changeStatus("alpha", GameStatusAction.RESUME).status shouldBe GameStatus.PUBLISHED
            }
        }

        `when`("DRAFT 게임에 PUBLISH 를 요청하면") {
            then("상태머신이 거부해야 한다") {
                val service = serviceOf(gameWith(GameStatus.DRAFT))
                shouldThrow<InvalidGameStatusException> { service.changeStatus("alpha", GameStatusAction.PUBLISH) }
            }
        }

        `when`("SUSPENDED 게임에 SUSPEND 를 다시 요청하면") {
            then("상태머신이 거부해야 한다") {
                val service = serviceOf(gameWith(GameStatus.SUSPENDED))
                shouldThrow<InvalidGameStatusException> { service.changeStatus("alpha", GameStatusAction.SUSPEND) }
            }
        }
    }

    given("메타데이터 수정 시") {
        `when`("영문 제목/설명을 채우면") {
            then("SEO 필드가 갱신된다") {
                val service = serviceOf(gameWith(GameStatus.PUBLISHED))

                val updated = service.updateMetadata(
                    slug = "alpha",
                    title = "알파 리마스터",
                    description = null,
                    titleEn = "Alpha Remastered",
                    descriptionEn = "An arcade classic",
                    thumbnailUrl = "/t2.png",
                    coverUrl = null,
                    orientation = null,
                    supportsMobile = null,
                    developerName = null,
                    genre = Genre.ARCADE,
                )

                updated.title shouldBe "알파 리마스터"
                updated.titleEn shouldBe "Alpha Remastered"
                updated.descriptionEn shouldBe "An arcade classic"
                updated.thumbnailUrl shouldBe "/t2.png"
                updated.genre shouldBe Genre.ARCADE
            }
        }

        `when`("영문 제목을 공백으로 보내면") {
            then("빈 문자열이 아니라 null 로 비워져야 한다") {
                val service = serviceOf(gameWith(GameStatus.PUBLISHED, titleEn = "Alpha"))

                val updated = service.updateMetadata(
                    slug = "alpha",
                    title = null,
                    description = null,
                    titleEn = "",
                    descriptionEn = null,
                    thumbnailUrl = null,
                    coverUrl = null,
                    orientation = null,
                    supportsMobile = null,
                    developerName = null,
                    genre = null,
                )

                updated.titleEn shouldBe null
            }
        }
    }
})
