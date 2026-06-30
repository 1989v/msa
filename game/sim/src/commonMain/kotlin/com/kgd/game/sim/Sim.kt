package com.kgd.game.sim

/** 결정적 게임 모듈. 같은 seed + 같은 입력열 → 같은 상태/점수 (정수 연산만). */
interface GameModule<S> {
    val gameId: String
    fun init(seed: Int): S

    /** 한 tick 진행. command 는 그 tick 의 입력(없으면 NONE). */
    fun step(state: S, command: InputCommand): S
    fun score(state: S): Int
    fun isOver(state: S): Boolean
}

/** 리플레이/플레이 종료 결과. */
data class SimResult(val score: Int, val endedAtTick: Int, val gameOver: Boolean)

/**
 * 결정적 리플레이 러너.
 *
 * 브라우저 플레이의 1-tick `step` 과 동일한 로직을 서버(Tier B)가 그대로 재실행해 점수를 재계산한다.
 * 클라가 제출한 점수와 여기서 나온 점수가 일치해야 확정 — 불일치 시 무효/섀도밴.
 */
object SimRunner {
    fun <S> run(module: GameModule<S>, replay: ReplayLog): SimResult {
        val inputByTick = HashMap<Int, InputCommand>(replay.inputs.size)
        for (e in replay.inputs) inputByTick[e.tick] = e.command

        var state = module.init(replay.seed)
        var lastTick = 0
        var tick = 1
        while (tick <= replay.totalTicks && !module.isOver(state)) {
            state = module.step(state, inputByTick[tick] ?: InputCommand.NONE)
            lastTick = tick
            tick++
        }
        return SimResult(module.score(state), lastTick, module.isOver(state))
    }
}
