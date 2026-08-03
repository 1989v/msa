package com.kgd.game.infrastructure.persistence.play.entity

import com.kgd.game.domain.play.model.GameRun
import com.kgd.game.domain.play.model.RunStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(
    name = "game_run",
    indexes = [Index(name = "uk_run_key", columnList = "run_key", unique = true)],
)
class GameRunJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "run_key", nullable = false, length = 64)
    val runKey: String,
    @Column(name = "game_id", nullable = false)
    val gameId: Long,
    @Column(name = "member_id")
    val memberId: Long?,
    @Column(nullable = false)
    val seed: Long,
    status: RunStatus,
    outcome: String?,
    @Column(name = "created_at", nullable = false)
    val createdAt: Instant,
    consumedAt: Instant?,
) {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var status: RunStatus = status
        private set

    @Column(length = 32)
    var outcome: String? = outcome
        private set

    @Column(name = "consumed_at")
    var consumedAt: Instant? = consumedAt
        private set

    fun update(run: GameRun) {
        status = run.status
        outcome = run.outcome
        consumedAt = run.consumedAt
    }

    fun toDomain(): GameRun = GameRun.restore(
        id = id,
        runKey = runKey,
        gameId = gameId,
        memberId = memberId,
        seed = seed,
        status = status,
        outcome = outcome,
        createdAt = createdAt,
        consumedAt = consumedAt,
    )

    companion object {
        fun fromDomain(run: GameRun): GameRunJpaEntity = GameRunJpaEntity(
            id = run.id,
            runKey = run.runKey,
            gameId = run.gameId,
            memberId = run.memberId,
            seed = run.seed,
            status = run.status,
            outcome = run.outcome,
            createdAt = run.createdAt,
            consumedAt = run.consumedAt,
        )
    }
}
