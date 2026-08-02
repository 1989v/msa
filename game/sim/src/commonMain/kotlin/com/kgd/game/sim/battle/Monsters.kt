package com.kgd.game.sim.battle

/**
 * 몬스터 수집·배틀 RPG 코어의 데이터 모델 — 전부 오리지널 명칭 (외부 IP 무관).
 * Snake 와 같은 결정성 불변식: 정수 연산만, 시스템 난수/Double 미사용.
 */
enum class MonsterType { FLAME, AQUA, LEAF, SPARK, STONE, NORMAL }

/** 타입 상성 — 배율은 정수 퍼센트 (200/100/50). */
object TypeChart {
    fun multiplierPct(attack: MonsterType, defend: MonsterType): Int = when (attack) {
        MonsterType.FLAME -> when (defend) {
            MonsterType.LEAF -> 200
            MonsterType.AQUA, MonsterType.STONE -> 50
            else -> 100
        }
        MonsterType.AQUA -> when (defend) {
            MonsterType.FLAME, MonsterType.STONE -> 200
            MonsterType.LEAF -> 50
            else -> 100
        }
        MonsterType.LEAF -> when (defend) {
            MonsterType.AQUA, MonsterType.STONE -> 200
            MonsterType.FLAME -> 50
            else -> 100
        }
        MonsterType.SPARK -> when (defend) {
            MonsterType.AQUA -> 200
            MonsterType.LEAF, MonsterType.STONE -> 50
            else -> 100
        }
        MonsterType.STONE -> when (defend) {
            MonsterType.FLAME, MonsterType.SPARK -> 200
            MonsterType.AQUA, MonsterType.LEAF -> 50
            else -> 100
        }
        MonsterType.NORMAL -> 100
    }
}

data class Move(
    val id: String,
    val name: String,
    val type: MonsterType,
    val power: Int,
    val accuracyPct: Int,
)

data class Species(
    val id: String,
    val name: String,
    val type: MonsterType,
    val baseHp: Int,
    val baseAtk: Int,
    val baseDef: Int,
    val baseSpd: Int,
    val moves: List<Move>,
)

/** 레벨 파생 스탯 — 정수 나눗셈만 사용 (JVM/JS 동일 결과). */
data class BattleMonster(val species: Species, val level: Int) {
    val maxHp: Int = species.baseHp * level / 50 + level + 10
    val atk: Int = species.baseAtk * level / 50 + 5
    val def: Int = species.baseDef * level / 50 + 5
    val spd: Int = species.baseSpd * level / 50 + 5
}

/** 프로토타입 도감 — 3종 스타터. 실데이터는 정적 JSON 번들로 확장 예정. */
object SampleDex {
    private val tackle = Move(id = "tackle", name = "몸통박치기", type = MonsterType.NORMAL, power = 40, accuracyPct = 100)

    val FLAREPUP = Species(
        id = "flarepup", name = "플레어펍", type = MonsterType.FLAME,
        baseHp = 39, baseAtk = 52, baseDef = 43, baseSpd = 65,
        moves = listOf(
            Move(id = "ember-bite", name = "불꽃깨물기", type = MonsterType.FLAME, power = 55, accuracyPct = 95),
            tackle,
        ),
    )

    val AQUAFIN = Species(
        id = "aquafin", name = "아쿠아핀", type = MonsterType.AQUA,
        baseHp = 44, baseAtk = 48, baseDef = 65, baseSpd = 43,
        moves = listOf(
            Move(id = "bubble-jet", name = "거품제트", type = MonsterType.AQUA, power = 55, accuracyPct = 95),
            tackle,
        ),
    )

    val LEAFLING = Species(
        id = "leafling", name = "리플링", type = MonsterType.LEAF,
        baseHp = 45, baseAtk = 49, baseDef = 49, baseSpd = 45,
        moves = listOf(
            Move(id = "vine-whip", name = "덩굴채찍", type = MonsterType.LEAF, power = 55, accuracyPct = 95),
            tackle,
        ),
    )

    val ALL: List<Species> = listOf(FLAREPUP, AQUAFIN, LEAFLING)
}
