package com.kgd.game.infrastructure.persistence.play.adapter

import com.kgd.game.application.play.port.GameRatingRepositoryPort
import com.kgd.game.application.play.port.PlaySessionRepositoryPort
import com.kgd.game.domain.play.model.GamePlaySession
import com.kgd.game.domain.play.model.GameRating
import com.kgd.game.infrastructure.persistence.play.entity.GamePlaySessionJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameRatingJpaEntity
import com.kgd.game.infrastructure.persistence.play.repository.GamePlaySessionJpaRepository
import com.kgd.game.infrastructure.persistence.play.repository.GameRatingJpaRepository
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
