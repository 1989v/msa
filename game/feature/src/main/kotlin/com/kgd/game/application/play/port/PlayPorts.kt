package com.kgd.game.application.play.port

import com.kgd.game.application.play.dto.GameSessionEndedEvent
import com.kgd.game.application.play.dto.GameSessionStartedEvent
import com.kgd.game.domain.play.model.GamePlaySession
import com.kgd.game.domain.play.model.GameRating

interface PlaySessionRepositoryPort {
    fun save(session: GamePlaySession): GamePlaySession
    fun findBySessionKey(sessionKey: String): GamePlaySession?
}

interface GameRatingRepositoryPort {
    fun findByGameIdAndMemberId(gameId: Long, memberId: Long): GameRating?
    fun findByGameIdAndDeviceId(gameId: Long, deviceId: String): GameRating?
    fun save(rating: GameRating): GameRating
}

interface GameEventPort {
    fun publishSessionStarted(event: GameSessionStartedEvent)
    fun publishSessionEnded(event: GameSessionEndedEvent)
}
