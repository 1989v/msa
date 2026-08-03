package com.kgd.game.domain.play.model

import com.kgd.game.domain.play.exception.SessionAlreadyEndedException
import java.time.Duration
import java.time.Instant

/**
 * 플레이 세션 — 게스트 허용(memberId null). 세션 row 는 MySQL,
 * 상세 인게임 이벤트는 Kafka(game.session.*) → analytics (설계 §4.2).
 */
class GamePlaySession private constructor(
    val id: Long? = null,
    val sessionKey: String,
    val gameId: Long,
    val memberId: Long?,
    val deviceType: DeviceType,
    val startedAt: Instant,
    var endedAt: Instant?,
    var durationSec: Long?
) {
    companion object {
        fun start(
            sessionKey: String,
            gameId: Long,
            memberId: Long?,
            deviceType: DeviceType,
            startedAt: Instant
        ): GamePlaySession {
            require(sessionKey.isNotBlank()) { "sessionKey는 비어있을 수 없습니다" }
            return GamePlaySession(
                sessionKey = sessionKey,
                gameId = gameId,
                memberId = memberId,
                deviceType = deviceType,
                startedAt = startedAt,
                endedAt = null,
                durationSec = null
            )
        }

        fun restore(
            id: Long?,
            sessionKey: String,
            gameId: Long,
            memberId: Long?,
            deviceType: DeviceType,
            startedAt: Instant,
            endedAt: Instant?,
            durationSec: Long?
        ): GamePlaySession = GamePlaySession(id, sessionKey, gameId, memberId, deviceType, startedAt, endedAt, durationSec)
    }

    fun end(at: Instant) {
        if (endedAt != null) throw SessionAlreadyEndedException(sessionKey)
        val effectiveEnd = if (at.isBefore(startedAt)) startedAt else at
        endedAt = effectiveEnd
        durationSec = Duration.between(startedAt, effectiveEnd).seconds
    }

    fun isEnded(): Boolean = endedAt != null
}
