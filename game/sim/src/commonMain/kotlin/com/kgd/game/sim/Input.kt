package com.kgd.game.sim

/** 게임 입력. 방향 게임(Snake 등) 공통. NONE = 입력 없음(현 방향 유지). */
enum class InputCommand { UP, DOWN, LEFT, RIGHT, NONE }

/** 특정 tick 의 입력. */
data class InputEvent(val tick: Int, val command: InputCommand)

/**
 * 한 판의 결정적 재현 자료.
 *
 * (서버 발급 seed) + (입력 타임라인)만으로 맵·진행·점수가 전부 복원된다.
 * 클라는 플레이하며 이걸 기록해 제출하고, 서버(Tier B)는 이걸 리플레이해 점수를 재계산한다.
 */
data class ReplayLog(
    val gameId: String,
    val seed: Int,
    val totalTicks: Int,
    /** tick 오름차순, 입력이 있는 tick 만 (NONE 은 생략). */
    val inputs: List<InputEvent>,
)
