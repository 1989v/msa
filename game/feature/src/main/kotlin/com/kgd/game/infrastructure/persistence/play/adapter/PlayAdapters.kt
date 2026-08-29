package com.kgd.game.infrastructure.persistence.play.adapter

import com.kgd.game.application.play.port.GameRatingRepositoryPort
import com.kgd.game.application.play.dto.MyGameRecordDto
import com.kgd.game.application.play.port.MemberGameRecordPort
import com.kgd.game.application.play.port.PlaySessionRepositoryPort
import com.kgd.game.domain.play.model.GamePlaySession
import com.kgd.game.domain.play.model.GameRating
import com.kgd.game.infrastructure.persistence.play.entity.GamePlaySessionJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameRatingJpaEntity
import com.kgd.game.infrastructure.persistence.play.repository.GamePlaySessionJpaRepository
import com.kgd.game.infrastructure.persistence.play.repository.GameRatingJpaRepository
import com.kgd.game.infrastructure.persistence.play.repository.GameSaveDataJpaRepository
import com.kgd.game.infrastructure.persistence.play.repository.GameScoreJpaRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Repository

@Repository
class PlaySessionRepositoryAdapter(
    private val jpaRepository: GamePlaySessionJpaRepository,
) : PlaySessionRepositoryPort {

    override fun save(session: GamePlaySession): GamePlaySession {
        val id = session.id
        val entity = if (id != null) {
            val existing = jpaRepository.findById(id).orElseThrow()
            existing.update(session)
            existing
        } else {
            jpaRepository.save(GamePlaySessionJpaEntity.fromDomain(session))
        }
        return entity.toDomain()
    }

    override fun findBySessionKey(sessionKey: String): GamePlaySession? =
        jpaRepository.findBySessionKey(sessionKey)?.toDomain()
}

@Repository
class GameRatingRepositoryAdapter(
    private val jpaRepository: GameRatingJpaRepository,
) : GameRatingRepositoryPort {

    override fun findByGameIdAndMemberId(gameId: Long, memberId: Long): GameRating? =
        jpaRepository.findByGameIdAndMemberId(gameId, memberId)?.toDomain()

    override fun findByGameIdAndDeviceId(gameId: Long, deviceId: String): GameRating? =
        jpaRepository.findByGameIdAndDeviceId(gameId, deviceId)?.toDomain()

    override fun save(rating: GameRating): GameRating {
        val id = rating.id
        val entity = if (id != null) {
            val existing = jpaRepository.findById(id).orElseThrow()
            existing.update(rating)
            existing
        } else {
            jpaRepository.save(GameRatingJpaEntity.fromDomain(rating))
        }
        return entity.toDomain()
    }
}

/**
 * 개인 기록 어댑터.
 *
 * 순위는 "나보다 높은 점수의 수 + 1" 로 센다 — 같은 점수는 같은 순위가 되고,
 * 보드 전체를 읽지 않으므로 기록이 많아져도 비용이 늘지 않는다.
 */
@Repository
class MemberGameRecordAdapter(
    private val sessions: GamePlaySessionJpaRepository,
    private val scores: GameScoreJpaRepository,
    private val saves: GameSaveDataJpaRepository,
) : MemberGameRecordPort {
    override fun summarize(gameId: Long, memberId: Long): MyGameRecordDto {
        val play = sessions.summarize(gameId, memberId)
        val best = scores.findTop1ByGameIdAndMemberIdOrderByScoreDesc(gameId, memberId)
        val rank = best?.let {
            scores.countByGameIdAndTrackAndBoardAndScoreGreaterThan(gameId, it.track, it.board, it.score).toInt() + 1
        }
        return MyGameRecordDto(
            plays = play.getPlays(),
            totalSeconds = play.getSeconds() ?: 0L,
            lastPlayedAt = play.getLastPlayedAt(),
            bestScore = best?.score,
            bestRank = rank,
            bestBoard = best?.board,
            hasSave = saves.findByGameIdAndMemberId(gameId, memberId) != null,
        )
    }

    override fun recentDurations(gameId: Long, limit: Int): List<Int> =
        sessions.recentDurations(gameId, PageRequest.of(0, limit))
}
