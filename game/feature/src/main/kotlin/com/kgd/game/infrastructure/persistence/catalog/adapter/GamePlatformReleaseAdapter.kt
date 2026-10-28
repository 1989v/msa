package com.kgd.game.infrastructure.persistence.catalog.adapter

import com.kgd.game.application.catalog.port.GamePlatformReleasePort
import com.kgd.game.domain.catalog.model.GamePlatformRelease
import com.kgd.game.infrastructure.persistence.catalog.entity.GamePlatformReleaseJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.repository.GamePlatformReleaseJpaRepository
import org.springframework.stereotype.Component

@Component
class GamePlatformReleaseAdapter(private val repository: GamePlatformReleaseJpaRepository) : GamePlatformReleasePort {
    override fun findByGameIds(gameIds: List<Long>): List<GamePlatformRelease> =
        if (gameIds.isEmpty()) emptyList() else repository.findByGameIdIn(gameIds.distinct()).map { it.toDomain() }
    override fun save(release: GamePlatformRelease): GamePlatformRelease {
        val entity = repository.findByGameIdAndPlatform(release.gameId, release.platform)
            ?.apply { replace(release) } ?: GamePlatformReleaseJpaEntity.fromDomain(release)
        return repository.save(entity).toDomain()
    }
}
