package com.kgd.game.infrastructure.persistence.catalog.adapter

import com.kgd.game.application.catalog.port.ReleaseNotePort
import com.kgd.game.domain.catalog.model.ReleaseNote
import com.kgd.game.infrastructure.persistence.catalog.repository.GameJpaRepository
import com.kgd.game.infrastructure.persistence.catalog.repository.GameReleaseNoteJpaRepository
import org.springframework.stereotype.Component

@Component
class ReleaseNoteAdapter(
    private val games: GameJpaRepository,
    private val notes: GameReleaseNoteJpaRepository,
) : ReleaseNotePort {
    override fun findBySlug(slug: String): List<ReleaseNote> {
        val gameId = games.findBySlug(slug)?.id ?: return emptyList()
        return notes.findByGameIdOrderByReleasedAtDescVersionDesc(gameId).map { it.toDomain() }
    }
}
