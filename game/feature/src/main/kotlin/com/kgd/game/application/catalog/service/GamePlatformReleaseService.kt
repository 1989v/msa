package com.kgd.game.application.catalog.service

import com.kgd.game.application.catalog.port.GamePlatformReleasePort
import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.catalog.usecase.GetGamePlatformReleasesUseCase
import com.kgd.game.application.catalog.usecase.PutGamePlatformReleaseUseCase
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.catalog.model.GamePlatformRelease
import com.kgd.game.domain.catalog.model.RobloxPlaceId
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
@Transactional(transactionManager = "gameTransactionManager")
class GamePlatformReleaseService(
    private val games: GameRepositoryPort,
    private val releases: GamePlatformReleasePort,
) : GetGamePlatformReleasesUseCase, PutGamePlatformReleaseUseCase {
    @Transactional(transactionManager = "gameTransactionManager", readOnly = true)
    override fun execute(slug: String): List<GamePlatformRelease> {
        val gameId = games.findBySlug(slug)?.id ?: throw GameNotFoundException(slug)
        return releases.findByGameIds(listOf(gameId))
    }
    override fun execute(command: PutGamePlatformReleaseUseCase.Command): GamePlatformRelease {
        val gameId = games.findBySlug(command.slug)?.id ?: throw GameNotFoundException(command.slug)
        val previous = releases.findByGameIds(listOf(gameId)).find { it.platform == command.platform }
        return releases.save(GamePlatformRelease(
            gameId, command.platform, RobloxPlaceId.normalize(command.platformRef), command.releaseStatus,
            command.audience, previous?.createdAt ?: Instant.now(), Instant.now(),
        ))
    }
}
