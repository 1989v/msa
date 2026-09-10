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
    var weeklyPlayCount: Long,
    var weeklyEngagedCount: Long = 0
) {
    companion object {
        /**
         * 인기 점수에서 「실제로 논 한 판」이 갖는 무게.
         *
         * 열어만 본 것도 1점을 갖는다 — 그것까지 0으로 두면 종료 신호가 오지 않는 경로
         * (탭을 그냥 닫는 경우)의 게임이 통째로 사라진다. 대신 끝까지 논 한 번이
         * **열어만 본 세 번**과 같아지도록 둘을 더한다(1 + 2).
         *
         * SQL 정렬도 이 값을 읽는다 — 사본을 만들면 화면과 정렬이 다른 순위를 갖게 된다.
         */
        const val ENGAGED_WEIGHT = 2L

        fun init(gameId: Long): GameStats =
            GameStats(gameId = gameId, playCount = 0, ratingSum = 0, ratingCount = 0, weeklyPlayCount = 0)

        fun restore(
            gameId: Long,
            playCount: Long,
            ratingSum: Long,
            ratingCount: Long,
            weeklyPlayCount: Long,
            weeklyEngagedCount: Long = 0,
        ): GameStats =
            GameStats(gameId, playCount, ratingSum, ratingCount, weeklyPlayCount, weeklyEngagedCount)
    }

    fun recordPlay() {
        playCount += 1
        weeklyPlayCount += 1
    }

    /** 실제로 논 판 — 세션이 끝났고 충분히 머물렀을 때만 오른다 (판정은 GamePlaySession 이 한다) */
    fun recordEngagement() {
        weeklyEngagedCount += 1
    }

    /** 이번 주 인기 점수 — 연 횟수에 실제로 논 판을 얹는다 */
    fun trendingScore(): Long = weeklyPlayCount + ENGAGED_WEIGHT * weeklyEngagedCount

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
        weeklyEngagedCount = 0
    }

    /** 평균 평점 (소수 1자리, 투표 없으면 0.0) */
    fun averageRating(): Double =
        if (ratingCount == 0L) 0.0
        else Math.round(ratingSum * 10.0 / ratingCount) / 10.0
}
