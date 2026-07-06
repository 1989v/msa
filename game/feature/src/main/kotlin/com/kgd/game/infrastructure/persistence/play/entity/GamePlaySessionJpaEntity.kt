package com.kgd.game.infrastructure.persistence.play.entity

import com.kgd.game.domain.play.model.DeviceType
import com.kgd.game.domain.play.model.GamePlaySession
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
    name = "game_play_session",
    indexes = [
        Index(name = "idx_session_game", columnList = "game_id, started_at"),
    ],
)
class GamePlaySessionJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "session_key", nullable = false, unique = true, length = 64)
    val sessionKey: String,
    @Column(name = "game_id", nullable = false)
    val gameId: Long,
    @Column(name = "member_id")
    val memberId: Long?,
    @Enumerated(EnumType.STRING)
    @Column(name = "device_type", nullable = false, length = 16)
    val deviceType: DeviceType,
    @Column(name = "started_at", nullable = false)
    val startedAt: Instant,
    endedAt: Instant?,
    durationSec: Long?,
) {
    @Column(name = "ended_at")
    var endedAt: Instant? = endedAt
        private set

    @Column(name = "duration_sec")
    var durationSec: Long? = durationSec
        private set

    fun update(session: GamePlaySession) {
        endedAt = session.endedAt
        durationSec = session.durationSec
    }

    fun toDomain(): GamePlaySession = GamePlaySession.restore(
        id = id,
        sessionKey = sessionKey,
        gameId = gameId,
        memberId = memberId,
        deviceType = deviceType,
        startedAt = startedAt,
        endedAt = endedAt,
        durationSec = durationSec,
    )

    companion object {
        fun fromDomain(session: GamePlaySession): GamePlaySessionJpaEntity = GamePlaySessionJpaEntity(
            id = session.id,
            sessionKey = session.sessionKey,
            gameId = session.gameId,
            memberId = session.memberId,
            deviceType = session.deviceType,
            startedAt = session.startedAt,
            endedAt = session.endedAt,
            durationSec = session.durationSec,
        )
    }
}
