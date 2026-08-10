package com.kgd.game.infrastructure.persistence.play.repository

import com.kgd.game.domain.play.model.ScoreTrack
import com.kgd.game.infrastructure.persistence.play.entity.GamePlaySessionJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameRatingJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameRunJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameSaveDataJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameScoreJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface GamePlaySessionJpaRepository : JpaRepository<GamePlaySessionJpaEntity, Long> {
    fun findBySessionKey(sessionKey: String): GamePlaySessionJpaEntity?
}

interface GameRatingJpaRepository : JpaRepository<GameRatingJpaEntity, Long> {
    fun findByGameIdAndMemberId(gameId: Long, memberId: Long): GameRatingJpaEntity?
    fun findByGameIdAndDeviceId(gameId: Long, deviceId: String): GameRatingJpaEntity?
}

interface GameSaveDataJpaRepository : JpaRepository<GameSaveDataJpaEntity, Long> {
    fun findByGameIdAndMemberId(gameId: Long, memberId: Long): GameSaveDataJpaEntity?
    fun findByGameIdAndSaveCode(gameId: Long, saveCode: String): GameSaveDataJpaEntity?
    fun existsBySaveCode(saveCode: String): Boolean
}

interface GameRunJpaRepository : JpaRepository<GameRunJpaEntity, Long> {
    fun findByRunKey(runKey: String): GameRunJpaEntity?
}

interface GameScoreJpaRepository : JpaRepository<GameScoreJpaEntity, Long> {
    fun findByGameIdAndTrackAndNickname(gameId: Long, track: ScoreTrack, nickname: String): GameScoreJpaEntity?
    fun findTop50ByGameIdAndTrackOrderByScoreDescUpdatedAtAsc(gameId: Long, track: ScoreTrack): List<GameScoreJpaEntity>
    fun countByGameIdAndTrackAndScoreGreaterThan(gameId: Long, track: ScoreTrack, score: Long): Long
}
