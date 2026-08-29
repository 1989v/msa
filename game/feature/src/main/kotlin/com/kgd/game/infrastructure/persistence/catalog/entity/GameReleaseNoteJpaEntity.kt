package com.kgd.game.infrastructure.persistence.catalog.entity

import com.kgd.game.domain.catalog.model.ReleaseNote
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDate

@Entity
@Table(name = "game_release_note")
class GameReleaseNoteJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "game_id", nullable = false)
    val gameId: Long,
    @Column(nullable = false, length = 32)
    val version: String,
    @Column(name = "released_at", nullable = false)
    val releasedAt: LocalDate,
    @Column(nullable = false, columnDefinition = "TEXT")
    val body: String,
    @Column(name = "body_en", columnDefinition = "TEXT")
    val bodyEn: String? = null,
) {
    fun toDomain() = ReleaseNote(version, releasedAt, body, bodyEn)
}
