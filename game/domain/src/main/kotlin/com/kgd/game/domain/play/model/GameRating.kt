package com.kgd.game.domain.play.model

/**
 * 유저 평점 — 1인 1표 (game_id + member_id unique), 재투표는 changeScore.
 * 점수 척도는 1~10 (CrazyGames 동일).
 */
class GameRating private constructor(
    val id: Long? = null,
    val gameId: Long,
    val memberId: Long,
    var score: Int
) {
    companion object {
        const val MIN_SCORE = 1
        const val MAX_SCORE = 10

        fun create(gameId: Long, memberId: Long, score: Int): GameRating {
            validateScore(score)
            return GameRating(gameId = gameId, memberId = memberId, score = score)
        }

        fun restore(id: Long?, gameId: Long, memberId: Long, score: Int): GameRating =
            GameRating(id, gameId, memberId, score)

        private fun validateScore(score: Int) {
            require(score in MIN_SCORE..MAX_SCORE) { "score는 $MIN_SCORE~$MAX_SCORE 범위여야 합니다: $score" }
        }
    }

    fun changeScore(newScore: Int) {
        validateScore(newScore)
        score = newScore
    }
}
