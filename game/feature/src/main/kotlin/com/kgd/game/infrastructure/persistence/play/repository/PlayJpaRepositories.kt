package com.kgd.game.infrastructure.persistence.play.repository

import com.kgd.game.infrastructure.persistence.play.entity.GamePlaySessionJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameRatingJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameRunJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameSaveDataJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface GamePlaySessionJpaRepository : JpaRepository<GamePlaySessionJpaEntity, Long> {
    fun findBySessionKey(sessionKey: String): GamePlaySessionJpaEntity?
}

interface GameRatingJpaRepository : JpaRepository<GameRatingJpaEntity, Long> {
    fun findByGameIdAndMemberId(gameId: Long, memberId: Long): GameRatingJpaEntity?
}

interface GameSaveDataJpaRepository : JpaRepository<GameSaveDataJpaEntity, Long> {
    fun findByGameIdAndMemberId(gameId: Long, memberId: Long): GameSaveDataJpaEntity?
    fun findByGameIdAndSaveCode(gameId: Long, saveCode: String): GameSaveDataJpaEntity?
    fun existsBySaveCode(saveCode: String): Boolean
}

interface GameRunJpaRepository : JpaRepository<GameRunJpaEntity, Long> {
    fun findByRunKey(runKey: String): GameRunJpaEntity?
}
