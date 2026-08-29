package com.kgd.game.infrastructure.persistence.catalog.repository

import com.kgd.game.infrastructure.persistence.catalog.entity.GameReleaseNoteJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface GameReleaseNoteJpaRepository : JpaRepository<GameReleaseNoteJpaEntity, Long> {
    fun findByGameIdOrderByReleasedAtDescVersionDesc(gameId: Long): List<GameReleaseNoteJpaEntity>
}
