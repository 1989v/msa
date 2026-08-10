package com.kgd.game.domain.play.model

/**
 * 랭킹 보드 트랙.
 *
 * 다회차 강화(영구 업그레이드)를 가진 게임은 점수가 실력이 아니라 누적 플레이타임을 재게 된다.
 * 같은 게임 안에서 보드를 나눠 두 기록이 섞이지 않게 한다 — 닉네임당 최고 기록 규칙은
 * 트랙 단위로 유지된다.
 */
enum class ScoreTrack {
    /** 영구 강화 없이 세운 기록 */
    BASE,

    /** 영구 강화를 적용한 상태로 세운 기록 */
    MODDED,
    ;

    companion object {
        fun from(raw: String?): ScoreTrack =
            entries.firstOrNull { it.name.equals(raw?.trim(), ignoreCase = true) } ?: BASE
    }
}
