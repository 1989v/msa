package com.kgd.game.application.play.service

import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.play.port.GameScoreRepositoryPort
import com.kgd.game.application.play.port.ScoreEntry
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.play.model.ScoreTrack
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** 게임별 랭킹 — 닉네임당 최고 기록. 게스트 제출 허용 (닉네임이 곧 신원) */
@Service
class GameScoreService(
    private val gameRepository: GameRepositoryPort,
    private val scoreRepository: GameScoreRepositoryPort,
) {
    companion object {
        private const val MAX_SCORE = 1_000_000_000_000L   // 명백한 조작값 상한
        private val NICK_REGEX = Regex("^[\\p{L}\\p{N} _.-]{2,16}$")
    }

    @Transactional(transactionManager = "gameTransactionManager")
    fun submit(slug: String, track: ScoreTrack, nickname: String, score: Long, detail: String?): Pair<Boolean, Int> {
        val gameId = resolveGameId(slug)
        val nick = nickname.trim()
        if (!NICK_REGEX.matches(nick)) throw BusinessException(ErrorCode.INVALID_INPUT, "닉네임은 2~16자 (문자/숫자/공백/._-)")
        if (score !in 0..MAX_SCORE) throw BusinessException(ErrorCode.INVALID_INPUT, "점수 범위 오류")
        return scoreRepository.submit(gameId, track, nick, score, detail?.take(64))
    }

    @Transactional(transactionManager = "gameTransactionManager", readOnly = true)
    fun leaderboard(slug: String, track: ScoreTrack, limit: Int): List<ScoreEntry> =
        scoreRepository.top(resolveGameId(slug), track, limit.coerceIn(1, 50))

    private fun resolveGameId(slug: String): Long {
        val game = gameRepository.findBySlug(slug) ?: throw GameNotFoundException(slug)
        if (!game.isPlayable()) throw GameNotFoundException(slug)
        return requireNotNull(game.id) { "영속화된 게임에는 id가 있어야 합니다" }
    }
}
