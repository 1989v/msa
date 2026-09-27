package com.kgd.game.infrastructure.persistence.play.repository

import com.kgd.game.domain.play.model.ScoreTrack
import com.kgd.game.infrastructure.persistence.play.entity.GamePlayerScoreJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GamePlayerScoreDailyJpaEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.time.LocalDate

interface GamePlayerScoreJpaRepository : JpaRepository<GamePlayerScoreJpaEntity, Long> {
    fun findByGameIdAndTrackAndBoardAndPlayerId(gameId: Long, track: ScoreTrack, board: String, playerId: String): GamePlayerScoreJpaEntity?
    fun findTop50ByGameIdAndTrackAndBoardOrderByScoreDescUpdatedAtAsc(gameId: Long, track: ScoreTrack, board: String): List<GamePlayerScoreJpaEntity>
    fun findTop1ByGameIdAndPlayerIdOrderByScoreDesc(gameId: Long, playerId: String): GamePlayerScoreJpaEntity?
    fun countByGameIdAndTrackAndBoardAndScoreGreaterThan(gameId: Long, track: ScoreTrack, board: String, score: Long): Long
    @Query("select s.gameId as gameId, s.track as track, s.board as board, max(s.updatedAt) as lastAt from GamePlayerScoreJpaEntity s group by s.gameId, s.track, s.board order by max(s.updatedAt) desc")
    fun findActiveBoards(pageable: Pageable): List<ScoreBoardProjection>
}

interface GamePlayerScoreDailyJpaRepository : JpaRepository<GamePlayerScoreDailyJpaEntity, Long> {
    fun findByGameIdAndTrackAndBoardAndPlayDateAndPlayerId(gameId: Long, track: ScoreTrack, board: String, playDate: LocalDate, playerId: String): GamePlayerScoreDailyJpaEntity?
    fun findTop50ByGameIdAndTrackAndBoardAndPlayDateOrderByScoreDescUpdatedAtAsc(gameId: Long, track: ScoreTrack, board: String, playDate: LocalDate): List<GamePlayerScoreDailyJpaEntity>
}
