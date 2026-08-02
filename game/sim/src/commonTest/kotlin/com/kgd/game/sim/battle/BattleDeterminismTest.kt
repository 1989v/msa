package com.kgd.game.sim.battle

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class BattleDeterminismTest {

    private fun lv10(species: Species) = BattleMonster(species, level = 10)

    private fun replayOf(seed: Int, turns: Int) =
        BattleReplay(seed = seed, commands = List(turns) { TurnCommand(moveA = 0, moveB = 0) })

    @Test
    fun 같은_시드와_커맨드열은_같은_결과를_낸다() {
        val a = lv10(SampleDex.FLAREPUP)
        val b = lv10(SampleDex.LEAFLING)
        val replay = replayOf(seed = 20260802, turns = 50)

        val first = BattleRunner.run(a, b, replay)
        val second = BattleRunner.run(a, b, replay)

        assertEquals(first, second)
    }

    @Test
    fun 다른_시드는_다른_난수_경로를_탄다() {
        val a = lv10(SampleDex.FLAREPUP)
        val b = lv10(SampleDex.LEAFLING)

        val outcomes = (1..20).map { seed -> BattleRunner.run(a, b, replayOf(seed, 50)) }
        // 시드가 달라도 승자는 상성상 대부분 FLAME 이지만, 남은 HP 분포는 달라야 한다
        assertTrue(outcomes.map { it.remainingHpA }.distinct().size > 1, "시드별 난수 롤이 결과에 반영되어야 한다")
    }

    @Test
    fun 타입_상성이_데미지에_반영된다() {
        assertEquals(200, TypeChart.multiplierPct(MonsterType.FLAME, MonsterType.LEAF))
        assertEquals(50, TypeChart.multiplierPct(MonsterType.FLAME, MonsterType.AQUA))
        assertEquals(100, TypeChart.multiplierPct(MonsterType.NORMAL, MonsterType.FLAME))

        // 상성이 승패를 가른다 — FLAME 은 LEAF 를 이기고, AQUA 상대로는 역으로 진다
        val vsLeaf = BattleRunner.run(lv10(SampleDex.FLAREPUP), lv10(SampleDex.LEAFLING), replayOf(7, 100))
        val vsAqua = BattleRunner.run(lv10(SampleDex.FLAREPUP), lv10(SampleDex.AQUAFIN), replayOf(7, 100))
        assertEquals(0, vsLeaf.winner, "FLAME 은 LEAF 상대로 이겨야 한다")
        assertEquals(1, vsAqua.winner, "FLAME 은 AQUA 상대로 져야 한다 (양방향 상성)")
    }

    @Test
    fun 배틀은_승자가_나올_때까지_진행된다() {
        val outcome = BattleRunner.run(lv10(SampleDex.AQUAFIN), lv10(SampleDex.LEAFLING), replayOf(99, 200))
        assertNotNull(outcome.winner)
        assertTrue(outcome.turns > 0)
        // 패자 HP 는 0 이하
        val loserHp = if (outcome.winner == 0) outcome.remainingHpB else outcome.remainingHpA
        assertTrue(loserHp <= 0)
    }

    @Test
    fun 파생_스탯은_정수_공식으로_계산된다() {
        val monster = BattleMonster(SampleDex.FLAREPUP, level = 50)
        assertEquals(39 * 50 / 50 + 50 + 10, monster.maxHp)
        assertEquals(52 * 50 / 50 + 5, monster.atk)
    }
}
