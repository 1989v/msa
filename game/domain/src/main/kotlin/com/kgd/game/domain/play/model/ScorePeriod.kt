package com.kgd.game.domain.play.model

/**
 * 랭킹 보드의 기간 축.
 *
 * 트랙(무강화/강화)이 "무엇으로 잰 기록인가"를 가른다면, 기간은 "언제 세운 기록인가"를 가른다.
 * 역대 보드는 닉네임당 최고 하나라 위쪽이 좀처럼 바뀌지 않는다 — 오늘 처음 온 사람에게는
 * 이길 수 없는 표로 보인다. 하루짜리 보드는 매일 비어서 시작하므로 오늘의 1위가 오늘 정해진다.
 */
enum class ScorePeriod {
    /** 역대 — 닉네임당 최고 기록 (game_score) */
    ALL_TIME,

    /** 오늘 — 날짜 안에서 닉네임당 최고 기록 (game_score_daily) */
    DAILY,
    ;

    companion object {
        fun from(raw: String?): ScorePeriod =
            entries.firstOrNull { it.name.equals(raw?.trim(), ignoreCase = true) } ?: ALL_TIME
    }
}
