package com.kgd.game.application.play.service

import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.catalog.port.GameStatsRepositoryPort
import com.kgd.game.application.play.dto.RatingResultDto
import com.kgd.game.application.play.port.GameRatingRepositoryPort
import com.kgd.game.application.play.port.PlaySessionRepositoryPort
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.catalog.exception.GameNotPlayableException
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.GameStats
import com.kgd.game.domain.play.exception.SessionNotFoundException
import com.kgd.game.domain.play.model.DeviceType
import com.kgd.game.domain.play.model.GamePlaySession
import com.kgd.game.domain.play.model.GameRating
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

data class PlaySessionResult(val session: GamePlaySession, val gameId: Long, val gameSlug: String)

/** 플레이 유스케이스의 트랜잭션 경계 — Kafka 발행은 파사드(GamePlayService)가 커밋 후 수행 */
@Component
class GamePlayCommand(
    private val gameRepository: GameRepositoryPort,
    private val statsRepository: GameStatsRepositoryPort,
    private val sessionRepository: PlaySessionRepositoryPort,
    private val ratingRepository: GameRatingRepositoryPort,
) {

    @Transactional(transactionManager = "gameTransactionManager")
    fun startSession(slug: String, memberId: Long?, deviceType: DeviceType): PlaySessionResult {
        val game = findPlayableGame(slug)
        val gameId = requireNotNull(game.id) { "영속화된 게임에는 id가 있어야 합니다" }

        val session = sessionRepository.save(
            GamePlaySession.start(
                sessionKey = UUID.randomUUID().toString(),
                gameId = gameId,
                memberId = memberId,
                deviceType = deviceType,
                startedAt = Instant.now(),
            )
        )

        val stats = statsRepository.findByGameId(gameId) ?: GameStats.init(gameId)
        stats.recordPlay()
        statsRepository.save(stats)

        return PlaySessionResult(session = session, gameId = gameId, gameSlug = game.slug)
    }

    @Transactional(transactionManager = "gameTransactionManager")
    fun endSession(sessionKey: String): PlaySessionResult {
        val session = sessionRepository.findBySessionKey(sessionKey)
            ?: throw SessionNotFoundException(sessionKey)
        session.end(Instant.now())
        val saved = sessionRepository.save(session)

        val game = gameRepository.findByIds(listOf(session.gameId)).firstOrNull()
        return PlaySessionResult(session = saved, gameId = session.gameId, gameSlug = game?.slug ?: "")
    }

    @Transactional(transactionManager = "gameTransactionManager")
    /** 회원이면 회원 표, 아니면 기기 표. 둘 다 재투표는 기존 표를 덮어써 표 수를 늘리지 않는다. */
    fun rate(slug: String, memberId: Long?, deviceId: String?, score: Int): RatingResultDto {
        val game = findPlayableGame(slug)
        val gameId = requireNotNull(game.id) { "영속화된 게임에는 id가 있어야 합니다" }

        val existing = if (memberId != null) {
            ratingRepository.findByGameIdAndMemberId(gameId, memberId)
        } else {
            ratingRepository.findByGameIdAndDeviceId(gameId, requireNotNull(deviceId))
        }
        val oldScore = existing?.score
        val rating = existing?.apply { changeScore(score) }
            ?: if (memberId != null) GameRating.byMember(gameId, memberId, score)
            else GameRating.byDevice(gameId, requireNotNull(deviceId), score)
        ratingRepository.save(rating)

        val stats = statsRepository.findByGameId(gameId) ?: GameStats.init(gameId)
        stats.applyRating(newScore = score, oldScore = oldScore)
        val savedStats = statsRepository.save(stats)

        return RatingResultDto(
            score = score,
            ratingAvg = savedStats.averageRating(),
            ratingCount = savedStats.ratingCount,
        )
    }

    private fun findPlayableGame(slug: String): Game {
        val game = gameRepository.findBySlug(slug) ?: throw GameNotFoundException(slug)
        if (!game.isPlayable()) throw GameNotPlayableException(slug)
        return game
    }
}
