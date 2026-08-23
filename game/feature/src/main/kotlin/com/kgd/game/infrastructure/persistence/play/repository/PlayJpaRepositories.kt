package com.kgd.game.infrastructure.persistence.play.repository

import com.kgd.game.domain.play.model.ScoreTrack
import com.kgd.game.infrastructure.persistence.play.entity.GamePlaySessionJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameRatingJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameRunJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameSaveDataJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameScoreJpaEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.time.LocalDateTime

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

/** 최근 기록이 갱신된 보드 한 줄 — 집계 결과라 엔티티가 아니다 */
interface ScoreBoardProjection {
    val gameId: Long
    val track: ScoreTrack
    val lastAt: LocalDateTime
}

interface GameScoreJpaRepository : JpaRepository<GameScoreJpaEntity, Long> {
    fun findByGameIdAndTrackAndNickname(gameId: Long, track: ScoreTrack, nickname: String): GameScoreJpaEntity?
    fun findTop50ByGameIdAndTrackOrderByScoreDescUpdatedAtAsc(gameId: Long, track: ScoreTrack): List<GameScoreJpaEntity>
    fun countByGameIdAndTrackAndScoreGreaterThan(gameId: Long, track: ScoreTrack, score: Long): Long

    /** (게임, 트랙) 으로 묶어 최근 갱신순. 행이 있다는 것 자체가 "기록이 있는 보드"라는 뜻이다 */
    @Query(
        """
        select s.gameId as gameId, s.track as track, max(s.updatedAt) as lastAt
        from GameScoreJpaEntity s
        group by s.gameId, s.track
        order by max(s.updatedAt) desc
        """,
    )
    fun findActiveBoards(pageable: Pageable): List<ScoreBoardProjection>
}
