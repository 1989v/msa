package com.kgd.game.application.play.dto

import com.kgd.game.application.play.port.ScoreEntry
import com.kgd.game.domain.play.model.DeviceType
import com.kgd.game.domain.play.model.ScoreTrack
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

/**
 * 허브 랭킹 레일의 한 칸 — 한 게임의 한 보드.
 *
 * 트랙이 보드 식별자에 들어 있는 이유는 두 트랙을 섞으면 안 되기 때문이다(V28):
 * 영구 강화가 붙은 기록과 무강화 기록은 같은 자를 쓰지 않는다.
 */
data class LeaderboardBoardDto(
    val slug: String,
    val title: String,
    val titleEn: String?,
    val thumbnailUrl: String,
    val track: ScoreTrack,
    val entries: List<ScoreEntry>,
)
