package com.kgd.game.domain.play.model

/**
 * 유저 평점 — 1표의 주인은 **회원 또는 기기** 둘 중 하나다. 재투표는 changeScore.
 * 점수 척도는 1~10 (CrazyGames 동일).
 *
 * 게스트(기기) 투표는 저장소를 비우면 우회된다 — 조작을 막지는 못한다.
 * 그럼에도 허용하는 이유는 게임 포털에서 로그인을 요구하면 평점 기능이 사실상 죽기 때문이고,
 * 표 수를 함께 노출해 표본이 작은 평점은 스스로 드러나게 한다.
 */
class GameRating private constructor(
    val id: Long? = null,
    val gameId: Long,
    val memberId: Long?,
    val deviceId: String?,
    var score: Int
) {
    init {
        require(memberId != null || !deviceId.isNullOrBlank()) { "평점에는 회원 또는 기기 식별자가 필요합니다" }
    }

    companion object {
        const val MIN_SCORE = 1
        const val MAX_SCORE = 10

        fun byMember(gameId: Long, memberId: Long, score: Int): GameRating {
            validateScore(score)
            return GameRating(gameId = gameId, memberId = memberId, deviceId = null, score = score)
        }

        fun byDevice(gameId: Long, deviceId: String, score: Int): GameRating {
            validateScore(score)
            return GameRating(gameId = gameId, memberId = null, deviceId = deviceId, score = score)
        }

        fun restore(id: Long?, gameId: Long, memberId: Long?, deviceId: String?, score: Int): GameRating =
            GameRating(id, gameId, memberId, deviceId, score)

        private fun validateScore(score: Int) {
            require(score in MIN_SCORE..MAX_SCORE) { "score는 $MIN_SCORE~$MAX_SCORE 범위여야 합니다: $score" }
        }
    }

    fun changeScore(newScore: Int) {
        validateScore(newScore)
        score = newScore
    }
}
