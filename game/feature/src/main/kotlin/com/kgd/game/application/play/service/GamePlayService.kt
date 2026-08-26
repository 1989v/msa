package com.kgd.game.application.play.service

import com.kgd.game.application.play.dto.GameSessionEndedEvent
import com.kgd.game.application.play.dto.GameSessionStartedEvent
import com.kgd.game.application.play.dto.RatingResultDto
import com.kgd.game.application.play.dto.SessionEndedDto
import com.kgd.game.application.play.dto.SessionStartedDto
import com.kgd.game.application.play.port.GameEventPort
import com.kgd.game.domain.play.model.DeviceType
import com.kgd.game.application.play.usecase.EndGameSessionUseCase
import com.kgd.game.application.play.usecase.RateGameUseCase
import com.kgd.game.application.play.usecase.StartGameSessionUseCase
import org.springframework.stereotype.Service

/**
 * 플레이 유스케이스 파사드 — 트랜잭션 작업(GamePlayCommand)과 Kafka 발행(외부 IO)을 분리한다
 * (transactional-usage.md: 외부 IO 는 트랜잭션 밖).
 */
@Service
class GamePlayService(
    private val playCommand: GamePlayCommand,
    private val eventPort: GameEventPort,
) : StartGameSessionUseCase, EndGameSessionUseCase, RateGameUseCase {

    override fun execute(command: StartGameSessionUseCase.Command): SessionStartedDto {
        val result = playCommand.startSession(command.slug, command.memberId, command.deviceType)
        eventPort.publishSessionStarted(
            GameSessionStartedEvent(
                sessionKey = result.session.sessionKey,
                gameId = result.gameId,
                gameSlug = result.gameSlug,
                memberId = result.session.memberId,
                deviceType = result.session.deviceType,
                startedAt = result.session.startedAt,
            )
        )
        return SessionStartedDto(
            sessionKey = result.session.sessionKey,
            gameSlug = result.gameSlug,
            startedAt = result.session.startedAt,
        )
    }

    override fun execute(command: EndGameSessionUseCase.Command): SessionEndedDto {
        val result = playCommand.endSession(command.sessionKey)
        val session = result.session
        val endedAt = session.endedAt
        val durationSec = session.durationSec ?: 0
        if (endedAt != null) {
            eventPort.publishSessionEnded(
                GameSessionEndedEvent(
                    sessionKey = session.sessionKey,
                    gameId = result.gameId,
                    gameSlug = result.gameSlug,
                    memberId = session.memberId,
                    durationSec = durationSec,
                    endedAt = endedAt,
                )
            )
        }
        return SessionEndedDto(sessionKey = session.sessionKey, durationSec = durationSec)
    }

    override fun execute(command: RateGameUseCase.Command): RatingResultDto =
        playCommand.rate(command.slug, command.memberId, command.deviceId, command.score)
}
