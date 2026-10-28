package com.kgd.game.application.catalog.port

import com.kgd.game.domain.catalog.model.GamePlatformRelease

interface GamePlatformReleasePort {
    fun findByGameIds(gameIds: List<Long>): List<GamePlatformRelease>
    fun save(release: GamePlatformRelease): GamePlatformRelease
}
