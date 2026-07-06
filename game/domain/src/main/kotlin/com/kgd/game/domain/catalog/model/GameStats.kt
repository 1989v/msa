package com.kgd.game.domain.catalog.model

/**
 * 게임별 집계 프로젝션 (Game 과 1:1). 원본 이벤트는 analytics(ClickHouse)가 소유하고,
 * 이 모델은 리스트/상세 노출용 읽기 최적화 값이다 (설계 §4.1).
 */
class GameStats private constructor(
    val gameId: Long,
    var playCount: Long,
    var ratingSum: Long,
    var ratingCount: Long,
    var weeklyPlayCount: Long
) {
    companion object {
        fun init(gameId: Long): GameStats =
            GameStats(gameId = gameId, playCount = 0, ratingSum = 0, ratingCount = 0, weeklyPlayCount = 0)

        fun restore(gameId: Long, playCount: Long, ratingSum: Long, ratingCount: Long, weeklyPlayCount: Long): GameStats =
            GameStats(gameId, playCount, ratingSum, ratingCount, weeklyPlayCount)
    }

    fun recordPlay() {
        playCount += 1
        weeklyPlayCount += 1
    }

    /** 신규 투표: oldScore=null, 재투표: oldScore=기존 점수 */
    fun applyRating(newScore: Int, oldScore: Int? = null) {
        if (oldScore == null) {
            ratingSum += newScore
            ratingCount += 1
        } else {
            ratingSum += (newScore - oldScore)
        }
    }

    fun resetWeekly() {
        weeklyPlayCount = 0
    }

    /** 평균 평점 (소수 1자리, 투표 없으면 0.0) */
    fun averageRating(): Double =
        if (ratingCount == 0L) 0.0
        else Math.round(ratingSum * 10.0 / ratingCount) / 10.0
}
