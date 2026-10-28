package com.kgd.game.infrastructure.persistence.catalog.repository

import com.kgd.game.domain.catalog.model.GamePlatform
import com.kgd.game.infrastructure.persistence.catalog.entity.GamePlatformReleaseJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface GamePlatformReleaseJpaRepository : JpaRepository<GamePlatformReleaseJpaEntity, Long> {
    fun findByGameIdIn(gameIds: List<Long>): List<GamePlatformReleaseJpaEntity>
    fun findByGameIdAndPlatform(gameId: Long, platform: GamePlatform): GamePlatformReleaseJpaEntity?
}
