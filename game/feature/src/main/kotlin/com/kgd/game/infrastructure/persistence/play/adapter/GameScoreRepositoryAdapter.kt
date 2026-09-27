package com.kgd.game.infrastructure.persistence.play.adapter

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.game.application.play.port.GameScoreRepositoryPort
import com.kgd.game.application.play.port.ScoreBoardRef
import com.kgd.game.application.play.port.ScoreEntry
import com.kgd.game.domain.play.model.ScoreBoardKey
import com.kgd.game.domain.play.model.ScoreTrack
import com.kgd.game.infrastructure.persistence.play.entity.GamePlayerScoreJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GamePlayerScoreDailyJpaEntity
import com.kgd.game.infrastructure.persistence.play.repository.GameScoreJpaRepository
import com.kgd.game.infrastructure.persistence.play.repository.GameScoreDailyJpaRepository
import com.kgd.game.infrastructure.persistence.play.repository.GamePlayerScoreJpaRepository
import com.kgd.game.infrastructure.persistence.play.repository.GamePlayerScoreDailyJpaRepository
import com.kgd.game.infrastructure.persistence.profile.repository.GamePlayerProfileJpaRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Repository
import java.time.LocalDate
import java.time.LocalDateTime

@Repository
class GameScoreRepositoryAdapter(
    private val jpaRepository: GameScoreJpaRepository,
    private val dailyRepository: GameScoreDailyJpaRepository,
    private val players: GamePlayerScoreJpaRepository,
    private val playerDaily: GamePlayerScoreDailyJpaRepository,
    private val profiles: GamePlayerProfileJpaRepository,
) : GameScoreRepositoryPort {
    /** Caller holds this player's profile write lock for the whole transaction. Legacy is read-only. */
    override fun submit(gameId: Long, track: ScoreTrack, board: ScoreBoardKey, nickname: String,
        score: Long, detail: String?, playDate: LocalDate, memberId: Long?, playerId: String?): Pair<Boolean, Int> {
        val owner = playerId ?: throw BusinessException(ErrorCode.INVALID_INPUT, "닉네임 설정이 필요합니다")
        val key = board.value
        val today = playerDaily.findByGameIdAndTrackAndBoardAndPlayDateAndPlayerId(gameId, track, key, playDate, owner)
        if (today == null) playerDaily.save(GamePlayerScoreDailyJpaEntity(
            gameId = gameId, track = track, board = key, playDate = playDate, playerId = owner, score = score, detail = detail,
        )) else if (today.updateIfHigher(score, detail)) playerDaily.saveAndFlush(today)
        val existing = players.findByGameIdAndTrackAndBoardAndPlayerId(gameId, track, key, owner)
        val applied = if (existing == null) {
            players.saveAndFlush(GamePlayerScoreJpaEntity(gameId = gameId, track = track, board = key,
                playerId = owner, score = score, detail = detail))
            true
        } else existing.updateIfHigher(score, detail).also { if (it) players.saveAndFlush(existing) }
        val best = if (applied) score else existing!!.score
        val rank = players.countByGameIdAndTrackAndBoardAndScoreGreaterThan(gameId, track, key, best) +
            jpaRepository.countByGameIdAndTrackAndBoardAndScoreGreaterThan(gameId, track, key, best) + 1
        return applied to rank.toInt()
    }

    private data class Ranked(val entry: ScoreEntry, val updatedAt: LocalDateTime, val key: String)
    private fun combined(rows: List<Ranked>, limit: Int): List<ScoreEntry> {
        val sorted = rows.sortedWith(compareByDescending<Ranked> { it.entry.score }.thenBy { it.updatedAt }.thenBy { it.key })
        var rank = 1
        return sorted.take(limit).mapIndexed { index, row ->
            if (index > 0 && sorted[index - 1].entry.score != row.entry.score) rank = index + 1
            row.entry.copy(rank = rank)
        }
    }

    override fun top(gameId: Long, track: ScoreTrack, board: ScoreBoardKey, limit: Int): List<ScoreEntry> {
        val modern = players.findTop50ByGameIdAndTrackAndBoardOrderByScoreDescUpdatedAtAsc(gameId, track, board.value)
        val names = profiles.findAllById(modern.map { it.playerId }).associate { it.playerId to it.nickname }
        val rows = modern.map { Ranked(ScoreEntry(0, names.getValue(it.playerId), it.score, it.detail, it.playerId, false), it.updatedAt, "p${it.id}") } +
            jpaRepository.findTop50ByGameIdAndTrackAndBoardOrderByScoreDescUpdatedAtAsc(gameId, track, board.value)
                .map { Ranked(ScoreEntry(0, it.nickname, it.score, it.detail), it.updatedAt, "l${it.id}") }
        return combined(rows, limit)
    }

    override fun topDaily(gameId: Long, track: ScoreTrack, board: ScoreBoardKey, playDate: LocalDate, limit: Int): List<ScoreEntry> {
        val modern = playerDaily.findTop50ByGameIdAndTrackAndBoardAndPlayDateOrderByScoreDescUpdatedAtAsc(gameId, track, board.value, playDate)
        val names = profiles.findAllById(modern.map { it.playerId }).associate { it.playerId to it.nickname }
        val rows = modern.map { Ranked(ScoreEntry(0, names.getValue(it.playerId), it.score, it.detail, it.playerId, false), it.updatedAt, "p${it.id}") } +
            dailyRepository.findTop50ByGameIdAndTrackAndBoardAndPlayDateOrderByScoreDescUpdatedAtAsc(gameId, track, board.value, playDate)
                .map { Ranked(ScoreEntry(0, it.nickname, it.score, it.detail), it.updatedAt, "l${it.id}") }
        return combined(rows, limit)
    }

    override fun activeBoards(limit: Int): List<ScoreBoardRef> =
        (players.findActiveBoards(PageRequest.of(0, limit)) + jpaRepository.findActiveBoards(PageRequest.of(0, limit)))
            .sortedByDescending { it.lastAt }.distinctBy { Triple(it.gameId, it.track, it.board) }.take(limit)
            .map { ScoreBoardRef(it.gameId, it.track, ScoreBoardKey.from(it.board)) }
}
