package com.kgd.game.infrastructure.persistence.catalog.entity

import com.kgd.game.domain.catalog.model.GameStats
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table

/** Game 과 1:1 프로젝션 — PK = game_id (설계 §4.1) */
@Entity
@Table(name = "game_stats")
class GameStatsJpaEntity(
    @Id
    @Column(name = "game_id")
    val gameId: Long,
    playCount: Long,
    ratingSum: Long,
    ratingCount: Long,
    weeklyPlayCount: Long,
) {
    @Column(name = "play_count", nullable = false)
    var playCount: Long = playCount
        private set

    @Column(name = "rating_sum", nullable = false)
    var ratingSum: Long = ratingSum
        private set

    @Column(name = "rating_count", nullable = false)
    var ratingCount: Long = ratingCount
        private set

    @Column(name = "weekly_play_count", nullable = false)
    var weeklyPlayCount: Long = weeklyPlayCount
        private set

    fun update(stats: GameStats) {
        playCount = stats.playCount
        ratingSum = stats.ratingSum
        ratingCount = stats.ratingCount
        weeklyPlayCount = stats.weeklyPlayCount
    }

    fun toDomain(): GameStats = GameStats.restore(
        gameId = gameId,
        playCount = playCount,
        ratingSum = ratingSum,
        ratingCount = ratingCount,
        weeklyPlayCount = weeklyPlayCount,
    )

    companion object {
        fun fromDomain(stats: GameStats): GameStatsJpaEntity = GameStatsJpaEntity(
            gameId = stats.gameId,
            playCount = stats.playCount,
            ratingSum = stats.ratingSum,
            ratingCount = stats.ratingCount,
            weeklyPlayCount = stats.weeklyPlayCount,
        )
    }
}
