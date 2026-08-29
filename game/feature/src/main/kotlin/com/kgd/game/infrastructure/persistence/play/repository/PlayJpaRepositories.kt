package com.kgd.game.infrastructure.persistence.play.repository

import com.kgd.game.domain.play.model.ScoreTrack
import com.kgd.game.infrastructure.persistence.play.entity.GamePlaySessionJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameRatingJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameRunJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameSaveDataJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameScoreDailyJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameScoreJpaEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.time.LocalDate
import java.time.LocalDateTime

/** 한 회원이 한 게임을 얼마나 했는가 — 상세 화면의 개인 기록 패널이 쓴다 */
interface MemberPlayProjection {
    fun getPlays(): Long
    fun getSeconds(): Long?
    fun getLastPlayedAt(): java.time.LocalDateTime?
}

interface GamePlaySessionJpaRepository : JpaRepository<GamePlaySessionJpaEntity, Long> {
    fun findBySessionKey(sessionKey: String): GamePlaySessionJpaEntity?

    /**
     * 끝난 세션만 센다. 시작만 하고 안 끝난 행은 duration 이 없어서 시간 합계를 왜곡한다 —
     * 탭을 닫으면 종료 신호가 안 오므로 그런 행이 실제로 쌓인다.
     */
    @Query(
        """
        SELECT COUNT(s) AS plays, COALESCE(SUM(s.durationSec), 0) AS seconds,
               MAX(s.startedAt) AS lastPlayedAt
        FROM GamePlaySessionJpaEntity s
        WHERE s.gameId = :gameId AND s.memberId = :memberId AND s.endedAt IS NOT NULL
        """,
    )
    fun summarize(gameId: Long, memberId: Long): MemberPlayProjection

    /**
     * 예상 플레이타임 — **중앙값이 아니라 표본을 받아 서비스가 중앙값을 낸다.**
     * SQL 중앙값은 MySQL 8 에서 윈도 함수를 써야 하고, 이 표본 크기(최근 200)면
     * 애플리케이션에서 고르는 편이 읽기 쉽고 이식성도 좋다.
     */
    @Query(
        """
        SELECT s.durationSec FROM GamePlaySessionJpaEntity s
        WHERE s.gameId = :gameId AND s.endedAt IS NOT NULL AND s.durationSec > 0
        ORDER BY s.startedAt DESC
        """,
    )
    fun recentDurations(gameId: Long, pageable: Pageable): List<Int>
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
    /** 게임이 나눈 모드 키. 빈 문자열이 기본 보드다 (V59) */
    val board: String
    val lastAt: LocalDateTime
}

interface GameScoreJpaRepository : JpaRepository<GameScoreJpaEntity, Long> {
    /** 내 최고 기록 — 트랙·보드를 가리지 않고 점수가 가장 높은 한 행 */
    fun findTop1ByGameIdAndMemberIdOrderByScoreDesc(gameId: Long, memberId: Long): GameScoreJpaEntity?

    fun findByGameIdAndTrackAndBoardAndNickname(
        gameId: Long,
        track: ScoreTrack,
        board: String,
        nickname: String,
    ): GameScoreJpaEntity?

    fun findTop50ByGameIdAndTrackAndBoardOrderByScoreDescUpdatedAtAsc(
        gameId: Long,
        track: ScoreTrack,
        board: String,
    ): List<GameScoreJpaEntity>

    fun countByGameIdAndTrackAndBoardAndScoreGreaterThan(
        gameId: Long,
        track: ScoreTrack,
        board: String,
        score: Long,
    ): Long

    /** (게임, 트랙, 보드) 로 묶어 최근 갱신순. 행이 있다는 것 자체가 "기록이 있는 보드"라는 뜻이다 */
    @Query(
        """
        select s.gameId as gameId, s.track as track, s.board as board, max(s.updatedAt) as lastAt
        from GameScoreJpaEntity s
        group by s.gameId, s.track, s.board
        order by max(s.updatedAt) desc
        """,
    )
    fun findActiveBoards(pageable: Pageable): List<ScoreBoardProjection>
}

interface GameScoreDailyJpaRepository : JpaRepository<GameScoreDailyJpaEntity, Long> {
    fun findByGameIdAndTrackAndBoardAndPlayDateAndNickname(
        gameId: Long,
        track: ScoreTrack,
        board: String,
        playDate: LocalDate,
        nickname: String,
    ): GameScoreDailyJpaEntity?

    fun findTop50ByGameIdAndTrackAndBoardAndPlayDateOrderByScoreDescUpdatedAtAsc(
        gameId: Long,
        track: ScoreTrack,
        board: String,
        playDate: LocalDate,
    ): List<GameScoreDailyJpaEntity>
}
