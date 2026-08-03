package com.kgd.game.application.play.dto

import com.kgd.game.domain.play.model.DeviceType
import java.time.Instant

data class SessionStartedDto(
    val sessionKey: String,
    val gameSlug: String,
    val startedAt: Instant,
)

data class SessionEndedDto(
    val sessionKey: String,
    val durationSec: Long,
)

data class RatingResultDto(
    val score: Int,
    val ratingAvg: Double,
    val ratingCount: Long,
)

/** Kafka `game.session.started` payload (수신: analytics) */
data class GameSessionStartedEvent(
    val sessionKey: String,
    val gameId: Long,
    val gameSlug: String,
    val memberId: Long?,
    val deviceType: DeviceType,
    val startedAt: Instant,
)

/** Kafka `game.session.ended` payload (수신: analytics) */
data class GameSessionEndedEvent(
    val sessionKey: String,
    val gameId: Long,
    val gameSlug: String,
    val memberId: Long?,
    val durationSec: Long,
    val endedAt: Instant,
)
