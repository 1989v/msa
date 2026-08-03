package com.kgd.game.sim

import com.kgd.game.sim.games.SnakeGame
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * 결정성 = 무결성 모델의 토대. 같은 (seed, 입력) → 같은 결과여야 Tier B 리플레이 검증이 성립한다.
 * 이 테스트는 jvm 타깃에서 돈다(JVM = Tier B 가 실제로 도는 곳). js 타깃 추가 시 jsTest 로 교차 검증 예정.
 */
class DeterminismTest {

    private fun replay(seed: Int, ticks: Int, vararg moves: Pair<Int, InputCommand>) =
        ReplayLog(SnakeGame.ID, seed, ticks, moves.map { InputEvent(it.first, it.second) })

    @Test
    fun prng_isDeterministic_acrossRuns() {
        var a = 999
        var b = 999
        repeat(2000) {
            val (va, na) = Mulberry32.next(a); a = na
            val (vb, nb) = Mulberry32.next(b); b = nb
            assertEquals(va, vb)
        }
    }

    @Test
    fun prng_nextInt_staysInRange() {
        var s = 7
        repeat(1000) {
            val (v, ns) = Mulberry32.nextInt(s, 20); s = ns
            assertTrue(v in 0 until 20, "out of range: $v")
        }
    }

    @Test
    fun sameSeedSameInputs_yieldIdenticalResult() {
        val r = replay(12345, 300, 1 to InputCommand.DOWN, 10 to InputCommand.RIGHT, 20 to InputCommand.UP)
        val a = SimRunner.run(SnakeGame(), r)
        val b = SimRunner.run(SnakeGame(), r)
        assertEquals(a, b) // score / endedAtTick / gameOver 전부 동일
    }

    @Test
    fun wallCollision_endsGame_whenNoInput() {
        // 초기 dir=RIGHT, 입력 없음 → 우벽 충돌로 종료.
        val res = SimRunner.run(SnakeGame(width = 8, height = 8), replay(1, 100))
        assertTrue(res.gameOver)
        assertTrue(res.endedAtTick in 1..8, "ended at ${res.endedAtTick}")
    }

    @Test
    fun scoring_isReproducible_acrossSeeds() {
        repeat(20) { seed ->
            val r = replay(seed, 60, 2 to InputCommand.DOWN, 4 to InputCommand.LEFT, 6 to InputCommand.UP)
            assertEquals(
                SimRunner.run(SnakeGame(), r).score,
                SimRunner.run(SnakeGame(), r).score,
                "seed=$seed not reproducible",
            )
        }
    }
}
