package com.kgd.game.infrastructure.persistence.play.repository

import com.kgd.game.infrastructure.persistence.play.entity.GamePlaySessionJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameRatingJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface GamePlaySessionJpaRepository : JpaRepository<GamePlaySessionJpaEntity, Long> {
    fun findBySessionKey(sessionKey: String): GamePlaySessionJpaEntity?
}

interface GameRatingJpaRepository : JpaRepository<GameRatingJpaEntity, Long> {
    fun findByGameIdAndMemberId(gameId: Long, memberId: Long): GameRatingJpaEntity?
}
