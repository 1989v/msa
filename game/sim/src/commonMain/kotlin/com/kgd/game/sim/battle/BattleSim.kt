package com.kgd.game.sim.battle

import com.kgd.game.sim.Mulberry32

/**
 * 결정적 1v1 턴제 배틀 — 같은 seed + 같은 커맨드열 → 같은 결과.
 * 서버(jvm)가 리플레이를 재실행해 결과 위조를 거부하는 Tier B 검증에 그대로 쓰인다.
 */
data class CombatantState(val monster: BattleMonster, val hp: Int) {
    fun isFainted(): Boolean = hp <= 0
}

data class BattleState(
    val rng: Int,
    val a: CombatantState,
    val b: CombatantState,
    val turn: Int,
) {
    fun isOver(): Boolean = a.isFainted() || b.isFainted()

    /** 0 = a 승, 1 = b 승, null = 진행 중 */
    fun winner(): Int? = when {
        b.isFainted() -> 0
        a.isFainted() -> 1
        else -> null
    }
}

/** 한 턴의 양측 기술 선택 (기술 인덱스) */
data class TurnCommand(val moveA: Int, val moveB: Int)

data class BattleReplay(val seed: Int, val commands: List<TurnCommand>)

data class BattleOutcome(val winner: Int?, val turns: Int, val remainingHpA: Int, val remainingHpB: Int)

object BattleSim {

    fun init(seed: Int, a: BattleMonster, b: BattleMonster): BattleState =
        BattleState(rng = seed, a = CombatantState(a, a.maxHp), b = CombatantState(b, b.maxHp), turn = 0)

    /** 한 턴 진행 — 속도순(동속은 코인토스)으로 각자 기술 1회 사용. */
    fun turn(state: BattleState, command: TurnCommand): BattleState {
        if (state.isOver()) return state
        var rng = state.rng
        var a = state.a
        var b = state.b

        val aFirst: Boolean = when {
            a.monster.spd > b.monster.spd -> true
            a.monster.spd < b.monster.spd -> false
            else -> {
                val (coin, ns) = Mulberry32.nextInt(rng, 2)
                rng = ns
                coin == 0
            }
        }

        val order = if (aFirst) listOf(0, 1) else listOf(1, 0)
        for (side in order) {
            if (a.isFainted() || b.isFainted()) break
            if (side == 0) {
                val move = a.monster.species.moves[command.moveA % a.monster.species.moves.size]
                val (damage, ns) = rollDamage(rng, attacker = a.monster, defender = b.monster, move = move)
                rng = ns
                b = b.copy(hp = b.hp - damage)
            } else {
                val move = b.monster.species.moves[command.moveB % b.monster.species.moves.size]
                val (damage, ns) = rollDamage(rng, attacker = b.monster, defender = a.monster, move = move)
                rng = ns
                a = a.copy(hp = a.hp - damage)
            }
        }
        return BattleState(rng = rng, a = a, b = b, turn = state.turn + 1)
    }

    /**
     * 데미지 = ((2·level/5 + 2)·power·atk/def)/50 + 2, 이후 STAB(×1.5)·상성(×2/×0.5)·
     * 랜덤 롤(85~100%)을 정수 퍼센트 곱으로 적용. 명중 실패 시 0.
     */
    private fun rollDamage(rng: Int, attacker: BattleMonster, defender: BattleMonster, move: Move): Pair<Int, Int> {
        var state = rng
        val (hitRoll, ns1) = Mulberry32.nextInt(state, 100)
        state = ns1
        if (hitRoll >= move.accuracyPct) return 0 to state

        var damage = ((2 * attacker.level / 5 + 2) * move.power * attacker.atk / defender.def) / 50 + 2
        if (move.type == attacker.species.type) damage = damage * 150 / 100
        damage = damage * TypeChart.multiplierPct(move.type, defender.species.type) / 100
        val (roll, ns2) = Mulberry32.nextInt(state, 16)
        state = ns2
        damage = damage * (85 + roll) / 100
        return maxOf(damage, 1) to state
    }
}

/** 리플레이 러너 — SimRunner 와 동형: 서버가 커맨드열을 재실행해 결과를 재계산한다. */
object BattleRunner {
    private const val MAX_TURNS = 200

    fun run(a: BattleMonster, b: BattleMonster, replay: BattleReplay): BattleOutcome {
        var state = BattleSim.init(replay.seed, a, b)
        for (command in replay.commands) {
            if (state.isOver() || state.turn >= MAX_TURNS) break
            state = BattleSim.turn(state, command)
        }
        return BattleOutcome(
            winner = state.winner(),
            turns = state.turn,
            remainingHpA = state.a.hp,
            remainingHpB = state.b.hp,
        )
    }
}
