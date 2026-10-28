package com.kgd.game.application.catalog.service

import com.kgd.common.exception.BusinessException
import com.kgd.game.application.catalog.port.GamePlatformReleasePort
import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.catalog.usecase.PutGamePlatformReleaseUseCase
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.GamePlatform
import com.kgd.game.domain.catalog.model.PlatformAudience
import com.kgd.game.domain.catalog.model.PlatformReleaseStatus
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify

class GamePlatformReleaseServiceTest : BehaviorSpec({
    fun game(id: Long) = Game.create(slug = "game-$id", title = "Game $id", description = "",
        thumbnailUrl = "/t.png", engineType = EngineType.HTML5, loadType = LoadType.IFRAME,
        entryUrl = "/games/game-$id/", developerName = "test").let { original ->
            mockk<Game> { every { this@mockk.id } returns id; every { slug } returns original.slug; every { isPlayable() } returns true }
        }
    given("admin platform release replacement") {
        then("normalizes URLs, preserves createdAt, and allows explicit draft clearing") {
            val games = mockk<GameRepositoryPort>()
            val releases = mockk<GamePlatformReleasePort>()
            every { games.findBySlug("game-1") } returns game(1)
            every { releases.findByGameIds(listOf(1)) } returns emptyList()
            every { releases.save(any()) } answers { firstArg() }
            val service = GamePlatformReleaseService(games, releases)
            val release = service.execute(PutGamePlatformReleaseUseCase.Command("game-1", GamePlatform.ROBLOX,
                "https://www.roblox.com/games/123/Game", PlatformReleaseStatus.BETA, PlatformAudience.PUBLIC))
            release.platformRef shouldBe "123"
            every { releases.findByGameIds(listOf(1)) } returns listOf(release)
            val cleared = service.execute(PutGamePlatformReleaseUseCase.Command("game-1", GamePlatform.ROBLOX,
                null, PlatformReleaseStatus.DRAFT, PlatformAudience.INVITE_ONLY))
            cleared.createdAt shouldBe release.createdAt
            cleared.platformRef shouldBe null
            cleared.isPublic() shouldBe false
        }
        then("rejects missing games and invalid launched releases before saving") {
            val games = mockk<GameRepositoryPort>()
            val releases = mockk<GamePlatformReleasePort>(relaxed = true)
            val service = GamePlatformReleaseService(games, releases)
            every { games.findBySlug("missing") } returns null
            shouldThrow<GameNotFoundException> { service.execute("missing") }
            every { games.findBySlug("game-1") } returns game(1)
            shouldThrow<BusinessException> { service.execute(PutGamePlatformReleaseUseCase.Command("game-1", GamePlatform.ROBLOX,
                null, PlatformReleaseStatus.RELEASED, PlatformAudience.PUBLIC)) }
            verify(exactly = 0) { releases.save(any()) }
        }
    }
})
